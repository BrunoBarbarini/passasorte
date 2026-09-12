#!/usr/bin/env node
/**
 * TASK-062 Load Test — read-path smoke load test for apps/api.
 *
 * Unlike most of Phase 8b, this script is meant to be RUN FOR REAL by the
 * user against their own local apps/api (the one manually verified working
 * in this same session: GET /health, GET /api/v1/campaigns,
 * GET /api/v1/merchants/:id all returned real responses).
 *
 * Requires `autocannon` (added to the root package.json devDependencies —
 * run `pnpm install` yourself on your Mac, not via this session, per the
 * platform-mismatch lesson learned this session).
 *
 * Usage (from repo root, with apps/api running locally):
 *   node scripts/load-test/campaigns-read.js
 *   node scripts/load-test/campaigns-read.js --url http://localhost:3000 --duration 30 --connections 10
 */

const autocannon = require("autocannon");

function parseArgs(argv) {
  const args = { url: "http://localhost:3000", duration: 20, connections: 10 };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--url") args.url = argv[++i];
    else if (argv[i] === "--duration") args.duration = Number(argv[++i]);
    else if (argv[i] === "--connections") args.connections = Number(argv[++i]);
  }
  return args;
}

async function main() {
  const { url, duration, connections } = parseArgs(process.argv.slice(2));

  console.log(
    `[load-test] targeting ${url} — ${connections} connections for ${duration}s\n` +
      "[load-test] exercising GET /health and GET /api/v1/campaigns (read-only, no state mutated)",
  );

  const result = await autocannon({
    url,
    connections,
    duration,
    requests: [{ method: "GET", path: "/health" }, { method: "GET", path: "/api/v1/campaigns" }],
  });

  console.log(autocannon.printResult(result));

  const errorRate = (result.errors + result.non2xx) / result.requests.total;
  console.log(`\n[load-test] error rate: ${(errorRate * 100).toFixed(2)}%`);
  console.log(`[load-test] p95 latency: ${result.latency.p95}ms — compare against docs/slo/slos.md's proposed 500ms target`);

  if (errorRate > 0.01) {
    console.error("[load-test] FAIL — error rate above 1%");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[load-test] failed to run:", error);
  process.exitCode = 1;
});
