// tasker_read.mjs: čítanie úloh Taskera pre hooky (rozhodnutia_context.mjs,
// reply_guard.mjs). Len na čítanie. Server: DB Taskera cez node:sqlite
// s readOnly, ako runtime/tasker_events.mjs súkromného repa správcu agentov. Mac: Tasker
// tam nebeží, `GET /api/tasks` webu cez Tailscale (TASKER_WEB_URL). Cesta
// k DB je TASKER_DB, inak DEFAULT_DB. Keď DB na stroji nie je, ide sa cez
// web. Chyba (DB zamknutá, web neodpovedal) sa hodí volajúcemu, ten rozhodne,
// či zlyhá otvorene alebo zatvorene.
import { existsSync } from "node:fs";

export const DEFAULT_DB = "/home/tasker/.tasker/tasker.db";
export const DEFAULT_WEB = "https://server.tailnet.ts.net:8801";

// Vráti pole { id, title, status, assignee, project }. `ids` zúži na dané
// úlohy, `status` na jeden stav.
export async function fetchTasks({ ids, status, env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const db = env.TASKER_DB || DEFAULT_DB;
  // Výslovne zadaná DB, ktorá neexistuje, je chyba, nie dôvod siahnuť na živú
  // DB alebo web (testy ukazujú TASKER_DB na fixtúru).
  if (env.TASKER_DB && !existsSync(db)) throw new Error(`TASKER_DB ${db} neexistuje`);
  let rows;
  if (existsSync(db)) {
    // node:sqlite v Node 22 vypíše ExperimentalWarning, ten tu nič nenesie.
    const emit = process.emitWarning;
    process.emitWarning = (w, ...a) => (String(w).includes("SQLite") ? undefined : emit.call(process, w, ...a));
    const { DatabaseSync } = await import("node:sqlite");
    const d = new DatabaseSync(db, { readOnly: true });
    try {
      d.exec("PRAGMA busy_timeout=2000");
      rows = d.prepare("SELECT id, title, status, assignee, project FROM tasks").all().map((r) => ({ ...r }));
    } finally { d.close(); }
  } else {
    const base = (env.TASKER_WEB_URL || DEFAULT_WEB).replace(/\/+$/, "");
    const res = await fetchImpl(`${base}/api/tasks`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`Tasker odpovedal ${res.status}`);
    rows = (await res.json()).map((t) => ({ id: t.id, title: t.title, status: t.status, assignee: t.assignee ?? null, project: t.project ?? null }));
  }
  if (ids) rows = rows.filter((t) => ids.includes(t.id));
  if (status) rows = rows.filter((t) => t.status === status);
  return rows;
}
