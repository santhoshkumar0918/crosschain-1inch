"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
// contracts/fusion-resolver/src/utils/logger.ts
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
class Logger {
    logger;
    context;
    constructor(context = "App") {
        this.context = context;
        // Create logs directory if it doesn't exist
        const logDir = path_1.default.join(process.cwd(), "logs");
        this.logger = winston_1.default.createLogger({
            level: process.env.LOG_LEVEL || "info",
            format: winston_1.default.format.combine(winston_1.default.format.timestamp({
                format: "YYYY-MM-DD HH:mm:ss",
            }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
            defaultMeta: { service: "fusion-resolver", context: this.context },
            transports: [
                // Write all logs with level 'error' and below to error.log
                new winston_1.default.transports.File({
                    filename: path_1.default.join(logDir, "error.log"),
                    level: "error",
                    maxsize: 5242880, // 5MB
                    maxFiles: 5,
                }),
                // Write all logs with level 'info' and below to combined.log
                new winston_1.default.transports.File({
                    filename: path_1.default.join(logDir, "combined.log"),
                    maxsize: 5242880, // 5MB
                    maxFiles: 5,
                }),
            ],
        });
        // If we're not in production, log to console as well
        if (process.env.NODE_ENV !== "production") {
            this.logger.add(new winston_1.default.transports.Console({
                format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple(), winston_1.default.format.printf(({ timestamp, level, message, context, ...meta }) => {
                    const metaStr = Object.keys(meta).length
                        ? JSON.stringify(meta, null, 2)
                        : "";
                    return `${timestamp} [${context}] ${level}: ${message} ${metaStr}`;
                })),
            }));
        }
    }
    info(message, meta) {
        this.logger.info(message, { context: this.context, ...meta });
    }
    error(message, error) {
        this.logger.error(message, {
            context: this.context,
            error: error instanceof Error
                ? {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                }
                : error,
        });
    }
    warn(message, meta) {
        this.logger.warn(message, { context: this.context, ...meta });
    }
    debug(message, meta) {
        this.logger.debug(message, { context: this.context, ...meta });
    }
    verbose(message, meta) {
        this.logger.verbose(message, { context: this.context, ...meta });
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map