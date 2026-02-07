// Handles all OpenAI API calls for reasoning, conversation, and recovery suggestions

import OpenAI from "openai";
import { env } from "../env";
import logger from "../logger";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export class Reasoning {
  async chat(prompt: string): Promise<string> {
    try {
      const res = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a helpful travel planning assistant.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 256,
      });
      const reply = res.choices[0]?.message?.content || "";
      logger.info("OpenAI response", { prompt, reply });
      return reply;
    } catch (err) {
      logger.error("OpenAI API error", { error: err });
      return "Sorry, I had trouble thinking of a response.";
    }
  }
}
