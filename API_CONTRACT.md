# TripMaster Backend API Contract

This document describes the API endpoints and data types for the TripMaster backend.

**Base URL**: `http://localhost:3000` (default)

## Shared Data Types

These TypeScript interfaces describe the shape of the data returned by the API.

```typescript
export type TripState =
  | "idle"
  | "collecting_info"
  | "planning"
  | "monitoring"
  | "recovery"
  | "completed";

export interface TripConstraints {
  from?: string | null; // Origin IATA code (e.g., "JFK")
  to?: string | null; // Destination IATA code (e.g., "LHR")
  depart?: string | null; // YYYY-MM-DD
  return?: string | null; // YYYY-MM-DD
  travelers?: number | null;
}

export interface FlightOffer {
  id: string;
  from: string;
  to: string;
  depart: string; // ISO Date string
  price: string; // Total price
  bookingLink: string; // URL to book
  status: "on-time" | "delayed" | "cancelled";
}

export interface HotelOffer {
  id: string;
  name: string;
  city: string;
  checkin: string; // YYYY-MM-DD
  checkout: string; // YYYY-MM-DD
  price: string; // Total price
  bookingLink: string; // URL to book
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
  reasoning: string[]; // Array of AI thought process logs
  logs: string[]; // Array of system logs
}
```

## Endpoints

### Dashboard Data

#### Get Current Trip State

Returns the full state of the active trip, including plan details and constraints.

- **GET** `/api/dashboard/trip`
- **Response**: `{ "trip": Trip | null }`

#### Get AI Reasoning Logs

Returns the history of the AI's decision-making process.

- **GET** `/api/dashboard/reasoning`
- **Response**: `{ "reasoning": string[] }`

#### Get System Logs

Returns general system logs (SMS events, errors, state changes).

- **GET** `/api/dashboard/logs`
- **Response**: `{ "logs": string[] }`

### Simulation & Controls

#### Simulate Flight Delay

Forces the current flight status to "delayed" and notifies the user via SMS.

- **POST** `/api/dashboard/simulate-delay`
- **Response**: `{ "success": true }`
- **Error (400)**: `{ "success": false, "message": "No active flight to delay." }`

#### Simulate Flight Cancellation

Forces the current flight status to "cancelled" and notifies the user via SMS.

- **POST** `/api/dashboard/simulate-cancel`
- **Response**: `{ "success": true }`
- **Error (400)**: `{ "success": false, "message": "No active flight to cancel." }`

#### Approve Trip Plan (Stub)

Placeholder endpoint for frontend "Approve" button.

- **POST** `/api/dashboard/approve`
- **Response**: `{ "success": true, "message": "Trip approved (stub)." }`

#### Modify Trip Plan (Stub)

Placeholder endpoint for frontend "Modify" button.

- **POST** `/api/dashboard/modify`
- **Response**: `{ "success": true, "message": "Trip modified (stub)." }`

### System

#### Health Check

Used to verify the backend is running.

- **GET** `/health`
- **Response**: `OK` (text/plain)
