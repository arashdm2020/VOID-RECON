import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn(), lpush: vi.fn(), lrange: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@upstash/redis", () => ({ Redis: mocks.create }));

import { pushInfectionLog, readInfectionLogs } from "@/lib/kv";

beforeEach(() => {
  for (const name of ["KV_REST_API_URL", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]) {
    vi.stubEnv(name, "");
  }
  mocks.create.mockImplementation(function () {
    return { lpush: mocks.lpush, lrange: mocks.lrange };
  });
});
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });

it("writes JSON and reads the full newest-first list with caching disabled", async () => {
  vi.stubEnv("KV_REST_API_URL", "https://redis.example.invalid");
  vi.stubEnv("KV_REST_API_TOKEN", "test-placeholder");
  const report = {
    id: "example", timestamp: "2026-10-02T00:00:00.000Z",
    public_ip: "192.0.2.10", hostname: "ctf-node", os: "Linux",
    target_ip: "10.0.0.20", port: "443", method: "simulation",
  };
  mocks.lrange.mockResolvedValue([report]);
  await pushInfectionLog(report);
  expect(mocks.lpush).toHaveBeenCalledWith("infection_logs", report);
  expect(await readInfectionLogs()).toEqual([report]);
  expect(mocks.lrange).toHaveBeenCalledWith("infection_logs", 0, -1);
  expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ cache: "no-store", retry: false }));
});

it("uses automatically injected Upstash variables ahead of legacy credentials", async () => {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://upstash.example.invalid");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "upstash-test-placeholder");
  vi.stubEnv("KV_REST_API_URL", "https://legacy.example.invalid");
  vi.stubEnv("KV_REST_API_TOKEN", "legacy-test-placeholder");
  mocks.lrange.mockResolvedValue([]);
  await readInfectionLogs();
  expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
    url: "https://upstash.example.invalid", token: "upstash-test-placeholder",
  }));
});

it("never combines an Upstash URL with a legacy token", async () => {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://upstash.example.invalid");
  vi.stubEnv("KV_REST_API_TOKEN", "legacy-test-placeholder");
  await expect(readInfectionLogs()).rejects.toThrow("Redis is not configured");
  expect(mocks.create).not.toHaveBeenCalled();
});

it("fails cleanly when runtime credentials are absent", async () => {
  vi.stubEnv("KV_REST_API_URL", "");
  vi.stubEnv("KV_REST_API_TOKEN", "");
  await expect(readInfectionLogs()).rejects.toThrow("Redis is not configured");
  expect(mocks.create).not.toHaveBeenCalled();
});
