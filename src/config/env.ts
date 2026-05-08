import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  GEMINI_API_KEY: z.string(),
  GEMINI_MODEL: z.string().default("gemini-2.0-flash"),
  OPENAI_API_KEY: z.string(),
  SARVAM_API_KEY: z.string().default(""),
  TELEGRAM_BOT_TOKEN: z.string(),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1),
  // WhatsApp — kept optional during migration, remove after cutover
  META_VERIFY_TOKEN: z.string().optional(),
  META_WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_GRAPH_VERSION: z.string().default("v21.0"),
});

export const env = envSchema.parse(process.env);
