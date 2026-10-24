import pino from 'pino';
import { isProd } from './env';

export const loggerOptions = isProd
  ? { level: 'info' }
  : {
      level: 'info',
      transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
    };

export const logger = pino(loggerOptions as pino.LoggerOptions);
