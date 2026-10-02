export type ReportPayload = {
  public_ip: string;
  hostname: string;
  os: string;
  target_ip: string;
  port: string;
  method: string;
};

export type InfectionLog = ReportPayload & {
  id: string;
  timestamp: string;
};

export function isInfectionLog(input: unknown): input is InfectionLog {
  if (!parseReport(input)) return false;
  const value = input as Record<string, unknown>;
  return typeof value.id === "string" && value.id.length > 0 &&
    typeof value.timestamp === "string" && Number.isFinite(Date.parse(value.timestamp));
}

const fields = ["public_ip", "hostname", "os", "target_ip", "port", "method"] as const;

/** Copy only known fields; never trust client-supplied IDs or timestamps. */
export function parseReport(input: unknown): ReportPayload | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  const report = {} as ReportPayload;
  for (const field of fields) {
    const entry = value[field];
    if (typeof entry !== "string" || !entry.trim() || entry.length > 512) return null;
    report[field] = entry.trim();
  }
  return report;
}
