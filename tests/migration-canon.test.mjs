// Canonical SQL hashing must be literal-aware: any change inside a literal is a
// semantic change and must alter the hash; comments, whitespace and statement
// separator formatting outside literals must not.

import assert from "node:assert/strict";
import test from "node:test";
import { canonicalHash, canonicalSql, canonicalStatements } from "../scripts/lib/migration-canon.mjs";

const differ = (a, b) => assert.notEqual(canonicalHash(a).sha256, canonicalHash(b).sha256, `${a}\n  vs\n${b}`);
const same = (a, b) => assert.equal(canonicalHash(a).sha256, canonicalHash(b).sha256, `${a}\n  vs\n${b}`);

test("semicolon inside a string literal is preserved", () => {
  differ("insert into public.t(v) values ('a;b');", "insert into public.t(v) values ('ab');");
});

test("'--' inside a string literal is not a comment", () => {
  differ("select 'x--y';", "select 'x';");
  differ("select 'x--y';", "select 'x--z';");
});

test("'/* */' inside a string literal is not a comment", () => {
  differ("select 'x/*y*/z';", "select 'xz';");
  differ("select 'x/*y*/z';", "select 'x/*q*/z';");
});

test("escaped single quotes are handled and preserved", () => {
  differ("select 'it''s; fine';", "select 'its fine';");
  differ("select 'it''s';", "select 'it''S';");
  assert.equal(canonicalSql("select 'it''s -- not a comment' ; "), "select 'it''s -- not a comment'");
});

test("E-strings honour backslash escapes", () => {
  const withEscapedQuote = String.raw`select E'a\';b';`;
  assert.equal(canonicalSql(withEscapedQuote), String.raw`select E'a\';b'`);
  differ(withEscapedQuote, String.raw`select E'a\'b';`);
  // Without the E prefix a backslash is literal and '' is the only escape.
  assert.equal(canonicalSql(String.raw`select 'a\'; select 2;`), String.raw`select 'a\';` + "\nselect 2");
});

test("whitespace inside literals is significant", () => {
  differ("select 'a  b';", "select 'a b';");
});

test("dollar-quoted PL/pgSQL bodies are preserved exactly", () => {
  const body = (inner) => `create function public.f() returns int language plpgsql as $$\nbegin\n  ${inner}\nend;\n$$;`;
  differ(body("return 1; -- note"), body("return 1;"));
  differ(body("return 1;"), body("return 2;"));
  differ(body("perform 1; /* x */ return 1;"), body("perform 1; return 1;"));
  differ(body("return 1;"), body("return  1;"));
});

test("tagged dollar quotes, including nested different tags", () => {
  const fn = (lit) => `create function f() returns text language sql as $fn$ select $q$${lit}$q$ $fn$;`;
  differ(fn("a;b"), fn("ab"));
  differ(fn("--x"), fn(""));
  assert.equal(canonicalSql("select $fn$ a ; b $fn$ ;"), "select $fn$ a ; b $fn$");
});

test("changed literals inside function bodies change the hash", () => {
  const f = (msg) => `create or replace function g() returns trigger language plpgsql as $$ begin raise exception '${msg}' using errcode = '23514'; end $$;`;
  differ(f("requires follower_count_observed_at"), f("requires nothing"));
});

test("positional parameters are not mistaken for dollar quotes", () => {
  assert.equal(canonicalSql("select $1 ; select $2"), "select $1;\nselect $2");
});

test("quoted identifiers are preserved and can contain separators", () => {
  differ('create table "a;b" (id int);', "create table ab (id int);");
  differ('create table "My Table" (id int);', 'create table "my table" (id int);');
});

test("harmless changes outside literals normalize equivalently", () => {
  same("create table x (id int);", "-- leading comment\ncreate   table x (\n  id int /* trailing */\n);\n");
  same("select 1; select 2;", "select 1;\n\n  select 2");
  same("select 1;;;\nselect 2", "select 1; select 2;");
  same("create table x (id int) /* a /* nested */ comment */;", "create table x (id int);");
  same("insert into t (a, b) values ( 1 , 2 );", "insert into t (a,b) values (1,2);");
});

test("statement boundaries and operator spacing are significant", () => {
  differ("select 1; select 2;", "select 1 select 2;");
  differ("select 1 - -1;", "select 1 -1;");
  differ("select a < = b;", "select a <= b;");
});

test("unterminated literals and comments fail closed", () => {
  for (const bad of ["select 'abc;", 'select "abc;', "select $$ abc;", "select 1 /* open", "select $t$ x $u$;"]) {
    assert.throws(() => canonicalSql(bad), /unterminated/, bad);
  }
});

test("live statements and the source file canonicalize identically", () => {
  const file = "-- recovered from production\ncreate table t (v text default 'a;b');\n";
  const liveStatements = ["create table t (v text default 'a;b');"];
  assert.equal(canonicalStatements(liveStatements), canonicalSql(file));
  assert.notEqual(canonicalStatements(["create table t (v text default 'ab');"]), canonicalSql(file));
});
