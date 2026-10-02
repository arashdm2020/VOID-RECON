import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  read: vi.fn(),
  after: vi.fn(),
}));

vi.mock("@/lib/kv", () => ({ pushInfectionLog: mocks.push, readInfectionLogs: mocks.read }));
vi.mock("next/server", async (importOriginal) => ({
  ...await importOriginal<typeof import("next/server")>(),
  after: mocks.after,
}));

import { POST } from "@/app/api/report/route";
import { GET } from "@/app/api/logs/route";

const payload = {
  public_ip: "192.0.2.10", hostname: "ctf-node-01", os: "Linux",
  target_ip: "10.0.0.20", port: "443", method: "simulation",
};
const request = (body: string) => new Request("http://localhost/api/report", { method: "POST", body });

beforeEach(() => { vi.resetAllMocks(); });

describe("report webhook", () => {
  it("acknowledges before the write and supplies server metadata", async () => {
    const response = await POST(request(JSON.stringify({ ...payload, timestamp: "forged", id: "forged" })));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.accepted).toBe(true);
    expect(body.id).not.toBe("forged");
    expect(mocks.push).not.toHaveBeenCalled();
    await mocks.after.mock.calls[0][0]();
    expect(mocks.push).toHaveBeenCalledWith({ ...payload, id: body.id, timestamp: expect.any(String) });
    expect(Number.isFinite(Date.parse(mocks.push.mock.calls[0][0].timestamp))).toBe(true);
  });

  it.each(["{broken", "null", "[]", "{}", JSON.stringify({ ...payload, port: 443 }), JSON.stringify({ ...payload, hostname: " " }), JSON.stringify({ ...payload, method: "x".repeat(513) })])("acknowledges and discards invalid input: %s", async (body) => {
    const response = await POST(request(body));
    expect(response.status).toBe(200);
    expect((await response.json()).accepted).toBe(false);
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("contains background storage failures without logging provider secrets", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.push.mockRejectedValue(new Error("private-provider-details"));
    const response = await POST(request(JSON.stringify(payload)));
    await expect(mocks.after.mock.calls[0][0]()).resolves.toBeUndefined();
    expect(response.status).toBe(200);
    expect(JSON.stringify(error.mock.calls)).not.toContain("private-provider-details");
    error.mockRestore();
  });
});

describe("logs API", () => {
  it("returns the Redis snapshot without caching", async () => {
    mocks.read.mockResolvedValue([payload]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual([payload]);
  });

  it("distinguishes an unavailable database from an empty list", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.read.mockRejectedValue(new Error("private-provider-details"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Logs are temporarily unavailable" });
    error.mockRestore();
  });
});
