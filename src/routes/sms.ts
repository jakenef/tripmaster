import express from "express";
import { tripAgent } from "../agent/TripAgent";
import logger from "../logger";

const router = express.Router();

// POST /api/sms/webhook - Receive incoming SMS from Surge

router.post("/webhook", async (req, res) => {
  const { type, data } = req.body;

  // Only process incoming messages from users
  if (type !== "message.received") {
    return res.json({ success: true, message: "Event ignored" });
  }

  if (!data) {
    return res.status(400).json({ success: false, message: "Missing data" });
  }

  const sender = data.conversation?.contact?.phone_number;
  const message = data.body;

  if (!sender || !message) {
    return res
      .status(400)
      .json({ success: false, message: "Missing sender or message" });
  }

  try {
    await tripAgent.handleSms(sender, message);
    res.json({ success: true });
  } catch (err: any) {
    console.error("[Surge] Webhook error:", err?.message);
    res.status(500).json({ success: false, error: "Failed to process SMS" });
  }
});

export default router;
