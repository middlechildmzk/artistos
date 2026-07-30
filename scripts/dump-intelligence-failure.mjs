#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
for (const key of required) if (!process.env[key]) throw new Error(`Missing ${key}`);

const service = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const ownerEmail = "intelligence-owner-e2e@artistos.invalid";
const outputDir = path.resolve("artifacts/intelligence-loop-e2e");
fs.mkdirSync(outputDir, { recursive: true });

async function selectRows(table, workspaceId, columns = "*", limit = 50) {
  const { data, error } = await service
    .from(table)
    .select(columns)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return error ? { error: { code: error.code, message: error.message, details: error.details } } : data;
}

const { data: usersData, error: usersError } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (usersError) throw usersError;
const owner = usersData.users.find((user) => user.email === ownerEmail);
if (!owner) throw new Error("diagnostic_owner_not_found");

const { data: membership, error: membershipError } = await service
  .from("workspace_members")
  .select("workspace_id,role")
  .eq("user_id", owner.id)
  .maybeSingle();
if (membershipError) throw membershipError;
if (!membership) throw new Error("diagnostic_workspace_not_found");

const workspaceId = membership.workspace_id;
const diagnostics = {
  source_commit: process.env.GITHUB_SHA ?? null,
  captured_at: new Date().toISOString(),
  workspace_id: workspaceId,
  membership,
  capability_audit_log: await selectRows(
    "capability_audit_log",
    workspaceId,
    "id,capability_name,decision,policy_id,error_code,error_message,input_hash,output_summary,evidence_ids,created_at",
    100,
  ),
  campaign_targets: await selectRows("campaign_targets", workspaceId, "id,campaign_id,target_kind,target_id,status,added_at,updated_at"),
  interactions: await selectRows("interactions", workspaceId, "id,campaign_id,organization_id,subject,channel,reply_status,occurred_at"),
  campaign_submissions: await selectRows("campaign_submissions", workspaceId, "id,campaign_id,release_id,campaign_target_id,property_id,submission_mode,status,submitted_at,completed_at"),
  campaign_deliverables: await selectRows("campaign_deliverables", workspaceId, "id,campaign_id,campaign_target_id,channel,deliverable_type,status,due_at,created_at"),
  outcomes: await selectRows("outcomes", workspaceId, "id,campaign_id,release_id,organization_id,property_id,outcome_type,outcome_date,confidence,created_at"),
  evidence_records: await selectRows("evidence_records", workspaceId, "id,release_id,campaign_id,campaign_target_id,deliverable_id,evidence_type,source_type,summary,confidence,verification_status,contradiction_state,captured_at"),
};

const serialized = `${JSON.stringify(diagnostics, null, 2)}\n`;
fs.writeFileSync(path.join(outputDir, "diagnostics.json"), serialized);
console.log(serialized);
