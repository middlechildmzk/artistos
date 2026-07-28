"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { invokeCapability } from "@/lib/capabilities/invoke";
import {
  createActorContext,
  createServerInvocationDependencies,
} from "@/lib/capabilities/server-runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function invokeDashboardMutation(args: {
  name: string;
  input: Record<string, unknown>;
  idempotencyKey: string;
}) {
  let ctx;
  try {
    ctx = await createActorContext();
  } catch (error) {
    if (error instanceof Error && error.message === "not_authenticated") redirect("/login");
    throw error;
  }

  const result = await invokeCapability({
    name: args.name,
    ctx,
    input: { ...args.input, idempotencyKey: args.idempotencyKey },
    idempotencyKey: args.idempotencyKey,
    dependencies: createServerInvocationDependencies(),
  });

  if (result.status === "ok") return result;
  if (result.status === "requires_approval") {
    throw new Error(`Approval required: ${result.approvalId}`);
  }
  if (result.status === "denied") {
    throw new Error(`Action denied by ${result.policy}: ${result.reason}`);
  }
  throw new Error(`${result.error.code}: ${result.error.message}`);
}

export async function toggleTask(formData: FormData) {
  const taskId = String(formData.get("taskId") ?? "");
  const currentStatus = String(formData.get("currentStatus") ?? "open");
  if (!taskId) return;

  const nextStatus = currentStatus === "done" ? "open" : "done";
  await invokeDashboardMutation({
    name: "tasks.update_status",
    input: { taskId, status: nextStatus },
    idempotencyKey: randomUUID(),
  });
  revalidatePath("/dashboard");
}

export async function completeFollowUp(formData: FormData) {
  const interactionId = String(formData.get("interactionId") ?? "");
  if (!interactionId) return;

  await invokeDashboardMutation({
    name: "interactions.complete_follow_up",
    input: { interactionId },
    idempotencyKey: randomUUID(),
  });
  revalidatePath("/dashboard");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
