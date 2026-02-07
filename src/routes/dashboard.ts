import express from "express";
import { tripAgent } from "../agent/TripAgent";
import { SurgeService } from "../sms/SurgeService";

const router = express.Router();

// POST /api/dashboard/simulate-delay - Simulate flight delay
router.post("/simulate-delay", async (req, res) => {
  const trip = tripAgent.getTrip();
  if (!trip || !trip.plan || !trip.plan.flight) {
    return res
      .status(400)
      .json({ success: false, message: "No active flight to delay." });
  }
  trip.plan.flight.status = "delayed";
  trip.logs.push(`${new Date().toISOString()} - Simulated flight delay`);
  // Notify user
  const surge = new SurgeService();
  await surge.sendSms(trip.userPhone, "Demo: Your flight is now delayed.");
  res.json({ success: true });
});

// POST /api/dashboard/simulate-cancel - Simulate flight cancellation
router.post("/simulate-cancel", async (req, res) => {
  const trip = tripAgent.getTrip();
  if (!trip || !trip.plan || !trip.plan.flight) {
    return res
      .status(400)
      .json({ success: false, message: "No active flight to cancel." });
  }
  trip.plan.flight.status = "cancelled";
  trip.logs.push(`${new Date().toISOString()} - Simulated flight cancellation`);
  // Notify user
  const surge = new SurgeService();
  await surge.sendSms(trip.userPhone, "Demo: Your flight is now cancelled.");
  res.json({ success: true });
});

router.get("/trip", (req, res) => {
  const trip = tripAgent.getTrip();
  res.json({ trip });
});

// GET /api/dashboard/reasoning - Get agent reasoning
router.get("/reasoning", (req, res) => {
  const trip = tripAgent.getTrip();
  res.json({ reasoning: trip?.reasoning || [] });
});

// GET /api/dashboard/logs - Get logs
router.get("/logs", (req, res) => {
  const trip = tripAgent.getTrip();
  res.json({ logs: trip?.logs || [] });
});

// POST /api/dashboard/approve - Approve trip plan
router.post("/approve", (req, res) => {
  // TODO: Approve trip plan (stub)
  res.json({ success: true, message: "Trip approved (stub)." });
});

// POST /api/dashboard/modify - Modify trip plan
router.post("/modify", (req, res) => {
  // TODO: Modify trip plan (stub)
  res.json({ success: true, message: "Trip modified (stub)." });
});

module.exports = router;
export default router;
