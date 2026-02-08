// Handles SMS send/receive via Surge API, manages conversational flow for trip setup

import axios from "axios";
import { env } from "../env";

export class SurgeService {
  async sendSms(to: string, text: string): Promise<void> {
    try {
      await axios.post(
        `https://api.surge.app/accounts/${env.SURGE_ACCOUNT_ID}/messages`,
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
    } catch (err) {
      throw err;
    }
  }
}
