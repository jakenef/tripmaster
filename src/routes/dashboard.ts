import express from "express";
import { tripAgent } from "../agent/TripAgent";

const router = express.Router();

router.get("/trip", (req, res) => {
  res.json({ trip: tripAgent.getTrip() });
});

router.get("/reasoning", (req, res) => {
  const trip = tripAgent.getTrip();
  res.json({ reasoning: trip ? trip.reasoning : [] });
});

router.get("/logs", (req, res) => {
  const trip = tripAgent.getTrip();
  res.json({ logs: trip ? trip.logs : [] });
});

router.post("/simulate-delay", async (req, res) => {
  const success = await tripAgent.simulateDelay();
  if (success) {
    res.json({ success: true });
  } else {
    res
      .status(400)
      .json({ success: false, message: "No active flight to delay." });
  }
});

router.post("/simulate-cancel", async (req, res) => {
  const success = await tripAgent.simulateCancellation();
  if (success) {
    res.json({ success: true });
  } else {
    res
      .status(400)
      .json({ success: false, message: "No active flight to cancel." });
  }
});

router.post("/approve", (req, res) => {
  res.json({ success: true, message: "Trip approved (stub)." });
});

router.post("/modify", (req, res) => {
  res.json({ success: true, message: "Trip modified (stub)." });
});

export default router;
