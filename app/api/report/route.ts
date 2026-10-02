import { after, NextResponse } from "next/server";
import { pushInfectionLog } from "@/lib/kv";
import { parseReport, type InfectionLog } from "@/lib/report";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ accepted: false, error: "Invalid JSON" }, { status: 200 });
  }

  const report = parseReport(input);
  if (!report) {
    return NextResponse.json(
      { accepted: false, error: "Expected six non-empty string fields, each at most 512 characters" },
      { status: 200 },
    );
  }

  const log: InfectionLog = {
    ...report,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };

  // Vercel keeps this work alive after the response, within maxDuration.
  // Acknowledgement is best-effort acceptance, not proof of persistence.
  after(async () => {
    try {
      await pushInfectionLog(log);
    } catch {
      // Do not print payloads, tokens, URLs, or raw provider errors.
      console.error("[report] Redis write failed", { reportId: log.id });
    }
  });

  return NextResponse.json({ accepted: true, id: log.id }, { status: 200 });
}
