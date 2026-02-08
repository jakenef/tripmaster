import { FlightMonitor } from "./FlightMonitor";
import { SurgeService } from "../sms/SurgeService";
import { Trip, TripState, TripConstraints, TripPlan } from "./TripState";
import logger from "../logger";
import { Reasoning } from "./Reasoning";
import { AmadeusService } from "./AmadeusService";

// Singleton agent for a single active trip
class TripAgent {
  // Trip history for memory
  tripHistory: Array<{
    message: string;
    constraints: TripConstraints;
    plan: TripPlan | null;
  }> = [];
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
    // Only log Amadeus requests/responses; no Surge logging
    return;
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
      this.tripHistory = [];
      await this.surge.sendSms(
        userPhone,
        "Hi! I'm your travel assistant. Where are you dreaming of going, and when?",
      );
      return;
    }
    this.log("Received SMS", { userPhone, message });
    // Add message to trip history
    this.tripHistory.push({
      message,
      constraints: { ...this.trip.constraints },
      plan: this.trip.plan,
    });

    // Always use trip history for context
    const historyText = this.tripHistory
      .map(
        (entry, i) =>
          `Message ${i + 1}: "${entry.message}" Constraints: ${JSON.stringify(entry.constraints)} Plan: ${entry.plan ? JSON.stringify(entry.plan) : "None"}`,
      )
      .join("\n");

    if (this.trip.state === "collecting_info") {
      // Use OpenAI to parse constraints and confirm
      let aiReply = "";
      const today = new Date().toISOString().split("T")[0];
      const currentConstraints = this.trip.constraints || {};

      // --- Location resolution ---
      const resolveIata = async (name: string | null) => {
        if (!name) return null;
        try {
          return await this.amadeus.getLocationCode(name);
        } catch {
          return null;
        }
      };
      function getNearbyDates(
        dateStr: string | null,
        range: number = 3,
      ): string[] {
        if (!dateStr) return [];
        const base = new Date(dateStr);
        if (isNaN(base.getTime())) return [];
        const dates: string[] = [];
        for (let offset = -range; offset <= range; offset++) {
          const d = new Date(base);
          d.setDate(base.getDate() + offset);
          dates.push(d.toISOString().slice(0, 10));
        }
        return dates;
      }
      try {
        aiReply = await this.reasoning.chat(
          `Current date is ${today}.
Trip history:
${historyText}

User message: "${message}"

Extract trip details as JSON. Use context from history to infer missing info. Only output JSON.
JSON Schema:
{
  "originIata": "IATA code or null",
  "destinationIata": "IATA code or null",
  "originName": "city name or null",
  "destinationName": "city name or null",
  "departDate": "YYYY-MM-DD or null",
  "returnDate": "YYYY-MM-DD or null",
  "travelers": number or null
}
Convert relative dates to YYYY-MM-DD.
`,
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
        const jsonStr = aiReply
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();
        parsed = JSON.parse(jsonStr);
      } catch (err: any) {
        this.log("Failed to parse OpenAI JSON", {
          aiReply,
          error: err?.message,
        });
        parsed = {};
      }

      // Resolve IATA codes via Amadeus or use inferred
      let fromCode = parsed.originIata;
      if (!fromCode && parsed.originName) {
        fromCode = await this.amadeus.getLocationCode(parsed.originName);
      }

      let toCode = parsed.destinationIata;
      if (!toCode && parsed.destinationName) {
        toCode = await this.amadeus.getLocationCode(parsed.destinationName);
      }

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

      // Merge with existing constraints, never overwrite
      const mergedConstraints = {
        ...this.trip.constraints,
        ...Object.fromEntries(
          Object.entries(newConstraints).filter(
            ([_, v]) => v !== null && v !== undefined,
          ),
        ),
      };

      this.trip.constraints = mergedConstraints as TripConstraints;
      // Update trip history with new constraints
      this.tripHistory[this.tripHistory.length - 1].constraints = {
        ...mergedConstraints,
      };

      // Validate required fields
      const missing = [];
      if (!mergedConstraints.from) missing.push("departure city");
      if (!mergedConstraints.to) missing.push("destination city");
      if (!mergedConstraints.depart) missing.push("departure date");

      if (missing.length > 0) {
        const prompt = `You are a helpful travel assistant.\nUser message: "${message}"\nCurrent Plan Status:\n- Origin: ${mergedConstraints.from || "Not set"}\n- Destination: ${mergedConstraints.to || "Not set"}\n- Date: ${mergedConstraints.depart || "Not set"}\n\nMissing information: ${missing.join(", ")}.\n\nWrite a natural, friendly SMS response (max 1 sentence) to ask for the missing details. Don't be robotic.`;
        const replyMsg = await this.reasoning.chat(prompt);
        await this.surge.sendSms(userPhone, replyMsg.replace(/"/g, ""));
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
        plan = await this.planTripWithFlexibleDates(
          mergedConstraints,
          getNearbyDates,
        );
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
      // Update trip history with new plan
      this.tripHistory[this.tripHistory.length - 1].plan = plan;
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

  // Plan trip with flexible date search
  private async planTripWithFlexibleDates(
    constraints: TripConstraints,
    getNearbyDates: (dateStr: string | null, range?: number) => string[],
  ): Promise<TripPlan | null> {
    // Try ±3 days around requested date
    const dates = constraints.depart
      ? getNearbyDates(constraints.depart, 3)
      : [];
    let flightsRaw: any[] = [];
    let hotels: any[] = [];
    for (const date of dates.length ? dates : [constraints.depart]) {
      const searchConstraints = { ...constraints, depart: date };
      flightsRaw = await this.amadeus.searchFlights(searchConstraints);
      hotels = await this.amadeus.searchHotels(searchConstraints);
      if (flightsRaw.length && hotels.length) {
        break;
      }
    }
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
