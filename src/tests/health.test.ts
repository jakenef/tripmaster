import request from "supertest";
import app from "../index";

// Mock SurgeService to avoid real network calls
jest.mock("../sms/SurgeService", () => {
  return {
    SurgeService: jest.fn().mockImplementation(() => ({
      sendSms: jest.fn().mockResolvedValue({ success: true }),
    })),
  };
});

describe("Health check", () => {
  it("should return OK", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.text).toBe("OK");
  });
});

// TODO: Add more tests for agent flows, error handling, and simulation endpoints
