import { buildApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';

const app = buildApp();

const start = async () => {
  try {
    await app.listen({ port: config.port, host: config.host });
    logger.info(`VibeMint API running at http://${config.host}:${config.port}`);
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
};

void start();
