import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  GEMINI_API_KEY: z.string(),
  META_VERIFY_TOKEN: z.string(),
  META_WHATSAPP_TOKEN: z.string(),
  WHATSAPP_PHONE_NUMBER_ID: z.string(),
  GEMINI_MODEL: z.string().default('gemini-1.5-flash'),
  WHATSAPP_MESSAGE_MOCK_URL: z.string().url().default('https://httpbin.org/post'),
});

export const env = envSchema.parse(process.env);

export type EnvConfig = typeof env;


