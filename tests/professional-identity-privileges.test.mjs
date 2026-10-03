// T1B exploit regression for ArtistOS professional identity and claims.
//
// Two databases are replayed from the manifest: production as-is ("before")
// and production plus the pending hardening migration ("after"). Every exploit
// must SUCCEED before (proving the test reaches the real hole) and FAIL after.
// Legitimate self-service must keep working after.

import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ARTISTOS_ROOT, replay } from "./support/pglite-replay.mjs";

const MIGRATION = "harden_professional_identity_privileges";
const CURATOR = "aaaaaaaa-0000-4000-8000-000000000001";
const OTHER = "bbbbbbbb-0000-4000-8000-000000000002";
const NEWCOMER = "cccccccc-0000-4000-8000-000000000003";
const CURATOR_WS = "dddddddd-0000-4000-8000-000000000004";
const OTHER_WS = "eeeeeeee-0000-4000-8000-000000000005";
const PROPERTY = "ffffffff-0000-4000-8000-000000000006";
const PROFILE = "11111111-0000-4000-8000-000000000007";
const LINK_PROPERTY = "22222222-0000-4000-8000-000000000008";
const REJECTED_CLAIM = "33333333-0000-4000-8000-000000000009";
const PENDING_CLAIM = "44444444-0000-4000-8000-00000000000a";
const THIRD_PROPERTY = "55555555-0000-4000-8000-00000000000b";

async function seed(db) {
  await db.exec(`
    insert into auth.users (id, email) values
      ('${CURATOR}', 'curator@example.test'), ('${OTHER}', 'other@example.test'), ('${NEWCOMER}', 'new@example.test')
      on conflict (id) do nothing;
    insert into public.workspaces (id, name) values ('${CURATOR_WS}', 'Curator WS'), ('${OTHER_WS}', 'Other WS') on conflict (id) do nothing;
    insert into public.workspace_members (workspace_id, user_id, role) values
      ('${CURATOR_WS}', '${CURATOR}', 'owner'), ('${OTHER_WS}', '${OTHER}', 'owner'), ('${CURATOR_WS}', '${NEWCOMER}', 'editor')
      on conflict do nothing;
    insert into public.properties (id, name, workspace_id, property_type, platform)
      values ('${PROPERTY}', 'Someone Else''s Playlist', '${OTHER_WS}', 'playlist', 'spotify'),
             ('${LINK_PROPERTY}', 'Pending Link Playlist', '${OTHER_WS}', 'playlist', 'spotify'),
             ('${THIRD_PROPERTY}', 'Third Playlist', '${OTHER_WS}', 'playlist', 'spotify');
    insert into public.professional_profiles (id, user_id, workspace_id, public_slug, display_name, is_public)
      values ('${PROFILE}', '${CURATOR}', '${CURATOR_WS}', 'curator-one', 'Curator One', true);
    insert into public.professional_properties (professional_profile_id, property_id, role, status)
      values ('${PROFILE}', '${LINK_PROPERTY}', 'owner', 'pending');
    insert into public.property_claims (id, property_id, claimant_user_id, professional_profile_id, claimant_workspace_id, status)
      values ('${REJECTED_CLAIM}', '${PROPERTY}', '${CURATOR}', '${PROFILE}', '${CURATOR_WS}', 'rejected'),
             ('${PENDING_CLAIM}', '${LINK_PROPERTY}', '${CURATOR}', '${PROFILE}', '${CURATOR_WS}', 'pending');
  `);
}

// Each attempt runs in its own transaction as the given API role and is rolled
// back, so attempts are independent and cannot leak state into each other.
async function attempt(db, role, user, sql) {
  await db.exec("begin");
  try {
    await db.exec(`select set_config('request.jwt.claim.sub', '${user ?? ""}', true); set local role ${role};`);
    const multi = sql.trim().replace(/;\s*$/, "").includes(";");
    const result = multi ? (await db.exec(sql)).at(-1) : await db.query(sql);
    return { ok: true, rows: result.rows ?? [] };
  } catch (error) {
    return { ok: false, error: error.message };
  } finally {
    await db.exec("rollback");
  }
}

const EXPLOITS = [
  {
    name: "create an active owner link to an arbitrary property",
    role: "authenticated",
    user: CURATOR,
    sql: `insert into public.professional_properties (professional_profile_id, property_id, role, status, verified_at)
          values ('${PROFILE}', '${PROPERTY}', 'owner', 'active', now()) returning property_id`,
  },
  {
    name: "promote own pending owner link to active",
    role: "authenticated",
    user: CURATOR,
    sql: `update public.professional_properties set status = 'active', verified_at = now()
          where professional_profile_id = '${PROFILE}' and property_id = '${LINK_PROPERTY}' returning status`,
  },
  {
    name: "retarget own link to an arbitrary property",
    role: "authenticated",
    user: CURATOR,
    sql: `update public.professional_properties set property_id = '${THIRD_PROPERTY}'
          where professional_profile_id = '${PROFILE}' and property_id = '${LINK_PROPERTY}' returning property_id`,
  },
  {
    name: "self-verify professional profile",
    role: "authenticated",
    user: CURATOR,
    sql: `update public.professional_profiles set verification_status = 'verified' where id = '${PROFILE}' returning verification_status`,
  },
  {
    name: "create a professional profile that is already verified",
    role: "authenticated",
    user: NEWCOMER,
    sql: `insert into public.professional_profiles (user_id, workspace_id, public_slug, display_name, verification_status)
          values ('${NEWCOMER}', '${CURATOR_WS}', 'newcomer', 'Newcomer', 'verified') returning id`,
  },
  {
    name: "move own profile into another workspace",
    role: "authenticated",
    user: CURATOR,
    sql: `update public.professional_profiles set workspace_id = '${OTHER_WS}' where id = '${PROFILE}' returning workspace_id`,
  },
  {
    name: "file a property claim that is already approved",
    role: "authenticated",
    user: CURATOR,
    sql: `insert into public.property_claims (property_id, claimant_user_id, professional_profile_id, claimant_workspace_id, status, reviewed_by, reviewed_at)
          values ('${PROPERTY}', '${CURATOR}', '${PROFILE}', '${CURATOR_WS}', 'approved', '${CURATOR}', now()) returning id`,
  },
  {
    name: "reopen a rejected claim",
    role: "authenticated",
    user: CURATOR,
    sql: `update public.property_claims set status = 'pending' where id = '${REJECTED_CLAIM}' returning status`,
  },
  {
    name: "anon writes a claim",
    // Already blocked by RLS today (auth.uid() is null for anon); asserted after
    // the migration as defense in depth now that anon has no write grant at all.
    reproducesToday: false,
    role: "anon",
    user: null,
    sql: `insert into public.property_claims (property_id, claimant_user_id, professional_profile_id, claimant_workspace_id)
          values ('${PROPERTY}', '${CURATOR}', '${PROFILE}', '${CURATOR_WS}') returning id`,
  },
];

// An exploit "succeeds" if it ran without error AND changed or returned a row.
const succeeded = (result) => result.ok && result.rows.length > 0;

describe("ArtistOS professional identity privileges (T1B)", () => {
  let beforeDb;
  let afterDb;

  before(async () => {
    ({ db: beforeDb } = await replay());
    await seed(beforeDb);
    ({ db: afterDb } = await replay({ pending: [MIGRATION] }));
    await seed(afterDb);
  });

  after(async () => {
    await beforeDb?.close();
    await afterDb?.close();
  });

  for (const exploit of EXPLOITS) {
    test(`exploit reproduces on current production schema: ${exploit.name}`, { skip: exploit.reproducesToday === false && "not a live hole; defense-in-depth check only" }, async () => {
      const result = await attempt(beforeDb, exploit.role, exploit.user, exploit.sql);
      assert.ok(succeeded(result), `expected the hole to exist before the fix: ${JSON.stringify(result)}`);
    });

    test(`exploit blocked after migration: ${exploit.name}`, async () => {
      const result = await attempt(afterDb, exploit.role, exploit.user, exploit.sql);
      assert.ok(!succeeded(result), `exploit still works: ${JSON.stringify(result)}`);
    });
  }

  test("protected values are unchanged after all blocked attempts", async () => {
    const { rows: [profile] } = await afterDb.query(`select verification_status, workspace_id from public.professional_profiles where id = '${PROFILE}'`);
    assert.equal(profile.verification_status, "unverified");
    assert.equal(profile.workspace_id, CURATOR_WS);
    const { rows: links } = await afterDb.query(`select property_id, status from public.professional_properties where professional_profile_id = '${PROFILE}'`);
    assert.deepEqual(links, [{ property_id: LINK_PROPERTY, status: "pending" }]);
    const { rows: [claim] } = await afterDb.query(`select status from public.property_claims where id = '${REJECTED_CLAIM}'`);
    assert.equal(claim.status, "rejected");
  });

  describe("legitimate self-service still works after migration", () => {
    test("edit own profile details and capacity", async () => {
      const result = await attempt(afterDb, "authenticated", CURATOR,
        `update public.professional_profiles set bio = 'Emotional bass curator', capacity_status = 'limited', is_public = true
         where id = '${PROFILE}' returning bio, capacity_status, verification_status`);
      assert.ok(result.ok, result.error);
      assert.deepEqual(result.rows, [{ bio: "Emotional bass curator", capacity_status: "limited", verification_status: "unverified" }]);
    });

    test("create own profile (lands unverified)", async () => {
      const result = await attempt(afterDb, "authenticated", NEWCOMER,
        `insert into public.professional_profiles (user_id, workspace_id, public_slug, display_name)
         values ('${NEWCOMER}', '${CURATOR_WS}', 'newcomer-legit', 'Newcomer') returning verification_status`);
      assert.ok(result.ok, result.error);
      assert.deepEqual(result.rows, [{ verification_status: "unverified" }]);
    });

    test("file a claim (lands pending) and withdraw a pending claim", async () => {
      const filed = await attempt(afterDb, "authenticated", CURATOR,
        `insert into public.property_claims (property_id, claimant_user_id, professional_profile_id, claimant_workspace_id, verification_method, evidence_url)
         values ('${PROPERTY}', '${CURATOR}', '${PROFILE}', '${CURATOR_WS}', 'website_token', 'https://example.test/proof') returning status`);
      assert.ok(filed.ok, filed.error);
      assert.deepEqual(filed.rows, [{ status: "pending" }]);
      const withdrawn = await attempt(afterDb, "authenticated", CURATOR,
        `update public.property_claims set status = 'withdrawn', evidence_notes = 'Wrong playlist' where id = '${PENDING_CLAIM}' returning status`);
      assert.ok(withdrawn.ok, withdrawn.error);
      assert.deepEqual(withdrawn.rows, [{ status: "withdrawn" }]);
    });

    test("remove own ownership link", async () => {
      const result = await attempt(afterDb, "authenticated", CURATOR,
        `delete from public.professional_properties where professional_profile_id = '${PROFILE}' and property_id = '${LINK_PROPERTY}' returning property_id`);
      assert.ok(result.ok, result.error);
      assert.equal(result.rows.length, 1);
    });

    test("public can still read public profiles", async () => {
      const result = await attempt(afterDb, "anon", null, `select display_name from public.professional_profiles where is_public`);
      assert.ok(result.ok, result.error);
      assert.deepEqual(result.rows, [{ display_name: "Curator One" }]);
    });

    test("service role approval path can verify and create active ownership", async () => {
      const result = await attempt(afterDb, "service_role", null, `
        update public.professional_profiles set verification_status = 'verified' where id = '${PROFILE}';
        insert into public.professional_properties (professional_profile_id, property_id, role, status, verified_at)
          values ('${PROFILE}', '${PROPERTY}', 'owner', 'active', now()) returning status`);
      assert.ok(result.ok, result.error);
    });
  });

  test("manual rollback restores the pre-migration grants and policies", async () => {
    const { db } = await replay({ pending: [MIGRATION] });
    try {
      await seed(db);
      await db.exec(await readFile(path.join(ARTISTOS_ROOT, "supabase/rollback/20260929220000_harden_professional_identity_privileges.down.sql"), "utf8"));
      const reopened = await attempt(db, "authenticated", CURATOR, EXPLOITS[0].sql);
      assert.ok(succeeded(reopened), "rollback should restore the previous (vulnerable) behavior exactly");
    } finally {
      await db.close();
    }
  });
});
