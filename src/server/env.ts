import 'server-only';
import { parseEnv, type Env } from './env-schema';

export { parseEnv, type Env };

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
