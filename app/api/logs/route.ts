import { NextResponse } from "next/server";
import { readInfectionLogs } from "@/lib/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  try {
    return NextResponse.json(await readInfectionLogs(), { headers });
  } catch {
    console.error("[logs] Redis read failed");
    return NextResponse.json({ error: "Logs are temporarily unavailable" }, { status: 503, headers });
  }
}
