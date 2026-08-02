#!/usr/bin/env node

import { readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const tracked = spawnSync("git", ["ls-files", "-z"], { encoding: "utf8" });
if (tracked.status !== 0) {
  console.error(tracked.stderr || "Could not enumerate tracked files");
  process.exit(2);
}

const files = tracked.stdout.split("\0").filter(Boolean);
const failures = [];
const allowedEnvironmentFiles = new Set([".env.example", ".env.production"]);
const forbiddenBasenames = new Set([
  ".env",
  ".env.local",
  ".env.development",
  ".env.test",
  ".env.preview",
  ".env.production.local",
]);
const forbiddenExtensions = new Set([".pem", ".key", ".p12", ".pfx"]);
const highConfidencePatterns = [
  ["Supabase service-role key", /SUPABASE_SERVICE_ROLE_KEY\s*=\s*(?!\$\{\{?)[^\s#]+/i],
  ["ArtistOS token-encryption key", /ARTISTOS_TOKEN_ENCRYPTION_KEY\s*=\s*(?!\$\{\{?)[^\s#]+/i],
  ["Google OAuth client secret", /GOOGLE_OAUTH_CLIENT_SECRET\s*=\s*(?!\$\{\{?)[^\s#]+/i],
  ["Vercel token", /VERCEL_TOKEN\s*=\s*(?!\$\{\{?)[^\s#]+/i],
  ["private key block", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["GitHub personal access token", /\b(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ["Stripe live secret", /\bsk_live_[A-Za-z0-9]{20,}\b/],
];

for (const file of files) {
  const base = path.basename(file);
  const extension = path.extname(file).toLowerCase();
  if ((forbiddenBasenames.has(base) || forbiddenExtensions.has(extension)) && !allowedEnvironmentFiles.has(file)) {
    failures.push(`${file}: credential-bearing file type must not be tracked`);
    continue;
  }

  let size = 0;
  try {
    size = statSync(file).size;
  } catch {
    continue;
  }
  if (size > 1_000_000) continue;

  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  if (file === ".env.production") {
    const assignments = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
    for (const assignment of assignments) {
      const key = assignment.split("=", 1)[0];
      if (!key.startsWith("NEXT_PUBLIC_")) failures.push(`${file}: only browser-safe NEXT_PUBLIC_ assignments may be tracked`);
    }
  }

  for (const [label, pattern] of highConfidencePatterns) {
    if (pattern.test(content)) failures.push(`${file}: possible ${label}`);
  }
}

if (failures.length) {
  console.error("Repository secret-hygiene gate failed:");
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log(`Repository secret-hygiene gate passed for ${files.length} tracked files.`);
