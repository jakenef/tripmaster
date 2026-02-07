import logger from "../logger";
import { FlightOffer } from "./TripState";

export class FlightMonitor {
  async checkFlightStatus(flight: FlightOffer): Promise<FlightOffer["status"]> {
    // TODO: Replace with real status check (Amadeus or other API)
    logger.info("Checking flight status", { flight });
    return "on-time"; // stub
  }
}
