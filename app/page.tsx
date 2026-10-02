"use client";

import { useEffect, useState } from "react";
import { isInfectionLog, type InfectionLog } from "@/lib/report";

export default function Dashboard() {
  const [logs, setLogs] = useState<InfectionLog[]>([]);
  const [status, setStatus] = useState<"connecting" | "live" | "offline">("connecting");
  const [updated, setUpdated] = useState<Date | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let disposed = false;
    let pending = false;
    let controller: AbortController | null = null;

    async function refresh() {
      if (pending) return;
      pending = true;
      controller = new AbortController();
      const current = controller;
      const timeout = setTimeout(() => current.abort(), 8000);
      try {
        const response = await fetch("/api/logs", { cache: "no-store", signal: current.signal });
        if (!response.ok) throw new Error("Fetch failed");
        const data: unknown = await response.json();
        if (!Array.isArray(data) || !data.every(isInfectionLog)) throw new Error("Invalid response");
        if (!disposed) {
          setLogs(data);
          setUpdated(new Date());
          setStatus("live");
        }
      } catch {
        if (!disposed) setStatus("offline");
      } finally {
        clearTimeout(timeout);
        pending = false;
      }
    }

    void refresh();
    const interval = setInterval(() => void refresh(), 5000);
    return () => {
      disposed = true;
      clearInterval(interval);
      controller?.abort();
    };
  }, []);

  const search = query.trim().toLowerCase();
  const filtered = logs.filter((log) =>
    [log.public_ip, log.hostname, log.os, log.target_ip, log.port, log.method]
      .some((value) => value.toLowerCase().includes(search)),
  );
  const targets = new Set(logs.map((log) => log.target_ip)).size;
  const methods = new Set(logs.map((log) => log.method)).size;

  return (
    <main className="mx-auto min-h-screen max-w-[1600px] px-5 py-8 sm:px-10 lg:py-12">
      <header className="flex flex-wrap items-center justify-between gap-6 border-b border-slate-800 pb-8">
        <div>
          <p className="mb-3 text-xs tracking-[0.25em] text-red-400">RED TEAM / SIMULATION TELEMETRY</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl"><span className="text-red-400">▸</span> REDLINE<span className="text-slate-500">_</span></h1>
        </div>
        <div className="flex items-center gap-3 rounded border border-slate-800 bg-slate-950 px-4 py-3 text-xs" role="status" aria-live="polite">
          <span className={`size-2 rounded-full ${status === "live" ? "bg-emerald-400" : status === "offline" ? "bg-red-400" : "bg-amber-400"}`} />
          {status === "live" ? "FEED CONNECTED" : status === "offline" ? "FEED OFFLINE" : "CONNECTING"}
          <span className="border-l border-slate-700 pl-3 text-slate-400">5s POLL</span>
        </div>
      </header>

      <section className="py-9">
        <p className="text-xs text-slate-500">OPERATIONS / OVERVIEW</p>
        <h2 className="mt-3 text-xl font-semibold text-white">Simulation activity</h2>
        <p className="mt-2 text-sm text-slate-400">Incoming host reports. Latest events first.</p>
        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          <article className="rounded-lg border border-red-400/25 bg-red-400/5 p-6">
            <h3 className="text-xs text-red-300">Total Compromised Hosts</h3>
            <p className="my-3 text-4xl font-semibold text-white">{updated ? logs.length.toLocaleString() : "—"}</p>
            <p className="text-xs text-slate-400">Reported events · includes repeat hosts</p>
          </article>
          <article className="rounded-lg border border-slate-800 bg-[#10151b] p-6">
            <h3 className="text-xs text-slate-400">UNIQUE TARGETS</h3>
            <p className="my-3 text-4xl font-semibold text-white">{updated ? targets.toLocaleString() : "—"}</p>
            <p className="text-xs text-slate-500">Distinct target IP addresses</p>
          </article>
          <article className="rounded-lg border border-slate-800 bg-[#10151b] p-6">
            <h3 className="text-xs text-slate-400">OBSERVED METHODS</h3>
            <p className="my-3 text-4xl font-semibold text-emerald-400">{updated ? methods.toLocaleString() : "—"}</p>
            <p className="text-xs text-slate-500">Across received reports</p>
          </article>
        </div>
      </section>

      {status === "offline" && (
        <div role="alert" className="mb-5 rounded border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">
          Connection unavailable. {updated ? "Showing the last successful snapshot." : "No data has been loaded."} Retrying every 5 seconds.
        </div>
      )}

      <section className="overflow-hidden rounded-lg border border-slate-800 bg-[#0c1015]" aria-labelledby="events-heading">
        <div className="flex flex-wrap items-center justify-between gap-5 border-b border-slate-800 p-5">
          <div className="flex items-center gap-3">
            <h2 id="events-heading" className="text-sm font-semibold">EVENT STREAM</h2>
            <span className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-400">{filtered.length}</span>
          </div>
          <label className="flex items-center gap-3 text-xs text-slate-400">
            <span>FILTER</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="IP, hostname, method…" type="search" className="w-56 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-400" />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <caption className="sr-only">Reports received by the CTF webhook, sorted newest first. Times are UTC.</caption>
            <thead className="border-b border-slate-800 bg-slate-900/40 text-xs text-slate-400">
              <tr>{["Time (UTC)", "Source IP (Public)", "Hostname", "Target IP", "Port", "Method"].map((name) => <th key={name} scope="col" className="px-5 py-4 font-medium">{name}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filtered.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/30">
                  <td className="whitespace-nowrap px-5 py-5 text-xs text-slate-500"><time dateTime={log.timestamp}>{new Date(log.timestamp).toISOString().replace("T", " ").slice(0, 19)}</time></td>
                  <td className="px-5 py-5 text-emerald-400">{log.public_ip}</td>
                  <td className="max-w-64 break-words px-5 py-5"><span className="block text-slate-200">{log.hostname}</span><span className="mt-1 block text-xs text-slate-500">{log.os}</span></td>
                  <td className="px-5 py-5 text-slate-300">{log.target_ip}</td>
                  <td className="px-5 py-5 text-slate-400">{log.port}</td>
                  <td className="max-w-64 break-words px-5 py-5"><span className="rounded border border-red-400/20 bg-red-400/5 px-2 py-1 text-xs text-red-300">{log.method}</span></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="px-6 py-20 text-center text-slate-500">{status === "connecting" ? "Connecting to telemetry feed…" : !updated ? "Telemetry is unavailable." : search ? "No events match this filter." : "Listening for the first report…"}</td></tr>}
            </tbody>
          </table>
        </div>
        <footer className="flex flex-wrap justify-between gap-3 border-t border-slate-800 px-5 py-4 text-xs text-slate-500">
          <span>{filtered.length} / {logs.length} EVENTS</span>
          <span>LAST SYNC {updated ? `${updated.toISOString().slice(11, 19)} UTC` : "—"}</span>
        </footer>
      </section>
      <footer className="mt-7 flex flex-wrap justify-between gap-3 text-[11px] tracking-wider text-slate-600"><span>REDLINE / SECURITY OPERATIONS</span><span>CTF SIMULATION</span></footer>
    </main>
  );
}
