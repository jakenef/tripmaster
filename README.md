# Autonomous Trip Agent Backend (Express + TypeScript)

This backend powers a long-running, autonomous trip agent that communicates with users via SMS (Surge), uses OpenAI for reasoning, and plans/monitors a single round-trip flight with one hotel using Amadeus API data. It exposes REST endpoints for a live dashboard, supports simulation of travel disruptions, and features highly visible logging and easy .env management.

## Features

- Conversational SMS flow for trip setup (Surge SMS)
- AI-driven reasoning and planning (OpenAI)
- Real flight/hotel data and status (Amadeus API)
- Background polling for better options and flight status
- REST endpoints for dashboard (trip plan, reasoning, logs, approvals)
- Simulation endpoints for delays/cancellations
- Highly visible logging, including all env vars
- Simple backend tests (Jest)

## Getting Started

### 1. Clone and Install

```
git clone <repo-url>
cd tripmaster
npm install
### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your real values:

```

cp .env.example .env
**Required variables:**

- `SURGE_API_KEY` — Your Surge SMS API key
- `SURGE_PHONE_NUMBER` — Your Surge SMS phone number
- `OPENAI_API_KEY` — Your OpenAI API key
- `AMADEUS_CLIENT_ID` — Your Amadeus API client ID
- `AMADEUS_CLIENT_SECRET` — Your Amadeus API client secret
- `PORT` — Port to run the server (default: 3000)
  All env vars are logged on startup for demo/debugging.

### 3. Run the Backend

```
npm run dev
# or for production
npm run build && npm start
### 4. Run Tests

```

npm test

## API Endpoints

### SMS Webhook

- `POST /api/sms/webhook` — Receives incoming SMS (Surge). Body: `{ from, text }`

### Dashboard

- `GET /api/dashboard/trip` — Get current trip plan
- `GET /api/dashboard/reasoning` — Get agent reasoning
- `GET /api/dashboard/logs` — Get logs
- `POST /api/dashboard/approve` — Approve trip plan
- `POST /api/dashboard/modify` — Modify trip plan
- `POST /api/dashboard/simulate-delay` — Simulate flight delay (demo)
- `POST /api/dashboard/simulate-cancel` — Simulate flight cancellation (demo)

### Health Check

- `GET /health` — Returns `OK`

## Simulation

Use the dashboard simulation endpoints to trigger flight delays or cancellations for demo/testing. The agent will update state and notify the user via SMS.

## Folder Structure

- `src/` — Main backend source code
- `src/agent/` — Trip agent logic, state, integrations
- `src/sms/` — SMS integration (Surge)
- `src/routes/` — Express route handlers
- `src/tests/` — Test suite
- `.env.example` — Example environment variables

## No frontend is included in this repo.

# Autonomous Trip Agent Backend (Express + TypeScript)

This backend powers a long-running, autonomous trip agent that communicates with users via SMS (Surge), uses OpenAI for reasoning, and plans/monitors a single round-trip flight with one hotel using Amadeus API data. It exposes REST endpoints for a live dashboard, supports simulation of travel disruptions, and features highly visible logging and easy .env management.

## Features

- Conversational SMS flow for trip setup (Surge SMS)
- AI-driven reasoning and planning (OpenAI)
- Real flight/hotel data and status (Amadeus API)
- Background polling for better options and flight status
- REST endpoints for dashboard (trip plan, reasoning, logs, approvals)
- Simulation endpoints for delays/cancellations
- Highly visible logging, including all env vars
- Simple backend tests (Jest)

## Getting Started

1. Copy `.env.example` to `.env` and fill in required values.
2. Install dependencies: `npm install`
3. Run the backend: `npm run dev`
4. Run tests: `npm test`

## Folder Structure

- `src/` - Main backend source code
- `src/agent/` - Trip agent logic, state, integrations
- `src/sms/` - SMS integration (Surge)
- `src/routes/` - Express route handlers
- `src/tests/` - Test suite
- `.env.example` - Example environment variables

## Environment Variables

See `.env.example` for required configuration. All env vars are logged on startup for demo/debugging.

## No frontend is included in this repo.
