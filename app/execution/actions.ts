"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { invokeCapability } from "@/lib/capabilities/invoke";
import { createActorContext, createServerInvocationDependencies } from "@/lib/capabilities/server-runtime";

const idSchema = z.string().uuid();
const reviewStateSchema = z.enum(["approved", "rejected", "review"]);

function requireId(value: FormDataEntryValue | null, label: string) {
  const result = idSchema.safeParse(String(value || ""));
  if (!result.success) throw new Error(`${label} is invalid`);
  return result.data;
}

async function invokeExecution(name: string, input: Record<string, unknown>) {
  let ctx;
  try {
    ctx = await createActorContext();
  } catch (error) {
    if (error instanceof Error && error.message === "not_authenticated") redirect("/login");
    throw error;
  }
  const idempotencyKey = String(input.idempotencyKey);
  const result = await invokeCapability({
    name,
    ctx,
    input,
    idempotencyKey,
    dependencies: createServerInvocationDependencies(),
  });
  if (result.status === "ok") return result.output;
  if (result.status === "requires_approval") throw new Error(`Approval required: ${result.approvalId}`);
  if (result.status === "denied") throw new Error(`Action denied by ${result.policy}: ${result.reason}`);
  throw new Error(`${result.error.code}: ${result.error.message}`);
}

export async function createAgentRun(formData: FormData) {
  const managerRequestId = requireId(formData.get("managerRequestId"), "Manager request");
  await invokeExecution("execution.create_agent_run", {
    managerRequestId,
    idempotencyKey: `execution-create:${managerRequestId}:${randomUUID()}`,
  });
  revalidatePath("/execution");
}

export async function approveAgentRun(formData: FormData) {
  const runId = requireId(formData.get("runId"), "Run");
  await invokeExecution("execution.approve_agent_run", {
    runId,
    idempotencyKey: `execution-approve:${runId}:${randomUUID()}`,
  });
  revalidatePath("/execution");
}

export async function materializeAgentRun(formData: FormData) {
  const runId = requireId(formData.get("runId"), "Run");
  try {
    await invokeExecution("execution.materialize_agent_run", {
      runId,
      idempotencyKey: `execution-materialize:${runId}:${randomUUID()}`,
    });
  } finally {
    revalidatePath("/execution");
    revalidatePath("/dashboard");
    revalidatePath("/studio");
    revalidatePath("/analytics");
  }
}

export async function reviewArtifact(formData: FormData) {
  const artifactId = requireId(formData.get("artifactId"), "Artifact");
  const parsedState = reviewStateSchema.safeParse(String(formData.get("approvalState") || "review"));
  if (!parsedState.success) throw new Error("Invalid review state");
  await invokeExecution("execution.review_artifact", {
    artifactId,
    approvalState: parsedState.data,
    idempotencyKey: `execution-artifact-review:${artifactId}:${randomUUID()}`,
  });
  revalidatePath("/execution");
}
