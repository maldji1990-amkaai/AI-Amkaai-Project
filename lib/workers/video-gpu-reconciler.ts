import { connection } from "@/lib/redis";
import { reconcileVideoGpu } from "@/lib/runpod-pod-manager";
import { createServer } from "node:http";

if (!connection) throw new Error("REDIS_URL is missing in environment variables");
const redisConnection = connection;
const intervalMs = Math.max(10_000, Number(process.env.VIDEO_RECONCILE_INTERVAL_MS || 60_000));
const healthPort = Number(process.env.VIDEO_RECONCILER_HEALTH_PORT || 0);
let lastResult: unknown = null;
let lastError: string | null = null;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try { lastResult = await reconcileVideoGpu(); lastError = null; }
  catch (error) { lastError = String(error); console.error("GPU RECONCILER ERROR", error); }
  finally { running = false; }
}

const timer = setInterval(() => void tick(), intervalMs);
void tick();

let server: ReturnType<typeof createServer> | null = null;
if (healthPort > 0) {
  server = createServer((_req, res) => {
    const ok = !lastError;
    res.writeHead(ok ? 200 : 503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok, service: "video-gpu-reconciler", lastResult, lastError, pid: process.pid, uptime: process.uptime() }));
  });
  server.listen(healthPort, "0.0.0.0", () => console.log(`GPU reconciler health listening on :${healthPort}`));
}

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`GPU reconciler shutting down (${signal})`);
  clearInterval(timer);
  server?.close();
  await redisConnection.quit().catch(() => undefined);
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("uncaughtException", error => { console.error("GPU reconciler uncaughtException", error); void shutdown("uncaughtException"); });
process.on("unhandledRejection", error => console.error("GPU reconciler unhandledRejection", error));

console.log(`AmkaAI GPU reconciler started interval=${intervalMs}ms`);
