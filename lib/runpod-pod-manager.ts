import { getRedisConnection } from "@/lib/redis";
import { getVideoQueue } from "@/lib/queues/video.queue";

const RUNPOD_REST_BASE = "https://rest.runpod.io/v1";
const STATE_KEY = "amkaai:runpod:video-gpu:v1";
const LOCK_KEY = "amkaai:runpod:video-gpu:lock:v1";
const ACTIVE_KEY = "amkaai:runpod:video-gpu:active:v1";
const DEFAULT_GPU = "NVIDIA GeForce RTX 4090";
const DEFAULT_PORT = 8000;
const DEFAULT_GENERATE_PATH = "/generate";
const DEFAULT_HEALTH_PATH = "/health";
const DEFAULT_IDLE_GRACE_MS = 5 * 60 * 1000;
const DEFAULT_READY_TIMEOUT_MS = 20 * 60 * 1000;

export type RunpodPodState = {
  podId: string;
  baseUrl: string;
  createdAt: string;
  lastActiveAt: string;
  idleAfter?: string;
};

function redis() {
  const client = getRedisConnection();
  return client;
}

function apiKey() {
  const key = process.env.RUNPOD_API_KEY;
  if (!key) throw new Error("RUNPOD_API_KEY_MISSING");
  return key;
}

async function runpodFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${RUNPOD_REST_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) throw new Error(`RUNPOD_API_${response.status}:${typeof body === "string" ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500)}`);
  return body as T;
}

function podPort() {
  const port = Number(process.env.RUNPOD_POD_HTTP_PORT || DEFAULT_PORT);
  return Number.isInteger(port) && port > 0 ? port : DEFAULT_PORT;
}

function podGeneratePath() {
  const value = process.env.RUNPOD_POD_GENERATE_PATH || DEFAULT_GENERATE_PATH;
  return value.startsWith("/") ? value : `/${value}`;
}

function podHealthPath() {
  const value = process.env.RUNPOD_POD_HEALTH_PATH || DEFAULT_HEALTH_PATH;
  return value.startsWith("/") ? value : `/${value}`;
}

function buildProxyUrl(podId: string) {
  return `https://${podId}-${podPort()}.proxy.runpod.net`;
}

async function readState() {
  const raw = await redis().get(STATE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as RunpodPodState; } catch { return null; }
}

async function writeState(state: RunpodPodState) {
  await redis().set(STATE_KEY, JSON.stringify(state));
}

async function acquireLock() {
  const token = crypto.randomUUID();
  const ok = await redis().set(LOCK_KEY, token, "PX", 120_000, "NX");
  if (ok === "OK") return token;
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 500));
    const retry = await redis().set(LOCK_KEY, token, "PX", 120_000, "NX");
    if (retry === "OK") return token;
  }
  throw new Error("RUNPOD_GPU_LOCK_TIMEOUT");
}

async function releaseLock(token: string) {
  const script = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`;
  await redis().eval(script, 1, LOCK_KEY, token).catch(() => undefined);
}

async function getPod(podId: string) {
  return runpodFetch<any>(`/pods/${encodeURIComponent(podId)}`);
}

async function createPod() {
  const templateId = process.env.RUNPOD_POD_TEMPLATE_ID;
  const imageName = process.env.RUNPOD_POD_IMAGE;
  if (!templateId && !imageName) throw new Error("RUNPOD_POD_TEMPLATE_ID_OR_IMAGE_MISSING");

  const gpuTypeIds = [process.env.RUNPOD_GPU_TYPE || DEFAULT_GPU];
  const port = podPort();
  const body: Record<string, unknown> = {
    name: process.env.RUNPOD_POD_NAME || "amkaai-video-4090",
    gpuTypeIds,
    gpuCount: 1,
    containerDiskInGb: Number(process.env.RUNPOD_POD_CONTAINER_DISK_GB || 50),
    volumeInGb: Number(process.env.RUNPOD_POD_VOLUME_GB || 40),
    ports: [`${port}/http`],
    cloudType: process.env.RUNPOD_CLOUD_TYPE || "COMMUNITY",
    computeType: "GPU",
  };
  if (templateId) body.templateId = templateId;
  else if (imageName) body.imageName = imageName;
  if (process.env.RUNPOD_POD_DOCKER_START_CMD) body.dockerStartCmd = process.env.RUNPOD_POD_DOCKER_START_CMD.split(" ").filter(Boolean);
  if (process.env.RUNPOD_POD_DOCKER_ENTRYPOINT) body.dockerEntrypoint = process.env.RUNPOD_POD_DOCKER_ENTRYPOINT.split(" ").filter(Boolean);
  if (process.env.RUNPOD_POD_VOLUME_MOUNT_PATH) body.volumeMountPath = process.env.RUNPOD_POD_VOLUME_MOUNT_PATH;

  const envJson = process.env.RUNPOD_POD_ENV_JSON;
  if (envJson) {
    try { body.env = JSON.parse(envJson); } catch { throw new Error("RUNPOD_POD_ENV_JSON_INVALID"); }
  }

  return runpodFetch<any>("/pods", { method: "POST", body: JSON.stringify(body) });
}

async function waitForReady(podId: string) {
  const deadline = Date.now() + Number(process.env.RUNPOD_POD_READY_TIMEOUT_MS || DEFAULT_READY_TIMEOUT_MS);
  const baseUrl = buildProxyUrl(podId);
  while (Date.now() < deadline) {
    const pod = await getPod(podId).catch(() => null);
    if (pod?.desiredStatus === "TERMINATED") throw new Error("RUNPOD_POD_TERMINATED");
    if (pod?.desiredStatus === "RUNNING") {
      try {
        const health = await fetch(`${baseUrl}${podHealthPath()}`, { method: "GET", cache: "no-store", signal: AbortSignal.timeout(5000) });
        if (health.ok) return { pod, baseUrl };
      } catch { /* container is still booting */ }
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
      if (pod?.desiredStatus === "RUNNING") {
        const ready = await waitForReady(state.podId);
        state = { ...state, baseUrl: ready.baseUrl, lastActiveAt: new Date().toISOString(), idleAfter: undefined };
        await writeState(state);
        return state;
      }
      if (pod?.desiredStatus === "EXITED") {
        await runpodFetch(`/pods/${encodeURIComponent(state.podId)}/start`, { method: "POST" });
        const ready = await waitForReady(state.podId);
        state = { ...state, baseUrl: ready.baseUrl, lastActiveAt: new Date().toISOString(), idleAfter: undefined };
        await writeState(state);
        return state;
      }
      await redis().del(STATE_KEY);
      state = null;
    }

    const pod = await createPod();
    if (!pod?.id) throw new Error("RUNPOD_POD_ID_MISSING");
    const ready = await waitForReady(String(pod.id));
    state = {
      podId: String(pod.id),
      baseUrl: ready.baseUrl,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };
    await writeState(state);
    return state;
  } finally {
    await releaseLock(token);
  }
}

export async function acquireVideoGpu() {
  const state = await ensureVideoGpuReady();
  await redis().incr(ACTIVE_KEY);
  await writeState({ ...state, lastActiveAt: new Date().toISOString(), idleAfter: undefined });
  return state;
}

export async function releaseVideoGpu() {
  const client = redis();
  const value = await client.decr(ACTIVE_KEY);
  if (value < 0) await client.set(ACTIVE_KEY, "0");
  const state = await readState();
  if (state) await writeState({ ...state, lastActiveAt: new Date().toISOString(), idleAfter: new Date(Date.now() + Number(process.env.RUNPOD_GPU_IDLE_GRACE_MS || DEFAULT_IDLE_GRACE_MS)).toISOString() });
  await stopIfIdle();
}

export async function stopIfIdle(force = false) {
  const state = await readState();
  if (!state) return false;
  const active = Number(await redis().get(ACTIVE_KEY) || 0);
  if (active > 0 && !force) return false;
  const queue = getVideoQueue();
  const counts = await queue.getJobCounts("waiting", "delayed", "active", "prioritized").catch(() => ({ waiting: 0, delayed: 0, active: 0, prioritized: 0 }));
  if (!force && (counts.waiting + counts.delayed + counts.active + counts.prioritized) > 0) return false;
  const idleAfter = state.idleAfter ? Date.parse(state.idleAfter) : Date.now() + Number(process.env.RUNPOD_GPU_IDLE_GRACE_MS || DEFAULT_IDLE_GRACE_MS);
  if (!force && Date.now() < idleAfter) return false;

  const token = await acquireLock();
  try {
    const latest = await readState();
    if (!latest || latest.podId !== state.podId) return false;
    const currentActive = Number(await redis().get(ACTIVE_KEY) || 0);
    if (currentActive > 0 && !force) return false;
    await runpodFetch(`/pods/${encodeURIComponent(latest.podId)}`, { method: "DELETE" });
    await redis().del(STATE_KEY);
    return true;
  } finally {
    await releaseLock(token);
  }
}

export async function submitVideoToPod(payload: Record<string, unknown>) {
  const state = await acquireVideoGpu();
  try {
    const response = await fetch(`${state.baseUrl}${podGeneratePath()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(Number(process.env.RUNPOD_POD_REQUEST_TIMEOUT_MS || 30_000)),
    });
    const text = await response.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!response.ok) throw new Error(`RUNPOD_POD_GENERATE_${response.status}:${typeof data === "string" ? data.slice(0, 500) : JSON.stringify(data).slice(0, 500)}`);
    const id = typeof data?.id === "string" ? data.id : typeof data?.job_id === "string" ? data.job_id : null;
    if (!id) throw new Error("RUNPOD_POD_JOB_ID_MISSING");
    return { id, data, podId: state.podId, baseUrl: state.baseUrl };
  } catch (error) {
    await releaseVideoGpu();
    throw error;
  }
}

export async function cancelVideoOnPod(podId: string | null, externalJobId: string) {
  const state = await readState();
  if (!podId || !state || state.podId !== podId) return false;
  const cancelPath = (process.env.RUNPOD_POD_CANCEL_PATH || "/cancel").replace(/\/$/, "");
  try {
    const response = await fetch(`${state.baseUrl}${cancelPath}/${encodeURIComponent(externalJobId)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
    });
    return response.ok;
  } finally {
    await releaseVideoGpu().catch(() => undefined);
  }
}

export async function reconcileVideoGpu() {
  const state = await readState();
  if (!state) return;
  const activeDb = await (await import("@/lib/db")).db.videoJob.count({ where: { status: "PROCESSING", externalJobId: { not: null } } }).catch(() => 0);
  const active = Number(await redis().get(ACTIVE_KEY) || 0);
  if (activeDb === 0 && active > 0) await redis().set(ACTIVE_KEY, "0");
  await stopIfIdle();
}
