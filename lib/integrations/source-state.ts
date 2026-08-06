export type IntegrationSourceState =
  | "not_configured"
  | "configured"
  | "authorized"
  | "verified"
  | "imported"
  | "public_identity"
  | "stale"
  | "error";

export type IntegrationSourceStateInput = {
  configured?: boolean;
  authorized?: boolean;
  lastSuccessAt?: string | null;
  lastError?: string | null;
  snapshotCount?: number;
  latestSnapshotOn?: string | null;
  profileCount?: number;
  connectedProfileCount?: number;
  publicIdentityCount?: number;
  staleAfterDays?: number;
  now?: Date;
};

export type IntegrationSourceStateResult = {
  state: IntegrationSourceState;
  label: string;
  detail: string;
  asOf: string | null;
};

const DAY_MS = 86_400_000;

function isStale(value: string | null | undefined, staleAfterDays: number, now: Date) {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && now.getTime() - timestamp > staleAfterDays * DAY_MS;
}

export function deriveIntegrationSourceState(input: IntegrationSourceStateInput): IntegrationSourceStateResult {
  const now = input.now ?? new Date();
  const staleAfterDays = input.staleAfterDays ?? 14;
  const latestEvidence = input.lastSuccessAt ?? input.latestSnapshotOn ?? null;

  if (input.lastError?.trim()) {
    return {
      state: "error",
      label: "Needs attention",
      detail: input.lastError.trim(),
      asOf: latestEvidence,
    };
  }

  if (latestEvidence && isStale(latestEvidence, staleAfterDays, now)) {
    return {
      state: "stale",
      label: "Stale",
      detail: `No current source evidence within ${staleAfterDays} days.`,
      asOf: latestEvidence,
    };
  }

  if (input.lastSuccessAt) {
    return {
      state: "verified",
      label: "Provider verified",
      detail: "ArtistOS completed a successful provider request.",
      asOf: input.lastSuccessAt,
    };
  }

  if ((input.snapshotCount ?? 0) > 0) {
    return {
      state: "imported",
      label: "Imported data",
      detail: "Metrics are present from an export, manual observation, or non-OAuth source.",
      asOf: input.latestSnapshotOn ?? null,
    };
  }

  if ((input.connectedProfileCount ?? 0) > 0 || input.authorized) {
    return {
      state: "authorized",
      label: "Authorized",
      detail: "Consent or a connected identity exists, but no successful source-specific data request is recorded yet.",
      asOf: null,
    };
  }

  if ((input.publicIdentityCount ?? input.profileCount ?? 0) > 0) {
    return {
      state: "public_identity",
      label: "Public identity only",
      detail: "The artist profile is mapped, but private analytics are not connected.",
      asOf: null,
    };
  }

  if (input.configured) {
    return {
      state: "configured",
      label: "Configured",
      detail: "Provider settings exist, but user authorization and verification are still required.",
      asOf: null,
    };
  }

  return {
    state: "not_configured",
    label: "Not connected",
    detail: "No provider configuration, import, or public profile mapping is available.",
    asOf: null,
  };
}
