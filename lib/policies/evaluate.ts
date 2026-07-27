import type { ActorContext, CapabilityDefinition, RiskClass } from "@/lib/capabilities/types";

export type AutonomyLevel = "L0" | "L1" | "L2" | "L3" | "ALWAYS_APPROVE";

export type AutonomyPolicy = {
  id: string;
  effect: "allow" | "deny";
  capabilityName?: string;
  risk?: RiskClass;
  actorPrincipalId?: string;
  artistId?: string;
  workspaceId?: string;
  level: AutonomyLevel;
  expiresAt?: string;
  reason: string;
};

export type PolicyDecision =
  | { effect: "allow"; reason: string; policyId: string }
  | { effect: "require_approval"; reason: string; policyId: string }
  | { effect: "deny"; reason: string; policyId: string };

const protectedRisks = new Set<RiskClass>([
  "R2_internal_destructive",
  "R3_external_effect",
  "R4_governance",
]);

function matches(policy: AutonomyPolicy, capability: CapabilityDefinition, ctx: ActorContext, now: Date): boolean {
  if (policy.expiresAt && new Date(policy.expiresAt).getTime() <= now.getTime()) return false;
  if (policy.capabilityName && policy.capabilityName !== capability.name) return false;
  if (policy.risk && policy.risk !== capability.risk) return false;
  if (policy.actorPrincipalId && policy.actorPrincipalId !== ctx.principalId) return false;
  if (policy.artistId && policy.artistId !== ctx.artistId) return false;
  if (policy.workspaceId && policy.workspaceId !== ctx.workspaceId) return false;
  return true;
}

function specificity(policy: AutonomyPolicy): number {
  return [
    policy.capabilityName,
    policy.risk,
    policy.actorPrincipalId,
    policy.artistId,
    policy.workspaceId,
  ].filter(Boolean).length;
}

export function evaluateCapabilityPolicy(
  capability: CapabilityDefinition,
  ctx: ActorContext,
  policies: readonly AutonomyPolicy[],
  now = new Date(),
): PolicyDecision {
  // This check intentionally happens before all configured policies. There is
  // no administrator override for destructive, external, or governance work.
  if (capability.approval === "always" || protectedRisks.has(capability.risk)) {
    return {
      effect: "require_approval",
      reason: `${capability.risk} capabilities are permanently human-gated`,
      policyId: "system.permanent_approval_ceiling",
    };
  }

  if (capability.approval === "never") {
    return {
      effect: "allow",
      reason: "Capability is explicitly safe without approval",
      policyId: "registry.never_requires_approval",
    };
  }

  const matching = policies
    .filter((policy) => matches(policy, capability, ctx, now))
    .sort((a, b) => {
      const specificityDelta = specificity(b) - specificity(a);
      if (specificityDelta) return specificityDelta;
      if (a.effect !== b.effect) return a.effect === "deny" ? -1 : 1;
      return a.level.localeCompare(b.level);
    });

  const explicitDeny = matching.find((policy) => policy.effect === "deny");
  if (explicitDeny) {
    return { effect: "deny", reason: explicitDeny.reason, policyId: explicitDeny.id };
  }

  const allowing = matching.find((policy) =>
    policy.effect === "allow" && ["L2", "L3"].includes(policy.level),
  );
  if (allowing && capability.risk === "R1_internal_reversible") {
    return { effect: "allow", reason: allowing.reason, policyId: allowing.id };
  }

  return {
    effect: "require_approval",
    reason: "No sufficiently specific active autonomy policy permits execution",
    policyId: "system.default_to_approval",
  };
}

export type TrustEvent = "approved" | "rejected" | "reversed" | "incident" | "unused";

export function demotedLevel(current: AutonomyLevel, event: TrustEvent): AutonomyLevel {
  if (event === "incident") return "L0";
  if (event === "reversed") return "L1";
  if (event === "unused") return "L1";
  if (event !== "rejected") return current;
  if (current === "L3") return "L2";
  if (current === "L2") return "L1";
  if (current === "L1") return "L0";
  return current;
}

export function mayProposePromotion(input: {
  risk: RiskClass;
  approvalsAtCurrentLevel: number;
  rejectionsInWindow: number;
  reversalsEver: number;
  incidentsInLast90Days: number;
  daysAtCurrentLevel: number;
}): boolean {
  if (input.risk !== "R0_read" && input.risk !== "R1_internal_reversible") return false;
  return (
    input.approvalsAtCurrentLevel >= 25 &&
    input.rejectionsInWindow === 0 &&
    input.reversalsEver === 0 &&
    input.incidentsInLast90Days === 0 &&
    input.daysAtCurrentLevel >= 14
  );
}
