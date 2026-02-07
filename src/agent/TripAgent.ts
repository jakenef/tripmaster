import { FlightMonitor } from "./FlightMonitor";
import { SurgeService } from "../sms/SurgeService";
import { Trip, TripState } from "./TripState";
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

  log(action: string, details?: any) {
    const entry = `${new Date().toISOString()} - ${action} - ${JSON.stringify(details || {})}`;
    logger.info(entry);
    if (this.trip) {
      this.trip.logs.push(entry);
    }
  }

  // For demo: respond to SMS with next prompt, using OpenAI
  async handleSms(userPhone: string, message: string): Promise<string> {
    if (!this.trip || this.trip.userPhone !== userPhone) {
      this.startTrip(userPhone);
      return "Hi! Tell me your trip idea (where, when, any constraints)?";
    }
    this.log("Received SMS", { userPhone, message });
    if (this.trip.state === "collecting_info") {
      // Use OpenAI to parse constraints and confirm
      const aiReply = await this.reasoning.chat(
        `A user wants to plan a trip. Here is their message: "${message}". Extract the following as JSON: {from, to, depart, return, travelers, hotel}. If any are missing, use null. Only output JSON.`,
      );
      let constraints: any = {};
      try {
        constraints = JSON.parse(aiReply);
      } catch {
        constraints = {};
      }
      this.trip.constraints = constraints;
      this.trip.reasoning.push(
        "Parsed constraints: " + JSON.stringify(constraints),
      );
      this.trip.state = "planning";
      this.log("Trip state updated", { state: "planning", constraints });
      // Plan trip
      const plan = await this.planTrip(constraints);
      this.trip.plan = plan;
      this.trip.state = "monitoring";
      this.log("Trip state updated", { state: "monitoring", plan });
      // Notify user
      await this.surge.sendSms(
        this.trip.userPhone,
        `Trip plan ready!\nFlight: $${plan.flight.price} - ${plan.flight.bookingLink}\nHotel: $${plan.hotel.price} - ${plan.hotel.bookingLink}`,
      );
      return "Trip planned! Check your SMS for details.";
    }
    if (this.trip.state === "planning") {
      return "Still working on your trip plan!";
    }
    return "Trip is already planned or in progress.";
  }

  // Poll for better options and flight status
  private async pollForUpdates() {
    if (!this.trip || !this.trip.plan) return;
    // Check for better flights
    const flights = await this.amadeus.searchFlights(this.trip.constraints);
    const currentPrice = this.trip.plan.flight?.price;
    const better = flights.find((f: any) => f.price < currentPrice - 50); // $50 cheaper
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
  private async planTrip(constraints: any) {
    const [flight] = await this.amadeus.searchFlights(constraints);
    const [hotel] = await this.amadeus.searchHotels(constraints);
    return { flight: { ...flight, status: "on-time" }, hotel };
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
