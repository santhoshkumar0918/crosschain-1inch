// contracts/fusion-resolver/src/utils/logger.ts
import winston from "winston";
import path from "path";

export class Logger {
  private logger: winston.Logger;
  private context: string;

  constructor(context: string = "App") {
    this.context = context;

    // Create logs directory if it doesn't exist
    const logDir = path.join(process.cwd(), "logs");

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || "info",
      format: winston.format.combine(
        winston.format.timestamp({
          format: "YYYY-MM-DD HH:mm:ss",
        }),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: "fusion-resolver", context: this.context },
      transports: [
        // Write all logs with level 'error' and below to error.log
        new winston.transports.File({
          filename: path.join(logDir, "error.log"),
          level: "error",
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),

        // Write all logs with level 'info' and below to combined.log
        new winston.transports.File({
          filename: path.join(logDir, "combined.log"),
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
      ],
    });

    // If we're not in production, log to console as well
    if (process.env.NODE_ENV !== "production") {
      this.logger.add(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
            winston.format.printf(
              ({ timestamp, level, message, context, ...meta }) => {
                const metaStr = Object.keys(meta).length
                  ? JSON.stringify(meta, null, 2)
                  : "";
                return `${timestamp} [${context}] ${level}: ${message} ${metaStr}`;
              }
            )
          ),
        })
      );
    }
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, { context: this.context, ...meta });
  }

  error(message: string, error?: any): void {
    this.logger.error(message, {
      context: this.context,
      error:
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : error,
    });
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, { context: this.context, ...meta });
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, { context: this.context, ...meta });
  }

  verbose(message: string, meta?: any): void {
    this.logger.verbose(message, { context: this.context, ...meta });
  }
}
