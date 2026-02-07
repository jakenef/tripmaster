import logger from "../logger";

export class FlightMonitor {
  async checkFlightStatus(flight: any): Promise<string> {
    // TODO: Replace with real status check (Amadeus or other API)
    logger.info("Checking flight status", { flight });
    return "on-time"; // stub
  }
}
