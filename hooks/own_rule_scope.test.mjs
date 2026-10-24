// Test hooku own_rule_scope.mjs. Hook sa spúšťa ako proces s HOME a AR_STATE
// v dočasnom priečinku, živý stav (~/.local/state/agent-rules) a repá agentov
// sa nemenia: hook cieľové súbory len číta. Replay chyby 23. 10. 2026: Edit
// z prepisu vlákna správca agentov (relácia d7cf1c50, záznam 20:43:42) do CLAUDE.md repa agenta,
// vstup je skopírovaný sem, prepis sa môže rotovať.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { agentRepoOf } from "./own_rule_scope.mjs";

const HOOK = new URL("./own_rule_scope.mjs", import.meta.url).pathname;
const RULES = resolve(HOOK, "../..");
const LIVE_STATE = join(homedir(), ".local/state/agent-rules");

// Skutočný vstup Edit z prepisu, riadok s časom 2026-10-23T20:43:42.
const REAL = {
  session_id: "d7cf1c50-01b2-4786-913b-8f066bb67299",
  cwd: "/__HOME__/Work/agent-demo",
  tool_name: "Edit",
  tool_input: {
    replace_all: false,
    file_path: "/__HOME__/Work/agent-demo/CLAUDE.md",
    old_string: "- Pred zadaním úlohy sub-agentovi pozriem posledné udalosti `work`",
    new_string: "- Úlohu, ktorú robím sám alebo cez sub-agenta, zakladám s `--assign spravca-agentov`.\n  Bez riešiteľa ju po dokončení blokérov nikto nezobudí a web ukáže \"bez\n  riešiteľa\" pri histórii práce. Chyba 23. 10. 2026: úloha 427 stála 52\n  minút, operátor to rozporoval. Kontrola je úloha 454 (`tasker work` priradí\n  úlohu bez riešiteľa volajúcemu vláknu).\n- Pred zadaním úlohy sub-agentovi pozriem posledné udalosti `work`",
  },
};

function env() {
  const root = mkdtempSync(join(tmpdir(), "ors-"));
  const e = { ...process.env, HOME: join(root, "home"), AR_STATE: join(root, "state") };
  mkdirSync(e.HOME, { recursive: true });
  for (const p of [e.HOME, e.AR_STATE]) assert.ok(p.startsWith(tmpdir()) && !p.startsWith(LIVE_STATE) && !p.startsWith("/root/"), `živá cesta ${p}`);
  return { e, root };
}
const run = (e, input) => {
  const r = spawnSync("node", [HOOK], { input: JSON.stringify(input).replaceAll("/__HOME__", e.HOME), encoding: "utf8", env: e });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput : null;
};
const edit = (file, old_string, new_string, session_id = "s1") => ({ session_id, cwd: "/tmp", tool_name: "Edit", tool_input: { file_path: file, old_string, new_string } });

test("replay chyby: prvý Edit do /__HOME__/Work/agent-demo/CLAUDE.md zamietnutý, rovnaký druhý prejde", () => {
  const { e } = env();
  const first = run(e, REAL);
  assert.equal(first.permissionDecision, "deny");
  assert.match(first.permissionDecisionReason, /iný agent alebo rola/);
  assert.match(first.permissionDecisionReason, /env\/<prostredie>\/CLAUDE\.md, global\/CLAUDE\.md alebo roles\//);
  assert.match(first.permissionDecisionReason, /\nSprávny postup: /);
  assert.equal(run(e, REAL), null);
});

test("iná relácia alebo iný text sa zamietne znova", () => {
  const { e } = env();
  assert.ok(run(e, REAL));
  assert.equal(run(e, REAL), null);
  assert.ok(run(e, { ...REAL, session_id: "iná" }));
  const changed = structuredClone(REAL);
  changed.tool_input.new_string += "\n- Ďalšie pravidlo";
  assert.ok(run(e, changed));
});

test("zápis do agent-rules (env/server/CLAUDE.md) prejde hneď", () => {
  const { e } = env();
  for (const f of [join(RULES, "env/server/CLAUDE.md"), "/opt/agent-rules/env/server/CLAUDE.md", "/root/agent-rules/global/CLAUDE.md"]) {
    assert.equal(run(e, { ...REAL, tool_input: { ...REAL.tool_input, file_path: f } }), null, f);
  }
});

test("zmazanie riadku a preformulovanie bez prírastku prejde hneď", () => {
  const { e } = env();
  const line = "- Úlohu, ktorú robím sám alebo cez sub-agenta, zakladám s `--assign spravca-agentov`.\n";
  assert.equal(run(e, edit("/__HOME__/Work/agent-demo/CLAUDE.md", line + "- Pred zadaním", "- Pred zadaním")), null);
  assert.equal(run(e, edit("/__HOME__/Work/agent-demo/CLAUDE.md", "- Úlohu zakladám s `--assign spravca-agentov` vždy.", "- Úlohu zakladám s `--assign spravca-agentov`.")), null);
  assert.equal(run(e, edit("/__HOME__/Work/agent-demo/CLAUDE.md", "- Úlohu zakladám s riešiteľom.", "- Úlohu zakladám s riešiteľom spravca-agentov.")), null);
});

test("Write a MultiEdit: pridanie zamietne, Write kratšieho obsahu prejde", () => {
  const { e, root } = env();
  const target = join(e.HOME, "Work/agent-spravca-servera/CLAUDE.md");
  mkdirSync(join(e.HOME, "Work/agent-spravca-servera"), { recursive: true });
  writeFileSync(target, "# správca servera\n\n- jedno\n- dve\n");
  const w = (content) => ({ session_id: "w", cwd: "/tmp", tool_name: "Write", tool_input: { file_path: target, content } });
  assert.equal(run(e, w("# správca servera\n\n- jedno\n")), null);
  assert.ok(run(e, w("# správca servera\n\n- jedno\n- dve\n- tri\n")));
  const m = { session_id: "m", cwd: "/tmp", tool_name: "MultiEdit", tool_input: { file_path: target, edits: [{ old_string: "- jedno", new_string: "- jedno" }, { old_string: "- dve", new_string: "- dve\n- nové pravidlo" }] } };
  assert.ok(run(e, m));
  assert.equal(run(e, m), null);
  assert.ok(root);
});

test("ostatné nástroje, projekty a iné súbory hook nechá tak", () => {
  const { e } = env();
  assert.equal(run(e, { ...REAL, tool_name: "Bash", tool_input: { command: "echo" } }), null);
  for (const f of ["/__HOME__/Work/agent-demo/memory/MEMORY.md", "/root/CLAUDE.md", "/root/.claude/CLAUDE.md", "/tmp/projekt/CLAUDE.md", "/root/agent-rules/CLAUDE.md", "/__HOME__/Work/agent-demo/docs/x.md"]) {
    assert.equal(run(e, { ...REAL, tool_input: { ...REAL.tool_input, file_path: f } }), null, f);
  }
});

test("agentRepoOf: server, tasker, Mac, worktree, projekt", () => {
  const ex = (set) => (p) => set.includes(p);
  const o = { home: "/Users/m", exists: ex(["/root/spravca-agentov/PERSONA.md"]) };
  assert.equal(agentRepoOf("/root/spravca-agentov/CLAUDE.md", o), "/root/spravca-agentov");
  assert.equal(agentRepoOf("/root/spravca-agentov/PERSONA.md", o), "/root/spravca-agentov");
  assert.equal(agentRepoOf("/root/spravca-agentov/.worktrees/x/CLAUDE.md", o), "/root/spravca-agentov");
  assert.equal(agentRepoOf("/root/tasker/CLAUDE.md", o), null);
  assert.equal(agentRepoOf("/home/tasker/agenti/veduci-vyvoja/CLAUDE.md", o), "/home/tasker/agenti/veduci-vyvoja");
  assert.equal(agentRepoOf("/Users/m/Work/agent-zastupca-mac/PERSONA.md", o), "/Users/m/Work/agent-zastupca-mac");
  assert.equal(agentRepoOf("/Users/m/Work/agenti/zastupca-mac/CLAUDE.md", o), "/Users/m/Work/agenti/zastupca-mac");
  assert.equal(agentRepoOf("/Users/m/Work/agent-rules/CLAUDE.md", o), null);
  assert.equal(agentRepoOf("/Users/m/Work/projekt/CLAUDE.md", o), null);
  assert.equal(agentRepoOf("/opt/agent-rules/CLAUDE.md", o), null);
});
