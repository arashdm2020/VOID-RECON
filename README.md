# REDLINE — CTF reporting dashboard

Next.js App Router, TypeScript, Tailwind CSS and a server-side Redis REST client.

## File structure

```text
app/
  api/
    report/route.ts       POST webhook with background persistence
    logs/route.ts         Uncached GET array of reports
  globals.css            Tailwind import and terminal theme
  layout.tsx             Root layout and metadata
  page.tsx               Dashboard with five-second polling
lib/
  kv.ts                  LPUSH / LRANGE on infection_logs
  report.ts              Shared types and runtime validation
tests/routes.test.ts     Webhook and read failure tests
tests/kv.test.ts         Redis command and configuration tests
.env.example
.gitignore
next-env.d.ts
package.json
package-lock.json
postcss.config.mjs
tsconfig.json
vitest.config.ts
README.md
```

## Local development

Use Node.js 22 or newer. Run `npm install`, copy `.env.example` to `.env.local`, and set these values locally:

```dotenv
UPSTASH_REDIS_REST_URL=<Redis REST endpoint>
UPSTASH_REDIS_REST_TOKEN=<Redis REST read/write token>
```

Never use a `NEXT_PUBLIC_` prefix for either value. Then run:

```sh
npm run dev
```

Open http://localhost:3000. Without Redis configuration the UI explicitly shows an offline state. The application does not seed fake reports.

## Storage

The maintained `@upstash/redis` SDK connects to Upstash Redis through the Vercel Marketplace, the replacement for Vercel KV. The app automatically accepts `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`, or the original `KV_REST_API_URL` + `KV_REST_API_TOKEN` as a fallback. A complete Upstash pair takes precedence; credentials from different pairs are never mixed. Existing Vercel KV variables continue to work without renaming.

`lib/kv.ts` lazily creates a server-only client and stores JSON objects directly:

```ts
await getKV().lpush("infection_logs", log);
return getKV().lrange<InfectionLog>("infection_logs", 0, -1);
```

The SDK serializes/deserializes the objects. LPUSH orders records by insertion, newest first. All six submitted fields are preserved; the server adds a UUID `id` and UTC ISO `timestamp`. No local database is used. Automatic write retries are disabled to avoid duplicating LPUSH after an ambiguous network failure.

## Webhook behavior

POST `/api/report` accepts six non-empty strings, each at most 512 characters:

```json
{
  "public_ip": "192.0.2.10",
  "hostname": "ctf-node-01",
  "os": "Linux",
  "target_ip": "10.0.0.20",
  "port": "443",
  "method": "simulation"
}
```

After reading and validating the body, the handler returns HTTP 200 with `{ "accepted": true, "id": "..." }` without waiting for Redis. `after()` keeps the write alive after the response on Vercel, within the 30-second function budget. Invalid JSON or schema returns HTTP 200 with `accepted: false` and a short error, and is discarded.

This is best-effort delivery: 200 acknowledges acceptance, not durable storage. Background writes can still fail or time out, and failures appear in Vercel function logs with the report ID. Guaranteed delivery requires awaiting durable persistence or a durable queue before acknowledging. Network upload time, cold starts, and platform request limits still apply; the handler cannot guarantee 200 for requests rejected before it runs.

GET `/api/logs` returns a JSON array (including `[]` for an empty database), with `Cache-Control: no-store`. Redis failures return 503. The UI retains its last successful snapshot, marks the feed offline, and retries; overlapping requests are skipped and fetches time out after eight seconds.

The requested **Total Compromised Hosts** card is exactly `logs.length`: it counts reports, including repeated hosts. The UI labels this explicitly. The list has no automatic retention or pagination, so it suits a bounded CTF; all records are retrieved every five seconds.

## Deploy to Vercel

**Recommended: Vercel + Upstash Redis through Marketplace.** Vercel hosts Next.js and Upstash supplies managed Redis over HTTPS; no Redis server installation or manual credential copying is needed when the integration is connected. Use the default environment-variable prefix when connecting the integration.

[Import VOID-RECON into Vercel](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Farashdm2020%2FVOID-RECON) · [Upstash integration](https://vercel.com/marketplace/upstash)

1. Put these files in your Git repository and push it to your Git provider.
2. In Vercel, choose **Add New → Project**, import the repository, and select the **Next.js** preset. Use the folder containing `package.json` as the root directory. The build command is `npm run build`; keep the default output directory.
3. In the project's **Storage** section, choose **Create Database → Upstash Redis** from Marketplace. Create a database, review the offered plan, and connect it to this project for the intended environments. Use a separate database for this simulation.
4. The integration injects the Redis environment variables automatically. Both standard `UPSTASH_REDIS_REST_*` and legacy `KV_REST_API_*` pairs are supported by this app. Keep the default prefix; do not copy tokens into source code. If using an external database instead, configure one complete pair manually in **Project Settings → Environment Variables**.
5. Deploy. Redeploy after any environment-variable changes. The dashboard is at `/`, the receiver at `/api/report`, and the reader at `/api/logs` on your deployment domain.
6. Send the example below to your deployment, then confirm the row appears and the count increases after the next poll. If not, inspect function logs for `[report] Redis write failed` or `[logs] Redis read failed`.

These routes implement the requested unauthenticated CTF contract: anyone who can reach them can submit reports or read them. Apply your event's access controls before using non-public telemetry. Vercel deployment protection must also allow your intended webhook client.

PowerShell smoke request (replace only the deployment URL):

```powershell
$report = @{
  public_ip = '192.0.2.10'
  hostname = 'ctf-node-01'
  os = 'Linux'
  target_ip = '10.0.0.20'
  port = '443'
  method = 'simulation'
} | ConvertTo-Json
Invoke-RestMethod -Uri 'https://YOUR-PROJECT.vercel.app/api/report' -Method Post -ContentType 'application/json' -Body $report
```

## Checks

```sh
npm test
npm run typecheck
npm run build
```

Route tests mock Redis and the post-response scheduler. They do not verify live Redis connectivity or Vercel deployment behavior.

## References

- [Next.js after()](https://nextjs.org/docs/app/api-reference/functions/after)
- [Redis on Vercel](https://vercel.com/docs/redis)
- [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)
