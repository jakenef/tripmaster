import express from "express";
import bodyParser from "body-parser";
import { env } from "./env";
import logger from "./logger";
import dashboardRoutes from "./routes/dashboard";
import smsRoutes from "./routes/sms";

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/sms", smsRoutes);

// Health check
app.get("/health", (_req, res) => res.send("OK"));

// Error handler
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    logger.error("Unhandled error", { error: err });
    res.status(500).json({ error: "Internal Server Error" });
  },
);

const server = app.listen(env.PORT, () => {
  logger.info(`Server running on port ${env.PORT}`);
});

export default app;
