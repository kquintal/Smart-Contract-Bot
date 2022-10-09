import logger from "./lib/logger";
import { startServer } from "./server";

startServer().catch((err) => logger.error('💀 Uncaught error, stopping Exterminator 💀', err))