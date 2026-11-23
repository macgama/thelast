// Vrai direct : publication heure par heure, votes et colis des spectateurs.
// La partie « base de données » tourne sur un Postgres local avec supabase/schema.sql (ignorée s'il n'y en a pas).
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pool from "../data/characters.json";
import config from "../config/season.json";
import { island } from "../src/engine/arenas/island";
import { Season } from "../src/engine/season";
import type { Character, SeasonConfig } from "../src/engine/types";
import { buildReplay } from "../src/live/replay";
import { HOUR, baseOf, buildRows, decisionTicks, publishUntil, tickTime } from "../src/live/rows";
import { runOnce } from "../src/live/run";
import { LiveStore, Rest } from "../src/live/store";
import { ANON_KEY, SERVICE_KEY, startMini, type Mini } from "./supabase/mini-supabase";

const chars = pool as Character[];
const cfg = { ...(config as SeasonConfig), seed: 7, voteOpenHour: 16 };

describe("moteur : vrais votes et vrais colis", () => {
  const sim = (extra: Partial<SeasonConfig>) => new Season(chars, island, { ...cfg, ...extra }).run();
  it("le vote des vrais spectateurs décide qui part, et seulement ça", () => {
    const a = sim({});
    const thr = a.events.find((e) => e.type === "vote_threat")!;
    const day = String(Math.floor(thr.tick / 24) + 1);
    const outA = a.events.find((e) => e.tick === thr.tick && e.type === "evacuated" && e.data?.cause === "vote")!.actors[0];
    // tout le monde vote pour sauver celui qui serait parti
    const b = sim({ realVotes: { [day]: { [outA]: 5 } } });
    const outB = b.events.find((e) => e.tick === thr.tick && e.type === "evacuated" && e.data?.cause === "vote")!.actors[0];
    expect(outB).not.toBe(outA);
    expect(thr.actors).toContain(outB);
    // avant ce vote, rien n'a changé
    expect(b.events.filter((e) => e.tick < thr.tick).length).toBe(a.events.filter((e) => e.tick < thr.tick).length);
  });
  it("un colis de vrais spectateurs arrive à midi avec l'objet choisi", () => {
    const a = sim({});
    const id = a.cast[3].id;
    const b = sim({ realGifts: { "1": { [id]: { medkit: 9 } } } });
    const got = b.events.find((e) => e.tick === 12 && (e.type === "gift_delivered" || e.type === "gift_lost") && e.actors[0] === id);
    expect(got).toBeTruthy();
    expect(got!.data?.item).toBe("medkit");
  });
});

describe("publication heure par heure", () => {
  const r = new Season(chars, island, cfg).run();
  const rep = buildReplay(r, { looks: {}, ai: null });
  const start = Date.parse("2026-12-07T07:00:00Z"); // lundi 8h à Paris
  const base = baseOf(start);
  it("s'arrête juste avant la prochaine décision des spectateurs", () => {
    expect(decisionTicks(cfg).slice(0, 3)).toEqual([12, 19, 36]);
    expect(publishUntil(cfg, base, start - 10 * HOUR, 999)).toBe(11);
    expect(publishUntil(cfg, base, tickTime(base, 12) + 1000, 999)).toBe(18);
    expect(publishUntil(cfg, base, tickTime(base, 19) + 1000, 999)).toBe(35);
  });
  it("ne publie rien qui puisse encore changer", () => {
    const until = publishUntil(cfg, base, tickTime(base, 19) + 1000, 999);
    const rows = buildRows(rep, cfg, base, until, tickTime(base, 19) + 1000);
    const ticks = rows.filter((x) => x.kind === "tick").map((x) => Number(x.key));
    expect(Math.max(...ticks)).toBe(35);
    expect(rows.some((x) => x.kind === "daily" && x.key === "1")).toBe(true);
    expect(rows.some((x) => x.kind === "daily" && x.key === "2")).toBe(false);
    expect(rows.find((x) => x.kind === "threat" && x.key === "1")!.reveal_at).toBe(new Date(tickTime(base, 16)).toISOString());
    expect(rows.some((x) => x.kind === "threat" && x.key === "2")).toBe(false);
    expect(rows.some((x) => x.kind === "end")).toBe(false);
  });
  it("publie toute la saison une fois finie", () => {
    const rows = buildRows(rep, cfg, base, 999, start + 8 * 24 * HOUR);
    expect(rows.filter((x) => x.kind === "tick").length).toBe(rep.snapshots.length);
    expect(rows.find((x) => x.kind === "end")!.payload).toEqual({ winner: rep.winner });
    expect(rows.filter((x) => x.kind === "secret").length).toBe(rep.cast.length);
  });
});

// ---------- avec une vraie base ----------
const hasPg = existsSync("/var/run/postgresql/.s.PGSQL.5432");
describe.skipIf(!hasPg)("base de données (Postgres local + schéma Supabase)", () => {
  let mini: Mini;
  const psql = (sql: string) => execSync(`su postgres -c "psql -q -v ON_ERROR_STOP=1 ${sql}"`, { stdio: "pipe" });
  beforeAll(async () => {
    psql(`-c 'drop database if exists thelast_test' -c 'create database thelast_test'`);
    psql(`-d thelast_test -f tests/supabase/fake-supabase.sql -f supabase/schema.sql`);
    mini = await startMini(54329, "thelast_test");
  }, 30000);
  afterAll(async () => { await mini?.close(); });

  const call = async (path: string, init: RequestInit & { token?: string } = {}) => {
    const res = await fetch(`${mini.url}${path}`, { ...init, headers: { apikey: ANON_KEY, "content-type": "application/json", ...(init.token ? { authorization: `Bearer ${init.token}` } : {}), ...(init.headers ?? {}) } });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  const signup = async (email: string, pseudo: string) => (await call("/auth/v1/signup", { method: "POST", body: JSON.stringify({ email, password: "secret123", data: { pseudo } }) })).body.access_token as string;

  it("une saison complète : comptes, diffusion à l'heure, vote, colis", async () => {
    const admin = await signup("a@test.fr", "Gaël");
    const viewer = await signup("b@test.fr", "Léa");
    const me = await call("/rest/v1/profiles?select=pseudo,role,plan", { token: viewer });
    expect(me.body).toEqual([{ pseudo: "Léa", role: "viewer", plan: "sub" }]);
    expect((await call("/rest/v1/profiles?select=role", { token: admin })).body.map((x: any) => x.role).sort()).toEqual(["admin", "viewer"]);

    // l'admin programme une saison : maintenant = jour 2, 17h30 (vote ouvert de 16h à 19h)
    const now = Date.now();
    const base = now - (24 + 17.5) * HOUR;
    const startAt = new Date(base + 8 * HOUR).toISOString();
    const created = await call("/rest/v1/seasons", { method: "POST", token: admin, headers: { prefer: "return=representation" }, body: JSON.stringify({ name: "Test", seed: 7, start_at: startAt, status: "scheduled", config: { voteOpenHour: 16 } }) });
    expect(created.status).toBe(200);
    const sid = created.body[0].id;
    // un spectateur ne peut pas créer de saison
    expect((await call("/rest/v1/seasons", { method: "POST", token: viewer, body: JSON.stringify({ name: "Pirate", start_at: startAt }) })).status).toBe(403);

    const store = new LiveStore(new Rest(mini.url, SERVICE_KEY));
    const out = await runOnce(store, { now, log: () => {} });
    expect(out?.until).toBe(42); // jour 2, 18h : juste avant le vote de 19h
    expect(out?.status).toBe("live");

    // ce qui est visible à l'heure qu'il est
    const anon = await call(`/rest/v1/reveals?select=kind,key&season_id=eq.${sid}`);
    const kinds = new Set(anon.body.map((x: any) => x.kind));
    expect(kinds.has("tick")).toBe(false); // sans compte : pas de direct
    expect(kinds.has("daily")).toBe(true); // mais la Quotidienne
    const sub = await call(`/rest/v1/reveals?select=kind,key&season_id=eq.${sid}&kind=eq.tick`, { token: viewer });
    const shown = sub.body.map((x: any) => Number(x.key));
    expect(Math.max(...shown)).toBe(41); // 17h : 18h n'est pas encore diffusé
    expect((await call(`/rest/v1/characters?select=id&limit=1`, { token: viewer })).body).toEqual([]); // secrets protégés
    expect((await call(`/rest/v1/season_private?select=season_id`, { token: admin })).body).toEqual([]);

    // le vote du soir
    const thr = (await call(`/rest/v1/reveals?select=payload&season_id=eq.${sid}&kind=eq.threat&key=eq.2`, { token: viewer })).body[0].payload;
    expect(thr.ids).toHaveLength(3);
    const notThr = (await call(`/rest/v1/seasons?select=public&id=eq.${sid}`)).body[0].public.cast.map((c: any) => c.id).find((id: string) => !thr.ids.includes(id));
    expect((await call("/rest/v1/rpc/cast_vote", { method: "POST", token: viewer, body: JSON.stringify({ p_season: sid, p_character: notThr }) })).body.message).toBe("not_threatened");
    expect((await call("/rest/v1/rpc/cast_vote", { method: "POST", body: JSON.stringify({ p_season: sid, p_character: thr.ids[0] }) })).status).toBe(400);
    const v = await call("/rest/v1/rpc/cast_vote", { method: "POST", token: viewer, body: JSON.stringify({ p_season: sid, p_character: thr.ids[2] }) });
    expect(v.body.day).toBe(2);
    await call("/rest/v1/rpc/cast_vote", { method: "POST", token: admin, body: JSON.stringify({ p_season: sid, p_character: thr.ids[2] }) });
    expect((await call("/rest/v1/rpc/vote_count", { method: "POST", body: JSON.stringify({ p_season: sid, p_day: 2 }) })).body).toBe(2);
    expect((await call("/rest/v1/rpc/vote_results", { method: "POST", body: JSON.stringify({ p_season: sid }) })).body).toEqual([]); // pas avant 19h

    // un colis par jour
    const g = await call("/rest/v1/rpc/send_gift", { method: "POST", token: viewer, body: JSON.stringify({ p_season: sid, p_character: thr.ids[2], p_item: "flask" }) });
    expect(g.body.day).toBe(3);
    expect((await call("/rest/v1/rpc/send_gift", { method: "POST", token: viewer, body: JSON.stringify({ p_season: sid, p_character: thr.ids[1], p_item: "flask" }) })).body.message).toBe("gift_used");

    // 19h05 : le moteur compte les voix ; celui que le public a sauvé reste
    const later = await runOnce(store, { now: now + 1.6 * HOUR, log: () => {} });
    expect(later?.until).toBe(59);
    const all = await store.db.all<any>(`reveals?select=kind,key,payload&season_id=eq.${sid}&kind=eq.tick`);
    const evac = all.flatMap((x) => x.payload.e).find((e: any) => e.t === 43 && e.type === "evacuated" && e.d?.cause === "vote");
    expect(thr.ids).toContain(evac.a[0]);
    expect(evac.a[0]).not.toBe(thr.ids[2]);
    // relancer ne change rien
    expect((await runOnce(store, { now: now + 1.6 * HOUR, log: () => {} }))?.changed).toBe(0);
    // le back-office : l'admin voit les spectateurs, un spectateur non
    expect((await call("/rest/v1/rpc/admin_users", { method: "POST", token: admin, body: "{}" })).body).toHaveLength(2);
    expect((await call("/rest/v1/rpc/admin_users", { method: "POST", token: viewer, body: "{}" })).body.message).toBe("admin_only");
    expect((await call(`/rest/v1/characters?select=id`, { token: admin })).body).toHaveLength(100);
  }, 60000);
});
