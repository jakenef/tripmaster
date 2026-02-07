import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Load .env file
const envPath = path.resolve(process.cwd(), ".env");
dotenv.config({ path: envPath });

// Log all env vars (except those starting with NODE_)
console.log("--- ENVIRONMENT VARIABLES ---");
Object.keys(process.env)
  .filter((k) => !k.startsWith("NODE_"))
  .forEach((k) => {
    console.log(`${k}=${process.env[k]}`);
  });
console.log("-----------------------------");

// Validate required env vars
const required = [
  "SURGE_API_KEY",
  "SURGE_PHONE_NUMBER",
  "OPENAI_API_KEY",
  "AMADEUS_CLIENT_ID",
  "AMADEUS_CLIENT_SECRET",
  "PORT",
];

const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error("Missing required env vars:", missing.join(", "));
  process.exit(1);
}

export const env = {
  SURGE_API_KEY: process.env.SURGE_API_KEY!,
  SURGE_PHONE_NUMBER: process.env.SURGE_PHONE_NUMBER!,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
  AMADEUS_CLIENT_ID: process.env.AMADEUS_CLIENT_ID!,
  AMADEUS_CLIENT_SECRET: process.env.AMADEUS_CLIENT_SECRET!,
  PORT: parseInt(process.env.PORT!, 10),
  NODE_ENV: process.env.NODE_ENV || "development",
  LOG_LEVEL: process.env.LOG_LEVEL || "debug",
  ENABLE_SIMULATION: process.env.ENABLE_SIMULATION === "true",
};
