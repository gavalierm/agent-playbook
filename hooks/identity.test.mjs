// identity.mjs: identita a pravidlá roly z riadku "Role:" v PERSONA.md.
// Fixtúra je dočasný priečinok, žiadny živý systém.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "identity.mjs");

function run(persona) {
  const dir = mkdtempSync(join(tmpdir(), "identity-"));
  try {
    if (persona !== null) writeFileSync(join(dir, "PERSONA.md"), persona);
    const out = execFileSync("node", [HOOK], {
      input: JSON.stringify({ session_id: "test1234", cwd: dir }),
      env: { ...process.env, CLAUDE_PROJECT_DIR: "" },
    }).toString();
    return out ? JSON.parse(out).hookSpecificOutput.additionalContext : "";
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("bez riadku Role vloží len identitu", () => {
  const c = run("# Xaver\n\nText.\n");
  assert.match(c, /Si Xaver/);
  assert.doesNotMatch(c, /Pravidlá roly/);
});

test("jedna rola vloží jej súbor", () => {
  const c = run("# Xaver\n\nRole: spravca-servera\n");
  assert.match(c, /# Pravidlá roly: správca servera/);
  assert.doesNotMatch(c, /# Pravidlá roly: správca agentov/);
});

test("dve roly vložia oba súbory", () => {
  const c = run("# Xaver\n\nRole: zastupca-operatora, spravca-agentov\n");
  assert.match(c, /# Pravidlá roly: zástupca operátora/);
  assert.match(c, /# Pravidlá roly: správca agentov/);
});

test("neznámy slug dá upozornenie a hook nepadne", () => {
  const c = run("# Xaver\n\nRole: spravca-servera, nic-take\n");
  assert.match(c, /# Pravidlá roly: správca servera/);
  assert.match(c, /Upozornenie: PERSONA.md uvádza rolu `nic-take`/);
});

test("slug s cestou neunikne z roles", () => {
  const c = run("# Xaver\n\nRole: ../README\n");
  assert.match(c, /Upozornenie/);
  assert.doesNotMatch(c, /mapa repa/);
});

test("bez PERSONA.md hook mlčí", () => {
  assert.equal(run(null), "");
});
