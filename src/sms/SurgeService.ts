// Handles SMS send/receive via Surge API, manages conversational flow for trip setup

import axios from "axios";
import { env } from "../env";
import logger from "../logger";

export class SurgeService {
  async sendSms(to: string, text: string): Promise<void> {
    try {
      await axios.post(
        "https://api.surge.send/api/v1/messages",
        {
          to,
          from: env.SURGE_PHONE_NUMBER,
          body: text,
        },
        {
          headers: {
            Authorization: `Bearer ${env.SURGE_API_KEY}`,
            "Content-Type": "application/json",
          },
        },
      );
      logger.info(`Sent SMS to ${to}`);
    } catch (err) {
      logger.error("Failed to send SMS", { to, text, error: err });
      throw err;
    }
  }
}
