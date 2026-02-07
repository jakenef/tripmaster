// Type definitions and state machine logic for trip lifecycle

export type TripState =
  | "idle"
  | "collecting_info"
  | "planning"
  | "monitoring"
  | "recovery"
  | "completed";

export interface TripConstraints {
  from?: string | null;
  to?: string | null;
  depart?: string | null;
  return?: string | null;
  travelers?: number | null;
}

export interface FlightOffer {
  id: string;
  from: string;
  to: string;
  depart: string;
  price: string;
  bookingLink: string;
  status: "on-time" | "delayed" | "cancelled";
}

export interface HotelOffer {
  id: string;
  name: string;
  city: string;
  checkin: string;
  checkout: string;
  price: string;
  bookingLink: string;
}

export interface TripPlan {
  flight: FlightOffer;
  hotel: HotelOffer;
  flightOptions: FlightOffer[];
  hotelOptions: HotelOffer[];
}

export interface Trip {
  id: string;
  userPhone: string;
  state: TripState;
  constraints: TripConstraints;
  plan: TripPlan | null;
  reasoning: string[];
  logs: string[];
}
