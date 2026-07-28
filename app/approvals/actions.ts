"use server";

import { revalidatePath } from "next/cache";
import { decideApproval, executeApprovedCapability } from "@/lib/capabilities/approved-execution";

export async function reviewApproval(formData: FormData) {
  const approvalId = String(formData.get("approvalId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!approvalId) throw new Error("approval_id_required");
  if (decision !== "approved" && decision !== "rejected") throw new Error("invalid_approval_decision");

  await decideApproval(approvalId, decision, note || undefined);
  if (decision === "approved") await executeApprovedCapability(approvalId);
  revalidatePath("/approvals");
  revalidatePath("/dashboard");
  revalidatePath("/execution");
}
