import express from "express";
import { tripAgent } from "../agent/TripAgent";

const router = express.Router();

// POST /api/sms/webhook - Receive incoming SMS from Surge

router.post("/webhook", async (req, res) => {
  const { from, text, type, data } = req.body;
  let sender = from;
  let message = text;
  // Only log key events
  if (type === "message.received" && data) {
    sender = data.conversation?.contact?.phone_number;
    message = data.body;
    console.log(`[Surge] RX from ${sender}: ${message}`);
  } else if (type === "message.sent" && data) {
    console.log(`[Surge] Sent: ${data.body}`);
  } else if (type === "message.delivered" && data) {
    console.log(`[Surge] Delivered: ${data.body}`);
  }
  if (!sender || !message) {
    return res
      .status(400)
      .json({ success: false, message: "Missing from/text" });
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
