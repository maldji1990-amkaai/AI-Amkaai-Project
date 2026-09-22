const RUNPOD_SERVERLESS_BASE = "https://api.runpod.ai/v2";

function apiKey() {
  const key = process.env.RUNPOD_API_KEY;
  if (!key) throw new Error("RUNPOD_API_KEY_MISSING");
  return key;
}

function endpointId() {
  const id = process.env.RUNPOD_SERVERLESS_ENDPOINT_ID;
  if (!id) throw new Error("RUNPOD_SERVERLESS_ENDPOINT_ID_MISSING");
  return id;
}

async function runpodServerlessFetch<T = any>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(
    `${RUNPOD_SERVERLESS_BASE}/${endpointId()}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
      cache: "no-store",
    },
  );

  const text = await response.text();

  let body: any = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    throw new Error(
      `RUNPOD_SERVERLESS_API_${response.status}:${
        typeof body === "string"
          ? body.slice(0, 500)
          : JSON.stringify(body).slice(0, 500)
      }`,
    );
  }

  return body as T;
}

export async function submitVideoToServerless(
  payload: Record<string, unknown>,
) {
  const response = await runpodServerlessFetch<{
    id?: string;
    status?: string;
    error?: string;
  }>("/run", {
    method: "POST",
    body: JSON.stringify({
      input: payload,
    }),
  });

  if (!response?.id) {
    throw new Error("RUNPOD_SERVERLESS_JOB_ID_MISSING");
  }

  return {
    id: String(response.id),
    status: response.status || "IN_QUEUE",
    data: response,
  };
}