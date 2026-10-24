#!/usr/bin/env node
// identity.mjs — relácia agenta s identitou ohlási v prvej odpovedi, kto je
// (DECISIONS.md 2026-10-14, ohlásenie identity). SessionStart z
// .claude/settings.json repa agenta, beží pri štarte, obnovení, /clear
// aj kompakcii. Meno vezme z nadpisu "# <Meno>" v PERSONA.md koreňa
// projektu, ID relácie zo vstupu hooku. Bez PERSONA.md hook mlčí.
// Riadok "Role: <slug>, <slug>" v PERSONA.md pridá do kontextu pravidlá
// roly zo súborov roles/<slug>.md (cesta ../roles od tohto súboru).
// Neznámy slug dá upozornenie v kontexte, hook nepadne.
//
// Operátor overí ID u zástupcu operátora na Macu príkazom `node hooks/topic.mjs list`.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {}

const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
let name;
let persona = "";
try {
  persona = readFileSync(join(root, "PERSONA.md"), "utf8");
  name = persona.match(/^# (.+)$/m)?.[1].trim();
} catch {}
if (!name) process.exit(0);

const session = (input.session_id || "neznáma").slice(0, 8);
const line = `${name}, persona ${join(root, "PERSONA.md")}, relácia ${session}`;

const rolesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "roles");
const slugs = (persona.match(/^Role:[ \t]*(.+)$/m)?.[1] ?? "")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);
let rules = "";
for (const slug of slugs) {
  try {
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Error("slug");
    rules += `\n\n${readFileSync(join(rolesDir, `${slug}.md`), "utf8").trim()}`;
  } catch {
    rules += `\n\nUpozornenie: PERSONA.md uvádza rolu \`${slug}\`, súbor roles/${slug}.md neexistuje. Oznám to správcovi agentov.`;
  }
}

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: `Si ${name} podľa PERSONA.md. Prvá odpoveď tejto relácie, aj po /clear, obnovení a kompakcii, má na prvom riadku len meno (\`${name}:\`), potom prázdny riadok, riadok unslop, prázdny riadok, riadok \`identita: ${line}\`, prázdny riadok a jednu vetu, kto si, podľa časti "Kto som" v PERSONA.md.${rules}`,
    },
  }),
);
