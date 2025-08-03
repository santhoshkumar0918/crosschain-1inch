// contracts/fusion-resolver/src/utils/logger.ts
import winston from 'winston';
import { config } from './config';

export class Logger {
  private logger: winston.Logger;

  constructor(private context: string) {
    this.logger = winston.createLogger({
      level: config.nodeEnv === 'development' ? 'debug' : 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
          return `${timestamp} [${level.toUpperCase()}] [${context || 'FUSION'}]: ${message} ${
            Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
          }`;
        })
      ),
      defaultMeta: { context: this.context },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
        new winston.transports.File({ 
          filename: 'logs/fusion-resolver.log',
          level: 'info',
        }),
        new winston.transports.File({ 
          filename: 'logs/error.log', 
          level: 'error',
        }),
      ],
    });
  }

  debug(message: string, meta?: any) {
    this.logger.debug(message, meta);
  }

  info(message: string, meta?: any) {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: any) {
    this.logger.warn(message, meta);
  }

  error(message: string, error?: any) {
    if (error instanceof Error) {
      this.logger.error(message, { error: error.message, stack: error.stack });
    } else {
      this.logger.error(message, { error });
    }
  }
}

// Export singleton instances for common use
export const logger = new Logger('FusionResolver');
export const auctionLogger = new Logger('DutchAuction');
export const htlcLogger = new Logger('HTLCManager');
export const orderLogger = new Logger('OrderBook');
