import { config } from 'dotenv';

config({ override: true });

const databaseUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error('JWT_SECRET is required in apps/api/.env');
}

export const env = {
  databaseUrl,
  jwtSecret,
  nodeEnv: process.env.NODE_ENV ?? 'development',
  apiPort: Number(process.env.PORT ?? process.env.API_PORT ?? 4322),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:4321',
} as const;