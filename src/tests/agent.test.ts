beforeEach(() => {
  tripAgent.reset();
});
import request from "supertest";
import app from "../index";
import { tripAgent } from "../agent/TripAgent";

// Mock SurgeService to avoid real network calls
jest.mock("../sms/SurgeService", () => {
  return {
    SurgeService: jest.fn().mockImplementation(() => ({
      sendSms: jest.fn().mockResolvedValue({ success: true }),
    })),
  };
});

// Use a TripAgent with polling disabled for test isolation

afterAll(() => {
  tripAgent.stopPolling();
});

describe("TripAgent SMS flow", () => {
  it("should start a new trip and prompt for idea", async () => {
    const res = await request(app)
      .post("/api/sms/webhook")
      .send({ from: "+1234567890", text: "Hi" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("should parse constraints and plan trip", async () => {
    // Simulate initial message
    await tripAgent.handleSms(
      "+1234567890",
      "I want to go from NYC to LA March 1-10",
    );
    // Simulate follow-up (should trigger planning)
    const reply = await tripAgent.handleSms("+1234567890", "That works!");
    expect(reply).toMatch(/Trip planned|Trip plan ready/i);
    const trip = tripAgent.getTrip();
    expect(trip?.plan).toBeDefined();
    expect(trip?.plan.flight).toBeDefined();
    expect(trip?.plan.hotel).toBeDefined();
  });
});

describe("Dashboard endpoints", () => {
  it("should get trip, reasoning, and logs", async () => {
    const trip = tripAgent.getTrip();
    if (!trip) return;
    const tripRes = await request(app).get("/api/dashboard/trip");
    expect(tripRes.status).toBe(200);
    const reasoningRes = await request(app).get("/api/dashboard/reasoning");
    expect(reasoningRes.status).toBe(200);
    const logsRes = await request(app).get("/api/dashboard/logs");
    expect(logsRes.status).toBe(200);
  });
});

describe("Simulation endpoints", () => {
  it("should simulate delay and cancellation", async () => {
    const trip = tripAgent.getTrip();
    if (!trip || !trip.plan) return;
    const delayRes = await request(app).post("/api/dashboard/simulate-delay");
    expect(delayRes.status).toBe(200);
    const cancelRes = await request(app).post("/api/dashboard/simulate-cancel");
    expect(cancelRes.status).toBe(200);
  });
});
