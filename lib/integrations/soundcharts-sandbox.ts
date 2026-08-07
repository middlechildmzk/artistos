import "server-only";

const SOUNDCHARTS_SANDBOX_ORIGIN = "https://customer.api.soundcharts.com";
const SOUNDCHARTS_SANDBOX_APP_ID = "soundcharts";
const SOUNDCHARTS_SANDBOX_API_KEY = "soundcharts";
const MAX_RESPONSE_BYTES = 2_000_000;

const ALLOWED_SANDBOX_PATHS = [
  /^\/api\/v2\/artist\/search\/[A-Za-z0-9%._~-]+(?:\?.*)?$/,
  /^\/api\/v2\.25\/song\/by-isrc\/[A-Za-z0-9%._~-]+(?:\?.*)?$/,
] as const;

function assertAllowedSandboxPath(path: string) {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("soundcharts_sandbox_path_invalid");
  if (!ALLOWED_SANDBOX_PATHS.some((pattern) => pattern.test(path))) {
    throw new Error("soundcharts_sandbox_path_not_allowed");
  }
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function largestArrayLength(value: unknown): number {
  if (Array.isArray(value)) return Math.max(value.length, ...value.map(largestArrayLength));
  if (!value || typeof value !== "object") return 0;
  return Math.max(0, ...Object.values(value as Record<string, unknown>).map(largestArrayLength));
}

async function readJson(response: Response) {
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) throw new Error("soundcharts_sandbox_response_too_large");
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("soundcharts_sandbox_invalid_json");
  }
  if (!response.ok) {
    const body = objectValue(payload);
    const message = typeof body.message === "string" ? body.message : response.statusText;
    throw new Error(`soundcharts_sandbox_request_failed:${response.status}:${message}`);
  }
  return payload;
}

export async function soundchartsSandboxGet(path: string) {
  assertAllowedSandboxPath(path);
  const url = new URL(path, SOUNDCHARTS_SANDBOX_ORIGIN);
  if (url.origin !== SOUNDCHARTS_SANDBOX_ORIGIN) throw new Error("soundcharts_sandbox_origin_invalid");
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "x-app-id": SOUNDCHARTS_SANDBOX_APP_ID,
      "x-api-key": SOUNDCHARTS_SANDBOX_API_KEY,
    },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  return readJson(response);
}

export async function probeSoundchartsSandbox() {
  const checkedAt = new Date().toISOString();
  const query = encodeURIComponent("Billie Eilish");
  const payload = await soundchartsSandboxGet(`/api/v2/artist/search/${query}?limit=1`);
  return {
    provider: "soundcharts" as const,
    environment: "sandbox" as const,
    requestAccepted: true as const,
    resultCount: largestArrayLength(payload),
    dataScope: "limited_vendor_sandbox_dataset" as const,
    productionAccess: false as const,
    credentialsStored: false as const,
    checkedAt,
  };
}
