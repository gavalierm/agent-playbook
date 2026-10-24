// Test D0141 (úloha 424): zamietnutie hooku nesie "Správny postup:" a strážca
// lib/deny_check.mjs zlyhá na hooku, ktorý zamieta mimo lib/deny.mjs a deny.sh.
// Nevolá živý Tasker, schránky ani T3. Spustenie: node --test lib/deny.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LABEL, withPostup, denyTool, blockStop } from "./deny.mjs";
import { denyProblems } from "./deny_check.mjs";
import { postupFor, POSTUPY } from "../hooks/reply_guard.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const hook = (name, input, env = {}) =>
  spawnSync("node", [join(REPO, "hooks", name)], { input: JSON.stringify(input), encoding: "utf8", env: { ...process.env, REPLY_GUARD_NO_NET: "1", AR_ROZHODNUTIA: "", ...env } });
const postupOf = (text) => (text.match(/Správny postup: (.+)/) || [])[1] || "";
const denyReason = (r) => JSON.parse(r.stdout).hookSpecificOutput.permissionDecisionReason;

test("helper vyžaduje dôvod a konkrétny postup", () => {
  assert.throws(() => withPostup("dôvod", ""), /správny postup/);
  assert.throws(() => withPostup("dôvod", "   "), /správny postup/);
  assert.throws(() => withPostup("dôvod", "skús inak"), /správny postup/);
  assert.throws(() => withPostup("", "krok"), /dôvod/);
  assert.equal(withPostup("dôvod.", "`cmd`"), `dôvod.\n${LABEL} \`cmd\``);
  let out = "";
  denyTool("d", "p", { write: (s) => (out += s) });
  assert.equal(JSON.parse(out).hookSpecificOutput.permissionDecision, "deny");
  assert.match(JSON.parse(out).hookSpecificOutput.permissionDecisionReason, /\nSprávny postup: p$/);
  let line = "";
  blockStop("d", "p", (s) => (line = s));
  assert.match(JSON.parse(line).reason, /Správny postup: p$/);
  assert.throws(() => denyTool("d", "", { write() {} }));
});

test("PreToolUse hook own_rule_scope zamietne s postupom", () => {
  // HOME a AR_STATE v dočasnom priečinku, hook cieľový súbor len číta.
  const root = mkdtempSync(join(tmpdir(), "deny-ors-"));
  try {
    const home = join(root, "home");
    mkdirSync(join(home, "Work", "agent-demo"), { recursive: true });
    const input = { session_id: "s1", cwd: "/tmp", tool_name: "Edit", tool_input: { file_path: join(home, "Work", "agent-demo", "CLAUDE.md"), old_string: "- a", new_string: "- a\n- nové pravidlo, ktoré je dosť dlhé na to, aby sa zachytilo" } };
    const r = hook("own_rule_scope.mjs", input, { HOME: home, AR_STATE: join(root, "state") });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(r.stdout, "bez zamietnutia");
    assert.match(postupOf(denyReason(r)), /zopakuj ten istý zápis/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Stop hooky nesú postup", () => {
  const waiting = hook("no_operator_commands.mjs", { last_assistant_message: "Čaká na teba:\n- zruš kartu" });
  assert.match(postupOf(JSON.parse(waiting.stdout).reason), /tasker task add/);
  const cmd = hook("no_operator_commands.mjs", { last_assistant_message: "Spusti:\n```sh\nnpm test\n```" });
  assert.match(postupOf(JSON.parse(cmd.stdout).reason), /Príkaz pre teba, lebo/);
  const dir = mkdtempSync(join(tmpdir(), "deny-"));
  try {
    const tr = join(dir, "t.jsonl");
    const ev = (type, content) => JSON.stringify({ type, message: { content } });
    writeFileSync(tr, [ev("user", "ahoj"), ev("assistant", [{ type: "text", text: "Máš pravdu, moja chyba." }])].join("\n"));
    const o = hook("objection_fix.mjs", { transcript_path: tr });
    assert.match(postupOf(JSON.parse(o.stdout).reason), /git commit/);
    const long = "Prvá veta tu je. ".repeat(10);
    const rg = hook("reply_guard.mjs", { last_assistant_message: long });
    assert.match(postupOf(JSON.parse(rg.stdout).reason), /docs\//);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("reply_guard: každý dôvod má vlastný postup, nie náhradný", () => {
  const samples = [
    'odpoveď nezačína menom, napíš na prvý riadok samotné "správca agentov:"',
    "odpoveď má 9 viet prózy, strop je 6.",
    'veta so 40 slovami je súvetie, rozdeľ ju alebo zmaž: "x"',
    'položka zoznamu "x" má 2 viet, položka je jedna veta',
    'odklad overenia na nasadenie: "x". Overenie',
    "adresa http://127.0.0.1:1 je localhost servera",
    "zmienka úlohy Taskera bez odkazu, operátor ju má",
    '"Čaká na teba" bez odkazu na úlohu Taskera: "x".',
    'úloha 5 v "Čaká na teba" v Taskeri neexistuje.',
    'úloha 5 v "Čaká na teba" je v stave done, nie needs_human.',
    'Tasker neodpovedal, nepoznám stav úloh v "Čaká na teba".',
    'veta "x" hlási nové rozhodnutie operátora, ale',
    "adresa https://x.invalid dnes neodpovedá (kód 500).",
  ];
  const fallback = postupFor("neznámy dôvod");
  for (const s of samples) assert.notEqual(postupFor(s), fallback, s);
  assert.ok(POSTUPY.length >= samples.length - 2);
});

test("shell: deny_postup s prázdnym postupom vráti 2, s postupom vypíše riadok", () => {
  const run = (call) => spawnSync("bash", ["-c", `source ${join(REPO, "lib", "deny.sh")}; ${call}`], { encoding: "utf8" });
  const bad = run('deny_postup "dôvod" ""');
  assert.equal(bad.status, 2);
  const good = run('deny_postup "dôvod" "git rebase origin/main"');
  assert.equal(good.status, 0);
  assert.match(good.stderr, /^dôvod\nSprávny postup: git rebase origin\/main\n$/);
});

test("strážca: repo je čisté", () => {
  assert.deepEqual(denyProblems(REPO), []);
});

test("strážca padne na hooku so surovým zamietnutím (replay pôvodného tasker_root.mjs)", () => {
  const dir = mkdtempSync(join(tmpdir(), "deny-fixture-"));
  try {
    mkdirSync(join(dir, "hooks")); mkdirSync(join(dir, "lib")); mkdirSync(join(dir, ".githooks"));
    // Pôvodné vyvolanie zamietnutia z tasker_root.mjs pred úlohou 424.
    writeFileSync(join(dir, "hooks", "stary.mjs"), `process.stdout.write(\n  JSON.stringify({\n    hookSpecificOutput: {\n      hookEventName: "PreToolUse",\n      permissionDecision: "deny",\n      permissionDecisionReason: \`\${MESSAGE} (\${why})\`,\n    },\n  }),\n);\n`);
    writeFileSync(join(dir, "hooks", "stop.mjs"), 'console.log(JSON.stringify({ decision: "block", reason }));\n');
    writeFileSync(join(dir, "hooks", "exit.mjs"), "if (v) { process.stderr.write(v); process.exit(2); }\n");
    writeFileSync(join(dir, "hooks", "komentar.mjs"), '// permissionDecision: "deny" len v komentári\nexport {};\n');
    writeFileSync(join(dir, "hooks", "ask.mjs"), "const o = { permissionDecision: decision };\n");
    writeFileSync(join(dir, "lib", "x_guard.sh"), 'rc=0\necho "Commit odmietnutý: x" >&2\nrc=1\nexit $rc\n');
    writeFileSync(join(dir, "lib", "y_guard.sh"), 'source "$here/deny.sh"\nrc=0\ndeny_postup "dôvod" ""\nrc=1\nexit $rc\n');
    writeFileSync(join(dir, ".githooks", "pre-commit"), 'node check.mjs || { echo "odmietnuté" >&2; exit 1; }\n');
    const p = denyProblems(dir);
    for (const want of ["hooks/stary.mjs:5:", "hooks/stop.mjs:1:", "hooks/exit.mjs:1:", "lib/x_guard.sh:2:", "lib/x_guard.sh: odmieta", "lib/y_guard.sh:3: deny_postup bez", ".githooks/pre-commit:1:"])
      assert.ok(p.some((l) => l.startsWith(want)), `${want} chýba v:\n${p.join("\n")}`);
    assert.ok(!p.some((l) => l.includes("komentar.mjs") || l.includes("ask.mjs")));
    // Po oprave (zamietnutie cez helper) strážca mlčí.
    writeFileSync(join(dir, "hooks", "stary.mjs"), 'import { denyTool } from "../lib/deny.mjs";\ndenyTool(reason, postup);\n');
    for (const f of ["stop", "exit"]) rmSync(join(dir, "hooks", f + ".mjs"));
    writeFileSync(join(dir, "lib", "x_guard.sh"), 'source "$here/deny.sh"\nrc=0\ndeny_postup "d" "krok"\nrc=1\nexit $rc\n');
    writeFileSync(join(dir, "lib", "y_guard.sh"), 'source "$here/deny.sh"\ndeny_postup "d" "krok"\nrc=1\n');
    writeFileSync(join(dir, ".githooks", "pre-commit"), 'source lib/deny.sh\nnode check.mjs || { deny_postup "d" "krok"; exit 1; }\n');
    assert.deepEqual(denyProblems(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
