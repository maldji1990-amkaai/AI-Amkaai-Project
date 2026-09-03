import { getRedisConnection } from "@/lib/redis";
import { getVideoQueue } from "@/lib/queues/video.queue";

const RUNPOD_REST_BASE = "https://rest.runpod.io/v1";
const STATE_KEY = "amkaai:runpod:video-gpu:v2";
const LOCK_KEY = "amkaai:runpod:video-gpu:lock:v2";
const ACTIVE_SET_KEY = "amkaai:runpod:video-gpu:active-jobs:v2";
const DISPATCH_SET_KEY = "amkaai:runpod:video-gpu:dispatch-leases:v2";
const DEFAULT_GPUS = [
  "NVIDIA GeForce RTX 4090",
  "NVIDIA GeForce RTX 3090",
  "NVIDIA L40S",
  "NVIDIA RTX 6000 Ada Generation",
  "NVIDIA RTX A6000",
  "NVIDIA RTX A5000",
  "NVIDIA L4",
];
const DEFAULT_PORT = 8000;
const DEFAULT_GENERATE_PATH = "/generate";
const DEFAULT_HEALTH_PATH = "/health";
const DEFAULT_CANCEL_PATH = "/cancel";
const DEFAULT_STATUS_PATH = "/status";
const DEFAULT_IDLE_GRACE_MS = 5 * 60 * 1000;
const DEFAULT_READY_TIMEOUT_MS = 20 * 60 * 1000;
const DEFAULT_DISPATCH_LEASE_TTL_MS = 2 * 60 * 60 * 1000;

export type RunpodPodState = {
  podId: string;
  baseUrl: string;
  createdAt: string;
  lastActiveAt: string;
  idleAfter?: string;
};

function redis() { return getRedisConnection(); }
function apiKey() {
  const key = process.env.RUNPOD_API_KEY;
  if (!key) throw new Error("RUNPOD_API_KEY_MISSING");
  return key;
}

async function runpodFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${RUNPOD_REST_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json", ...(init.headers || {}) },
    cache: "no-store",
  });
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) throw new Error(`RUNPOD_API_${response.status}:${typeof body === "string" ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500)}`);
  return body as T;
}

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
function podPort() { return Math.trunc(envNumber("RUNPOD_POD_HTTP_PORT", DEFAULT_PORT)); }
function pathEnv(name: string, fallback: string) {
  const value = process.env[name] || fallback;
  return value.startsWith("/") ? value : `/${value}`;
}
function podGeneratePath() { return pathEnv("RUNPOD_POD_GENERATE_PATH", DEFAULT_GENERATE_PATH); }
function podHealthPath() { return pathEnv("RUNPOD_POD_HEALTH_PATH", DEFAULT_HEALTH_PATH); }
function podCancelPath() { return pathEnv("RUNPOD_POD_CANCEL_PATH", DEFAULT_CANCEL_PATH).replace(/\/$/, ""); }
function podStatusPath() { return pathEnv("RUNPOD_POD_STATUS_PATH", DEFAULT_STATUS_PATH).replace(/\/$/, ""); }
function buildProxyUrl(podId: string) { return `https://${podId}-${podPort()}.proxy.runpod.net`; }

async function readState() {
  const raw = await redis().get(STATE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as RunpodPodState; } catch { return null; }
}
async function writeState(state: RunpodPodState) { await redis().set(STATE_KEY, JSON.stringify(state)); }

async function acquireLock() {
  const token = crypto.randomUUID();
  const ttl = envNumber("RUNPOD_MANAGER_LOCK_TTL_MS", 120_000);
  const client = redis();
  for (let attempt = 0; attempt < 240; attempt++) {
    const ok = await client.set(LOCK_KEY, token, "PX", ttl, "NX");
    if (ok === "OK") return token;
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error("RUNPOD_GPU_LOCK_TIMEOUT");
}
async function releaseLock(token: string) {
  const script = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`;
  await redis().eval(script, 1, LOCK_KEY, token).catch(() => undefined);
}

async function getPod(podId: string) { return runpodFetch<any>(`/pods/${encodeURIComponent(podId)}`); }

async function createPod() {
  const templateId = process.env.RUNPOD_POD_TEMPLATE_ID;
  const imageName = process.env.RUNPOD_POD_IMAGE;
  if (!templateId && !imageName) throw new Error("RUNPOD_POD_TEMPLATE_ID_OR_IMAGE_MISSING");
  const port = podPort();
  const body: Record<string, unknown> = {
    name: process.env.RUNPOD_POD_NAME || "amkaai-video-4090",
    gpuTypeIds: process.env.RUNPOD_GPU_TYPES
      ? process.env.RUNPOD_GPU_TYPES.split(",").map(s => s.trim()).filter(Boolean)
      : DEFAULT_GPUS,
    gpuCount: 1,
    containerDiskInGb: Math.trunc(envNumber("RUNPOD_POD_CONTAINER_DISK_GB", 50)),
    volumeInGb: Math.trunc(envNumber("RUNPOD_POD_VOLUME_GB", 80)),
    volumeMountPath: process.env.RUNPOD_POD_VOLUME_MOUNT_PATH || "/workspace",
    ports: [`${port}/http`],
    cloudType: process.env.RUNPOD_CLOUD_TYPE || "COMMUNITY",
    computeType: "GPU",
  };
  if (process.env.RUNPOD_NETWORK_VOLUME_ID) {
    body.networkVolumeId = process.env.RUNPOD_NETWORK_VOLUME_ID;
  }
  if (templateId) body.templateId = templateId; else body.imageName = imageName;
  if (process.env.RUNPOD_POD_DOCKER_START_CMD) body.dockerStartCmd = process.env.RUNPOD_POD_DOCKER_START_CMD.split(" ").filter(Boolean);
  if (process.env.RUNPOD_POD_DOCKER_ENTRYPOINT) body.dockerEntrypoint = process.env.RUNPOD_POD_DOCKER_ENTRYPOINT.split(" ").filter(Boolean);
  if (process.env.RUNPOD_POD_ENV_JSON) {
    try { body.env = JSON.parse(process.env.RUNPOD_POD_ENV_JSON); } catch { throw new Error("RUNPOD_POD_ENV_JSON_INVALID"); }
  }
  return runpodFetch<any>("/pods", { method: "POST", body: JSON.stringify(body) });
}

async function waitForReady(podId: string) {
  const deadline = Date.now() + envNumber("RUNPOD_POD_READY_TIMEOUT_MS", DEFAULT_READY_TIMEOUT_MS);
  const baseUrl = buildProxyUrl(podId);
  while (Date.now() < deadline) {
    const pod = await getPod(podId).catch(() => null);
    const desired = String(pod?.desiredStatus || "").toUpperCase();
    if (["TERMINATED", "EXITED", "FAILED"].includes(desired)) throw new Error(`RUNPOD_POD_${desired}`);
    if (desired === "RUNNING") {
      try {
        const health = await fetch(`${baseUrl}${podHealthPath()}`, { method: "GET", cache: "no-store", signal: AbortSignal.timeout(5000) });
        if (health.ok) return { pod, baseUrl };
      } catch { /* booting */ }
    }
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error("RUNPOD_POD_READY_TIMEOUT");
}

export async function ensureVideoGpuReady() {
  if (process.env.RUNPOD_DIRECT_POD_ENABLED !== "true") throw new Error("RUNPOD_DIRECT_POD_DISABLED");
  const token = await acquireLock();
  try {
    let state = await readState();
    if (state) {
      const pod = await getPod(state.podId).catch(() => null);
      const desired = String(pod?.desiredStatus || "").toUpperCase();
      if (desired === "RUNNING") {
        const ready = await waitForReady(state.podId);
        state = { ...state, baseUrl: ready.baseUrl, lastActiveAt: new Date().toISOString(), idleAfter: undefined };
        await writeState(state);
        return state;
      }
      if (desired === "EXITED") {
        await runpodFetch(`/pods/${encodeURIComponent(state.podId)}/start`, { method: "POST" });
        const ready = await waitForReady(state.podId);
        state = { ...state, baseUrl: ready.baseUrl, lastActiveAt: new Date().toISOString(), idleAfter: undefined };
        await writeState(state);
        return state;
      }
      await redis().del(STATE_KEY);
    }
    const pod = await createPod();
    if (!pod?.id) throw new Error("RUNPOD_POD_ID_MISSING");
    const ready = await waitForReady(String(pod.id));
    state = { podId: String(pod.id), baseUrl: ready.baseUrl, createdAt: new Date().toISOString(), lastActiveAt: new Date().toISOString() };
    await writeState(state);
    return state;
  } finally { await releaseLock(token); }
}

export async function acquireVideoGpu(leaseId: string) {
  if (!leaseId) throw new Error("RUNPOD_GPU_LEASE_ID_MISSING");
  const state = await ensureVideoGpuReady();
  await redis().sadd(ACTIVE_SET_KEY, leaseId);
  await writeState({ ...state, lastActiveAt: new Date().toISOString(), idleAfter: undefined });
  return state;
}

export async function releaseVideoGpu(leaseId: string) {
  if (!leaseId) return;
  const client = redis();
  await client.srem(ACTIVE_SET_KEY, leaseId);
  const state = await readState();
  if (state) {
    await writeState({ ...state, lastActiveAt: new Date().toISOString(), idleAfter: new Date(Date.now() + envNumber("RUNPOD_GPU_IDLE_GRACE_MS", DEFAULT_IDLE_GRACE_MS)).toISOString() });
  }
  await stopIfIdle();
}

async function queueHasWork() {
  const queue = getVideoQueue();
  const counts = await queue.getJobCounts("waiting", "delayed", "active", "prioritized", "waiting-children").catch(() => ({ waiting: 0, delayed: 0, active: 0, prioritized: 0, "waiting-children": 0 }));
  return Object.values(counts).some(value => Number(value) > 0);
}

export async function stopIfIdle(force = false) {
  const state = await readState();
  if (!state) return false;
  const client = redis();
  const activeLeases = await client.scard(ACTIVE_SET_KEY);
  const queueBusy = await queueHasWork();
  if (!force && (activeLeases > 0 || queueBusy)) return false;
  const idleAfter = state.idleAfter ? Date.parse(state.idleAfter) : Date.now() + envNumber("RUNPOD_GPU_IDLE_GRACE_MS", DEFAULT_IDLE_GRACE_MS);
  if (!force && Date.now() < idleAfter) return false;
  const token = await acquireLock();
  try {
    const latest = await readState();
    if (!latest || latest.podId !== state.podId) return false;
    const latestActive = await client.scard(ACTIVE_SET_KEY);
    if (!force && (latestActive > 0 || await queueHasWork())) return false;
    await runpodFetch(`/pods/${encodeURIComponent(latest.podId)}`, { method: "DELETE" });
    await client.del(STATE_KEY, ACTIVE_SET_KEY);
    return true;
  } finally { await releaseLock(token); }
}

export async function markDispatchLease(videoJobId: string) {
  const ttl = envNumber("RUNPOD_DISPATCH_LEASE_TTL_MS", DEFAULT_DISPATCH_LEASE_TTL_MS);
  const key = `${DISPATCH_SET_KEY}:${videoJobId}`;
  const client = redis();
  const ok = await client.set(key, "1", "PX", ttl, "NX");
  if (ok !== "OK") throw new Error("VIDEO_DISPATCH_IN_FLIGHT");
  await client.sadd(DISPATCH_SET_KEY, videoJobId);
  return key;
}
export async function clearDispatchLease(videoJobId: string) {
  await redis().del(`${DISPATCH_SET_KEY}:${videoJobId}`);
  await redis().srem(DISPATCH_SET_KEY, videoJobId);
}
export async function hasDispatchLease(videoJobId: string) { return Boolean(await redis().exists(`${DISPATCH_SET_KEY}:${videoJobId}`)); }

export async function submitVideoToPod(payload: Record<string, unknown>, leaseId: string) {
  const state = await acquireVideoGpu(leaseId);
  const videoJobId = String(payload.job_id || leaseId);
  try {
    await markDispatchLease(videoJobId);
    const response = await fetch(`${state.baseUrl}${podGeneratePath()}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), cache: "no-store",
      signal: AbortSignal.timeout(envNumber("RUNPOD_POD_REQUEST_TIMEOUT_MS", 30_000)),
    });
    const text = await response.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!response.ok) throw new Error(`RUNPOD_POD_GENERATE_${response.status}:${typeof data === "string" ? data.slice(0, 500) : JSON.stringify(data).slice(0, 500)}`);
    const id = typeof data?.id === "string" ? data.id : typeof data?.job_id === "string" ? data.job_id : null;
    if (!id) throw new Error("RUNPOD_POD_JOB_ID_MISSING");
    return { id, data, podId: state.podId, baseUrl: state.baseUrl };
  } catch (error) {
    await clearDispatchLease(videoJobId).catch(() => undefined);
    await releaseVideoGpu(leaseId).catch(() => undefined);
    throw error;
  }
}

export async function cancelVideoOnPod(podId: string | null, externalJobId: string, leaseId: string) {
  try {
    const state = await readState();
    if (!podId || !state || state.podId !== podId) return false;
    const response = await fetch(`${state.baseUrl}${podCancelPath()}/${encodeURIComponent(externalJobId)}`, { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store" });
    return response.ok;
  } finally {
    await clearDispatchLease(leaseId).catch(() => undefined);
    await releaseVideoGpu(leaseId).catch(() => undefined);
  }
}

export async function releaseCompletedVideoLease(videoJobId: string) {
  await clearDispatchLease(videoJobId).catch(() => undefined);
  await releaseVideoGpu(videoJobId).catch(() => undefined);
}

export async function recoverPendingVideoJobs() {
  const { db } = await import("@/lib/db");
  const { enqueueVideoJob } = await import("@/lib/queues/video.queue");
  const cutoff = new Date(Date.now() - envNumber("VIDEO_PENDING_RECOVERY_AFTER_MS", 2 * 60 * 1000));
  const jobs = await db.videoJob.findMany({
    where: { status: "PENDING", externalJobId: null, createdAt: { lt: cutoff } },
    orderBy: { createdAt: "asc" },
    take: 25,
    select: { id: true, priority: true },
  });
  let recovered = 0;
  for (const job of jobs) {
    if (await hasDispatchLease(job.id)) continue;
    const queue = getVideoQueue();
    const queued = await queue.getJob(job.id).catch(() => null);
    if (queued && !["failed", "completed"].includes(await queued.getState())) continue;
    await enqueueVideoJob(job.id, job.priority).catch(() => undefined);
    recovered++;
  }
  return recovered;
}

export async function reconcileVideoGpu() {
  const recovered = await recoverPendingVideoJobs().catch(() => 0);
  const state = await readState();
  if (!state) return { active: 0, queueBusy: false, stopped: false, recovered };
  const { db } = await import("@/lib/db");
  const processing = await db.videoJob.findMany({ where: { status: "PROCESSING", externalJobId: { not: null } }, select: { id: true } }).catch(() => [] as { id: string }[]);
  const client = redis();
  const processingIds = new Set(processing.map(job => job.id));
  const activeIds = await client.smembers(ACTIVE_SET_KEY);
  for (const id of activeIds) if (!processingIds.has(id)) await client.srem(ACTIVE_SET_KEY, id);
  for (const job of processing) await client.sadd(ACTIVE_SET_KEY, job.id);
  const stopped = await stopIfIdle();
  return { active: await client.scard(ACTIVE_SET_KEY), queueBusy: await queueHasWork(), stopped, recovered };
}

export async function getRunpodGpuStatus() {
  const state = await readState();
  if (!state) return { state: null, pod: null, health: false };
  const pod = await getPod(state.podId).catch(() => null);
  let health = false;
  try { const response = await fetch(`${state.baseUrl}${podHealthPath()}`, { cache: "no-store", signal: AbortSignal.timeout(5000) }); health = response.ok; } catch { /* unavailable */ }
  return { state, pod, health };
}

export async function queryVideoJobOnPod(podId: string, externalJobId: string) {
  const state = await readState();
  if (!state || state.podId !== podId) return null;
  try {
    const response = await fetch(`${state.baseUrl}${podStatusPath()}/${encodeURIComponent(externalJobId)}`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    return await response.json();
  } catch { return null; }
}