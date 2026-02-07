import express from "express";

const router = express.Router();

// POST /api/sms/webhook - Receive incoming SMS from Surge
import { tripAgent } from "../agent/TripAgent";

import { SurgeService } from "../sms/SurgeService";

const surge = new SurgeService();

router.post("/webhook", async (req, res) => {
  const { from, text } = req.body;
  if (!from || !text) {
    return res
      .status(400)
      .json({ success: false, message: "Missing from/text" });
  }
  try {
    const reply = await tripAgent.handleSms(from, text);
    await surge.sendSms(from, reply);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to process SMS" });
  }
});

module.exports = router;
export default router;
