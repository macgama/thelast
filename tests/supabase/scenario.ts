// Prépare une saison de test dans la base locale : maintenant = jour 2, 17h30 (vote ouvert).
// Usage : tsx tests/supabase/scenario.ts [heures depuis minuit du jour 1 = 41.5] [base=thelast]
import { execSync } from "node:child_process";
import { runOnce } from "../../src/live/run";
import { LiveStore, Rest } from "../../src/live/store";
import { SERVICE_KEY, startMini } from "./mini-supabase";

const hours = Number(process.argv[2] ?? 41.5);
const db = process.argv[3] ?? "thelast";
const psql = (sql: string) => execSync(`su postgres -c "psql -q -v ON_ERROR_STOP=1 ${sql}"`, { stdio: "pipe" });
psql(`-c 'drop database if exists ${db}' -c 'create database ${db}'`);
psql(`-d ${db} -f tests/supabase/fake-supabase.sql -f supabase/schema.sql`);
const mini = await startMini(54321, db);
const now = Date.now();
const startAt = new Date(now - hours * 3600_000 + 8 * 3600_000).toISOString();
const store = new LiveStore(new Rest(mini.url, SERVICE_KEY));
await store.db.req("POST", "seasons", { name: "Saison test", seed: 7, start_at: startAt, status: "scheduled", config: { voteOpenHour: 16 } });
console.log(await runOnce(store, { now, log: console.log }));
console.log(`Prêt : ${mini.url}/survivor.html`);
