import "server-only";
import { Redis } from "@upstash/redis";
import type { InfectionLog } from "@/lib/report";

export const LOGS_KEY = "infection_logs";

// Lazy initialization lets builds succeed without runtime credentials.
function getKV() {
  // Select a complete pair so credentials from different databases never mix.
  const upstashConfigured = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;
  const url = upstashConfigured ? process.env.UPSTASH_REDIS_REST_URL : process.env.KV_REST_API_URL;
  const token = upstashConfigured ? process.env.UPSTASH_REDIS_REST_TOKEN : process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("Redis is not configured");
  return new Redis({
    url,
    token,
    cache: "no-store",
    // Retrying LPUSH after a lost response can duplicate a report.
    retry: false,
  });
}

export async function pushInfectionLog(log: InfectionLog): Promise<void> {
  await getKV().lpush(LOGS_KEY, log);
}

export async function readInfectionLogs(): Promise<InfectionLog[]> {
  return getKV().lrange<InfectionLog>(LOGS_KEY, 0, -1);
}
