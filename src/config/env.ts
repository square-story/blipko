import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  GEMINI_API_KEY: z.string(),
  META_VERIFY_TOKEN: z.string(),
  META_WHATSAPP_TOKEN: z.string(),
  WHATSAPP_PHONE_NUMBER_ID: z.string(),
  GEMINI_MODEL: z.string().default("gemini-2.0-flash"),
  WHATSAPP_GRAPH_VERSION: z.string().default("v21.0"),
  OPENAI_API_KEY: z.string(),
  SARVAM_API_KEY: z.string().default(""),
});

export const env = envSchema.parse(process.env);
