// Type definitions and state machine logic for trip lifecycle

export type TripState =
  | "idle"
  | "collecting_info"
  | "planning"
  | "monitoring"
  | "recovery"
  | "completed";

export interface Trip {
  id: string;
  userPhone: string;
  state: TripState;
  constraints: any; // TODO: Define constraints type
  plan: any; // TODO: Define plan type (flights, hotel, etc.)
  reasoning: string[];
  logs: string[];
}
