import { FlightMonitor } from "./FlightMonitor";
import { SurgeService } from "../sms/SurgeService";
import { Trip, TripState, TripConstraints, TripPlan } from "./TripState";
import logger from "../logger";
import { Reasoning } from "./Reasoning";
import { AmadeusService } from "./AmadeusService";

// Singleton agent for a single active trip
class TripAgent {
  reset() {
    this.trip = null;
  }
  private trip: Trip | null = null;
  private reasoning: Reasoning;
  private amadeus: AmadeusService;
  private monitor: FlightMonitor;
  private surge: SurgeService;
  private pollingInterval: NodeJS.Timeout | null = null;
  private pollingEnabled: boolean;

  constructor({ enablePolling = true } = {}) {
    this.reasoning = new Reasoning();
    this.amadeus = new AmadeusService();
    this.monitor = new FlightMonitor();
    this.surge = new SurgeService();
    this.pollingEnabled = enablePolling;
    if (this.pollingEnabled) {
      this.pollingInterval = setInterval(() => {
        this.pollForUpdates();
      }, 60_000); // every 60s
    }
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  startTrip(userPhone: string) {
    this.trip = {
      id: Date.now().toString(),
      userPhone,
      state: "collecting_info",
      constraints: {},
      plan: null,
      reasoning: [],
      logs: [],
    };
    this.log("Trip started", { userPhone });
  }

  getTrip() {
    return this.trip;
  }

  async simulateDelay() {
    if (this.trip?.plan?.flight) {
      this.trip.plan.flight.status = "delayed";
      this.log("Simulation: Flight delayed");
      await this.surge.sendSms(
        this.trip.userPhone,
        "Alert: Your flight has been delayed (SIMULATION).",
      );
      return true;
    }
    return false;
  }

  async simulateCancellation() {
    if (this.trip?.plan?.flight) {
      this.trip.plan.flight.status = "cancelled";
      this.log("Simulation: Flight cancelled");
      await this.surge.sendSms(
        this.trip.userPhone,
        "Alert: Your flight has been cancelled (SIMULATION).",
      );
      return true;
    }
    return false;
  }

  log(action: string, details?: any) {
    const entry = `${new Date().toISOString()} - ${action} - ${JSON.stringify(details || {})}`;
    logger.info(entry);
    if (this.trip) {
      this.trip.logs.push(entry);
    }
  }

  // For demo: respond to SMS with next prompt, using OpenAI
  async handleSms(userPhone: string, message: string): Promise<void> {
    if (message.trim().toUpperCase() === "RESTART") {
      this.reset();
      await this.surge.sendSms(
        userPhone,
        "Session reset. Send a message to start a new trip planning session.",
      );
      return;
    }

    if (!this.trip || this.trip.userPhone !== userPhone) {
      this.startTrip(userPhone);
      await this.surge.sendSms(
        userPhone,
        "Hi! Tell me your trip idea (where, when, any constraints)?",
      );
      return;
    }
    this.log("Received SMS", { userPhone, message });
    if (this.trip.state === "collecting_info") {
      // Use OpenAI to parse constraints and confirm
      let aiReply = "";
      const today = new Date().toISOString().split("T")[0];
      try {
        aiReply = await this.reasoning.chat(
          `Current date is ${today}. User message: "${message}". 
Extract trip details as JSON:
{
  "originName": "city name",
  "destinationName": "city name",
  "departDate": "YYYY-MM-DD",
  "returnDate": "YYYY-MM-DD",
  "travelers": number
}
If missing, use null. Convert relative dates to YYYY-MM-DD.
Do NOT guess IATA codes, just extract names.
Only output JSON.`,
        );
      } catch (err: any) {
        this.log("OpenAI reasoning failed", {
          error: err?.message,
          stack: err?.stack,
        });
        await this.surge.sendSms(
          userPhone,
          "Sorry, I couldn't understand your request. Please try again.",
        );
        return;
      }
      let parsed: any = {};
      try {
        parsed = JSON.parse(aiReply);
      } catch (err: any) {
        this.log("Failed to parse OpenAI JSON", {
          aiReply,
          error: err?.message,
        });
        parsed = {};
      }

      // Resolve IATA codes via Amadeus
      const fromCode = await this.amadeus.getLocationCode(
        parsed.originName || "",
      );
      const toCode = await this.amadeus.getLocationCode(
        parsed.destinationName || "",
      );

      // Check for resolution failures
      const resolutionErrors: string[] = [];
      if (parsed.originName && !fromCode) {
        resolutionErrors.push(
          `I couldn't identify the location "${parsed.originName}".`,
        );
      }
      if (parsed.destinationName && !toCode) {
        resolutionErrors.push(
          `I couldn't identify the location "${parsed.destinationName}".`,
        );
      }

      if (resolutionErrors.length > 0) {
        await this.surge.sendSms(
          userPhone,
          `${resolutionErrors.join(" ")} Please try using an airport code (e.g. JFK) or a major city name.`,
        );
        return;
      }

      const newConstraints = {
        from: fromCode,
        to: toCode,
        depart: parsed.departDate,
        return: parsed.returnDate,
        travelers: parsed.travelers,
      };

      // Merge with existing constraints
      const currentConstraints = this.trip.constraints || {};
      const mergedConstraints = {
        ...currentConstraints,
        ...Object.fromEntries(
          Object.entries(newConstraints).filter(
            ([_, v]) => v !== null && v !== undefined,
          ),
        ),
      };

      this.trip.constraints = mergedConstraints as TripConstraints;

      // Validate required fields
      const missing = [];
      if (!mergedConstraints.from) missing.push("departure city");
      if (!mergedConstraints.to) missing.push("destination city");
      if (!mergedConstraints.depart) missing.push("departure date");

      if (missing.length > 0) {
        await this.surge.sendSms(
          userPhone,
          `I need a bit more info. Please provide: ${missing.join(", ")}.`,
        );
        return;
      }

      this.trip.reasoning.push(
        "Parsed constraints: " + JSON.stringify(mergedConstraints),
      );
      this.trip.state = "planning";
      this.log("Trip state updated", {
        state: "planning",
        constraints: mergedConstraints,
      });
      // Plan trip
      let plan: TripPlan | null = null;
      try {
        plan = await this.planTrip(mergedConstraints);
      } catch (err: any) {
        this.log("Trip planning failed", {
          error: err?.message,
          stack: err?.stack,
        });
        this.trip.state = "collecting_info";
        await this.surge.sendSms(
          userPhone,
          "Sorry, I couldn't find any trips matching your request. Please try again.",
        );
        return;
      }
      if (!plan || !plan.flight || !plan.hotel) {
        this.log("No plan found", { plan });
        this.trip.state = "collecting_info";
        await this.surge.sendSms(
          userPhone,
          "Sorry, I couldn't find any trips matching your request. Please try again.",
        );
        return;
      }
      this.trip.plan = plan;
      this.trip.state = "monitoring";
      this.log("Trip state updated", { state: "monitoring", plan });
      // Notify user
      try {
        await this.surge.sendSms(
          this.trip.userPhone,
          `Trip plan ready!\nFrom: ${mergedConstraints.from} To: ${mergedConstraints.to}\nDates: ${mergedConstraints.depart} to ${mergedConstraints.return || "N/A"}\nFlight: $${plan.flight.price} - ${plan.flight.bookingLink}\nHotel: $${plan.hotel.price} - ${plan.hotel.bookingLink}`,
        );
      } catch (err: any) {
        this.log("Failed to send trip plan SMS", {
          error: err?.message,
          stack: err?.stack,
        });
      }
      // Note: We already sent the detailed plan above, so we don't need a second "Trip planned" message.
      return;
    }
    if (this.trip.state === "planning") {
      this.log("Trip still planning", { trip: this.trip });
      await this.surge.sendSms(userPhone, "Still working on your trip plan!");
      return;
    }
    await this.surge.sendSms(
      userPhone,
      "Trip is already planned or in progress.",
    );
  }

  // Poll for better options and flight status
  private async pollForUpdates() {
    if (!this.trip || !this.trip.plan) return;
    // Check for better flights
    const flights = await this.amadeus.searchFlights(this.trip.constraints);
    const currentPrice = parseFloat(this.trip.plan.flight.price);
    const better = flights.find((f) => parseFloat(f.price) < currentPrice - 50); // $50 cheaper
    if (better) {
      this.log("Found better flight", { better });
      await this.surge.sendSms(
        this.trip.userPhone,
        `Found a cheaper flight: $${better.price}. Book: ${better.bookingLink}`,
      );
    }
    // Check flight status
    const status = await this.monitor.checkFlightStatus(this.trip.plan.flight);
    if (status !== this.trip.plan.flight.status) {
      this.log("Flight status changed", { status });
      await this.surge.sendSms(
        this.trip.userPhone,
        `Flight status update: ${status}`,
      );
      this.trip.plan.flight.status = status;
    }
  }

  // Plan trip using AmadeusService
  private async planTrip(
    constraints: TripConstraints,
  ): Promise<TripPlan | null> {
    const flightsRaw = await this.amadeus.searchFlights(constraints);
    const hotels = await this.amadeus.searchHotels(constraints);

    if (!flightsRaw.length || !hotels.length) {
      return null;
    }

    const flightOptions = flightsRaw.map((f) => ({
      ...f,
      status: "on-time" as const,
    }));
    const hotelOptions = hotels;

    const flight = flightOptions[0];
    const hotel = hotelOptions[0];
    return { flight, hotel, flightOptions, hotelOptions };
  }
}

// Default singleton for app use, but disable polling in test environment
const isTest =
  process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID !== undefined;
export const tripAgent = new TripAgent({ enablePolling: !isTest });

// Factory for tests to control polling
export function createTripAgent(options = {}) {
  return new TripAgent(options);
}
