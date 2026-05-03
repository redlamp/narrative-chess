// Test setup: load .env.local so Zod-validated env schemas pass in unit tests.
// Bun v1.3.11 does not auto-load .env.local; this preload file fills that gap.
import { configDotenv } from "dotenv";
configDotenv({ path: ".env.local" });
