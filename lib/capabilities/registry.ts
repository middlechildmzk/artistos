import type { CapabilityDefinition } from "./types";

const definitions = new Map<string, CapabilityDefinition>();

function key(name: string, version: number) {
  return `${name}@${version}`;
}

export function assertCapabilityInvariant(capability: CapabilityDefinition): void {
  if (!/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/.test(capability.name)) {
    throw new Error(`Invalid capability name: ${capability.name}`);
  }

  if (!Number.isInteger(capability.version) || capability.version < 1) {
    throw new Error(`${capability.name} must have a positive integer version`);
  }

  // Destructive, external, and governance actions are permanently capped at
  // preparation. No policy, trust score, or administrator setting may weaken
  // this registry-level safety property.
  if (["R2_internal_destructive", "R3_external_effect", "R4_governance"].includes(capability.risk)) {
    if (capability.approval !== "always") {
      throw new Error(`${capability.name} is ${capability.risk} and must always require approval`);
    }
  }

  if (["R3_external_effect", "R4_governance"].includes(capability.risk) && capability.evidence !== "required") {
    throw new Error(`${capability.name} must require evidence`);
  }

  if (capability.mcp === "gated_write" && !["R0_read", "R1_internal_reversible"].includes(capability.risk)) {
    throw new Error(`${capability.name} is too risky for MCP gated-write exposure`);
  }

  if (capability.kind === "query" && capability.risk !== "R0_read") {
    throw new Error(`${capability.name} is a query and must be R0_read`);
  }
}

export function registerCapability<I, O>(capability: CapabilityDefinition<I, O>): CapabilityDefinition<I, O> {
  assertCapabilityInvariant(capability);
  const registryKey = key(capability.name, capability.version);
  if (definitions.has(registryKey)) throw new Error(`Duplicate capability: ${registryKey}`);
  definitions.set(registryKey, capability as CapabilityDefinition);
  return Object.freeze(capability);
}

export function getCapability(name: string, version = 1): CapabilityDefinition {
  const capability = definitions.get(key(name, version));
  if (!capability) throw new Error(`Unknown capability: ${name}@${version}`);
  return capability;
}

export function listCapabilities(): readonly CapabilityDefinition[] {
  return Object.freeze([...definitions.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version - b.version));
}

export function capabilityRegistryVersion(): string {
  return listCapabilities().map((capability) => `${capability.name}@${capability.version}`).join("|");
}
