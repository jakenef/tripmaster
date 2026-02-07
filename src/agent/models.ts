import { Trip, TripState } from "./TripState";

// Pydantic-like models for trip, user, logs, etc. (TypeScript interfaces)

export interface User {
  phone: string;
  name?: string;
}

export interface LogEntry {
  timestamp: string;
  action: string;
  details?: any;
}

// Extend Trip interface as needed for more fields
