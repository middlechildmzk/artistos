import { z } from "zod";
import { registerCapability } from "./registry";
import { defaultReadRetry, defaultWriteRetry } from "./types";

const uuid = z.string().uuid();
const emptyInput = z.object({}).strict();

export const getActiveWorkspaceCapability = registerCapability({
  name: "context.get_active_workspace",
  version: 1,
  kind: "query",
  purpose: "Resolve the authenticated actor's active ArtistOS workspace.",
  input: emptyInput,
  output: z.object({ workspaceId: uuid, role: z.enum(["viewer", "contributor", "editor", "admin", "owner"]) }),
  scope: { resource: "workspace", minRole: "viewer" },
  risk: "R0_read",
  approval: "never",
  idempotency: "naturally_idempotent",
  evidence: "none",
  auditEvents: ["context.workspace_resolved"],
  retry: defaultReadRetry,
  mcp: "authenticated",
  failureModes: ["not_authenticated", "workspace_not_found"],
});

export const listArtistsCapability = registerCapability({
  name: "context.list_artists",
  version: 1,
  kind: "query",
  purpose: "List artists visible in the current workspace or active grant scope.",
  input: z.object({ includeArchived: z.boolean().default(false) }),
  output: z.object({ artists: z.array(z.object({ id: uuid, name: z.string(), aliases: z.array(z.string()).nullable().optional() })) }),
  scope: { resource: "workspace", minRole: "viewer", grantPermission: "artist.profile.read" },
  risk: "R0_read",
  approval: "never",
  idempotency: "naturally_idempotent",
  evidence: "none",
  auditEvents: ["context.artists_listed"],
  retry: defaultReadRetry,
  mcp: "authenticated",
  failureModes: ["workspace_not_found"],
});

export const getArtistCapability = registerCapability({
  name: "context.get_artist",
  version: 1,
  kind: "query",
  purpose: "Read one artist profile from the authorized Artist Graph.",
  input: z.object({ artistId: uuid }),
  output: z.object({ id: uuid, name: z.string(), aliases: z.array(z.string()).nullable().optional(), bio: z.string().nullable().optional() }),
  scope: { resource: "artist", minRole: "viewer", grantPermission: "artist.profile.read" },
  risk: "R0_read",
  approval: "never",
  idempotency: "naturally_idempotent",
  evidence: "none",
  auditEvents: ["context.artist_read"],
  retry: defaultReadRetry,
  mcp: "authenticated",
  failureModes: ["artist_not_found"],
});

export const listReleasesCapability = registerCapability({
  name: "releases.list",
  version: 1,
  kind: "query",
  purpose: "List releases in the authorized workspace or artist scope.",
  input: z.object({ artistId: uuid.optional(), limit: z.number().int().min(1).max(200).default(50) }),
  output: z.object({ releases: z.array(z.object({ id: uuid, artistId: uuid, title: z.string(), status: z.string(), releaseDate: z.string().nullable() })) }),
  scope: { resource: "workspace", minRole: "viewer", grantPermission: "artist.releases.read" },
  risk: "R0_read",
  approval: "never",
  idempotency: "naturally_idempotent",
  evidence: "none",
  auditEvents: ["releases.listed"],
  retry: defaultReadRetry,
  mcp: "authenticated",
  failureModes: [],
});

export const getReleaseCapability = registerCapability({
  name: "releases.get",
  version: 1,
  kind: "query",
  purpose: "Read a release workspace and its current metadata.",
  input: z.object({ releaseId: uuid }),
  output: z.object({ id: uuid, artistId: uuid, title: z.string(), status: z.string(), releaseDate: z.string().nullable() }),
  scope: { resource: "release", minRole: "viewer", grantPermission: "artist.releases.read" },
  risk: "R0_read",
  approval: "never",
  idempotency: "naturally_idempotent",
  evidence: "none",
  auditEvents: ["releases.read"],
  retry: defaultReadRetry,
  mcp: "authenticated",
  failureModes: ["release_not_found"],
});

export const createTaskCapability = registerCapability({
  name: "tasks.create",
  version: 1,
  kind: "command",
  purpose: "Create a reversible internal task linked to an artist, release, or campaign.",
  input: z.object({ title: z.string().trim().min(1).max(180), detail: z.string().trim().max(4000).nullable().optional(), releaseId: uuid.nullable().optional(), dueDate: z.string().date().nullable().optional(), idempotencyKey: z.string().min(16) }),
  output: z.object({ taskId: uuid, created: z.boolean() }),
  scope: { resource: "workspace", minRole: "contributor", grantPermission: "artist.tasks.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["tasks.create_requested", "tasks.created"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["release_not_found", "idempotency_conflict"],
});

export const updateTaskStatusCapability = registerCapability({
  name: "tasks.update_status",
  version: 1,
  kind: "command",
  purpose: "Move an internal task through an approved reversible workflow state.",
  input: z.object({ taskId: uuid, status: z.enum(["open", "in_progress", "blocked", "done", "skipped"]), idempotencyKey: z.string().min(16) }),
  output: z.object({ taskId: uuid, status: z.string(), changed: z.boolean() }),
  scope: { resource: "workspace", minRole: "contributor", grantPermission: "artist.tasks.write" },
  risk: "R1_internal_reversible",
  approval: "by_policy",
  idempotency: "key_required",
  evidence: "optional",
  auditEvents: ["tasks.status_changed"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["task_not_found", "invalid_transition"],
});

export const suppressAudienceCapability = registerCapability({
  name: "audience.suppress",
  version: 1,
  kind: "command",
  purpose: "Immediately honor a do-not-contact request for an email address.",
  input: z.object({ email: z.string().trim().min(3).max(254), reasonCode: z.enum(["unsubscribe", "manual", "bounce", "complaint", "role_address", "invalid", "import", "other"]), notes: z.string().trim().max(2000).optional(), source: z.string().trim().max(200).default("artistos") }),
  output: z.object({ suppressionId: uuid, email: z.string(), alreadySuppressed: z.boolean() }),
  scope: { resource: "workspace", minRole: "contributor" },
  risk: "R1_internal_reversible",
  approval: "never",
  idempotency: "naturally_idempotent",
  evidence: "optional",
  auditEvents: ["audience.suppressed"],
  retry: defaultWriteRetry,
  mcp: "gated_write",
  failureModes: ["invalid_email", "suppression_conflict"],
});

// Governance examples are registered now to make the permanent ceiling testable
// before their handlers or UI exist.
export const unsuppressAudienceCapability = registerCapability({
  name: "audience.unsuppress",
  version: 1,
  kind: "effect",
  purpose: "Reverse a prior contact suppression after explicit human verification.",
  input: z.object({ suppressionId: uuid, approvalId: uuid, evidenceIds: z.array(uuid).min(1), idempotencyKey: z.string().min(16) }),
  output: z.object({ suppressionId: uuid, restored: z.boolean() }),
  scope: { resource: "workspace", minRole: "admin" },
  risk: "R4_governance",
  approval: "always",
  idempotency: "key_required",
  evidence: "required",
  auditEvents: ["audience.unsuppress_requested", "audience.unsuppressed"],
  retry: defaultWriteRetry,
  mcp: "prohibited",
  failureModes: ["approval_missing", "evidence_missing", "suppression_not_found"],
});
