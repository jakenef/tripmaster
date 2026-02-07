import { createLogger, format, transports } from "winston";
import { env } from "./env";

const logger = createLogger({
  level: env.LOG_LEVEL,
  format: format.combine(
    format.colorize(),
    format.timestamp(),
    format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ""}`;
    }),
  ),
  transports: [new transports.Console()],
});

export default logger;
