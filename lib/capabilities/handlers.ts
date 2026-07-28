import type { ActorContext, CapabilityDefinition } from "./types";

export type CapabilityExecution<O = unknown> = {
  output: O;
  evidenceIds: string[];
  auditId?: string;
};

export type CapabilityHandler<I = unknown, O = unknown> = (args: {
  ctx: ActorContext;
  input: I;
  idempotencyKey?: string;
}) => Promise<CapabilityExecution<O>>;

const handlers = new Map<string, CapabilityHandler>();

function key(name: string, version: number) {
  return `${name}@${version}`;
}

export function registerCapabilityHandler<I, O>(
  capability: CapabilityDefinition<I, O>,
  handler: CapabilityHandler<I, O>,
): void {
  const registryKey = key(capability.name, capability.version);
  if (handlers.has(registryKey)) throw new Error(`Duplicate capability handler: ${registryKey}`);
  handlers.set(registryKey, handler as CapabilityHandler);
}

export function getCapabilityHandler(name: string, version = 1): CapabilityHandler {
  const handler = handlers.get(key(name, version));
  if (!handler) throw new Error(`No handler registered for ${name}@${version}`);
  return handler;
}

export function listCapabilityHandlers(): readonly string[] {
  return Object.freeze([...handlers.keys()].sort());
}
