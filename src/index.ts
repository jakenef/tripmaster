import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { env } from "./env";
import logger from "./logger";
import dashboardRoutes from "./routes/dashboard";
import smsRoutes from "./routes/sms";
import healthRoutes from "./routes/health";

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Request/Response logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  logger.info("→ Request", {
    method: req.method,
    path: req.path,
    body: req.body,
    query: req.query,
  });

  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    const duration = Date.now() - start;
    logger.info("← Response", {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      body,
    });
    return originalJson(body);
  };

  next();
});

// Routes
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/sms", smsRoutes);
app.use("/health", healthRoutes);

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

if (require.main === module) {
  app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT}`);
  });
}

export default app;
