// Un passage du moteur du vrai direct (lancé toutes les 10 minutes par GitHub Actions).
// 1. trouve la saison en cours ; au premier passage, fige le casting, les catastrophes et les fiches visuelles ;
// 2. rejoue la saison depuis le début avec les vrais votes et les vrais colis déjà décidés (même graine = même histoire) ;
// 3. publie tout ce qui ne peut plus changer, chaque morceau avec son heure de diffusion ;
// 4. fait écrire par Gemini les répliques et les confessionnaux de ce qui est publié, puis republie.
// Relancer un passage ne casse rien : il ne réécrit que ce qui a changé.
import { readFileSync } from "node:fs";
import type { Look } from "../characters/looks.js";
import { Gemini, QuotaError, type AiConfig } from "../ai/gemini";
import type { AiSeason } from "../ai/season-text";
import { writeAi } from "../ai/writer";
import { island } from "../engine/arenas/island";
import { loadCatastrophes, type Catastrophe } from "../engine/catastrophes";
import { Season, applyCareer } from "../engine/season";
import type { Character, Item, SeasonConfig } from "../engine/types";
import { buildReplay } from "./replay";
import { GIFT_HOUR, baseOf, buildRows, publicMeta, publishUntil, tickAt, tickTime, type LiveConfig } from "./rows";
import type { LiveStore, SeasonRow } from "./store";

const HOUR = 3600_000;
const json = <T>(p: string): T => JSON.parse(readFileSync(p, "utf8"));

export interface RunOptions {
  now?: number;
  gemini?: Gemini | null;
  /** Temps maximal laissé à Gemini dans ce passage (ms). */
  aiBudgetMs?: number;
  log?: (s: string) => void;
}

/** Remplit le back-office avec les fichiers du dépôt la première fois (100 personnages, catastrophes, réglages). */
export async function seedIfEmpty(store: LiveStore, log: (s: string) => void) {
  const db = store.db;
  if (!(await db.get<unknown[]>("characters?select=id&limit=1")).length) {
    const pool = json<Character[]>("data/characters.json");
    const looks = Object.fromEntries(json<Look[]>("data/looks.json").map((l) => [l.id, l]));
    await db.upsert("characters", pool.map((c) => ({ id: c.id, data: c, look: looks[c.id] ?? null, photo: null, active: true })), "id");
    log(`Back-office : ${pool.length} personnages importés.`);
  }
  if (!(await db.get<unknown[]>("catastrophes?select=id&limit=1")).length) {
    const cat = json<{ individual: Catastrophe[]; island: Catastrophe[] }>("config/catastrophes.json");
    const rows = [...cat.individual.map((c) => ({ kind: "individual", c })), ...cat.island.map((c) => ({ kind: "island", c }))]
      .map(({ kind, c }, i) => ({ id: c.id, kind, data: c, active: true, sort: i }));
    await db.upsert("catastrophes", rows, "id");
    log(`Back-office : ${rows.length} catastrophes importées.`);
  }
  if (!(await db.get<unknown[]>("settings?key=eq.season_defaults")).length) {
    await db.upsert("settings", [{ key: "season_defaults", value: defaults() }], "key");
    log("Back-office : réglages de saison par défaut importés.");
  }
}

export function defaults(): LiveConfig {
  return { voteOpenHour: 16, ...json<SeasonConfig>("config/season.json") };
}

export function liveConfig(s: SeasonRow, stored: Partial<LiveConfig> | null): LiveConfig {
  const c = { ...defaults(), ...(stored ?? {}), ...(s.config as Partial<LiveConfig>), seed: s.seed };
  c.voteOpenHour = Math.max(13, Math.min(c.voteHour - 1, c.voteOpenHour));
  return c;
}

export async function runOnce(store: LiveStore, o: RunOptions = {}) {
  const now = o.now ?? Date.now();
  const log = o.log ?? console.log;
  await seedIfEmpty(store, log);
  const s = await store.currentSeason();
  if (!s) { log("Aucune saison programmée : rien à faire. (Back-office > Saisons pour en créer une.)"); return null; }
  const base = baseOf(s.start_at);
  if (now < new Date(s.start_at).getTime() - 48 * HOUR) { log(`« ${s.name} » commence le ${s.start_at} : rien à préparer avant 48 h.`); return null; }

  // 1. Au premier passage, on fige tout ce qui sert à la simulation : la suite de la saison n'en dépendra plus.
  let priv = await store.getPrivate(s.id);
  if (!priv?.pool) {
    const chars = (await store.characters()).filter((c) => c.active);
    const cats = (await store.catastrophes()).filter((c) => c.active);
    const pool = chars.map((c) => c.data as Character);
    const looks = Object.fromEntries(chars.filter((c) => c.look).map((c) => [c.id, { ...c.look, id: c.id, ...(c.photo ? { photo: c.photo } : {}) }]));
    const catalog = { individual: cats.filter((c) => c.kind === "individual").map((c) => c.data), island: cats.filter((c) => c.kind === "island").map((c) => c.data) };
    const ai: AiSeason = { seed: s.seed, model: "", lines: {}, confessions: {} };
    priv = { season_id: s.id, pool, catalog, looks, ai };
    await store.putPrivate(s.id, priv);
    log(`« ${s.name} » : casting figé (${pool.length} personnages dans le pool, ${cats.length} catastrophes).`);
  }
  const config = liveConfig(s, await store.setting<Partial<LiveConfig>>("season_defaults"));
  loadCatastrophes(priv.catalog as { individual: Catastrophe[]; island: Catastrophe[] });

  // 2. Les décisions des spectateurs déjà closes
  const voteClosed = (d: number) => tickTime(base, (d - 1) * 24 + config.voteHour) <= now;
  const realVotes: Record<string, Record<string, number>> = {};
  for (const v of await store.votes(s.id)) if (voteClosed(v.day)) ((realVotes[v.day] ??= {})[v.character_id] = (realVotes[v.day][v.character_id] ?? 0) + 1);
  const giftClosed = (d: number) => tickTime(base, (d - 1) * 24 + GIFT_HOUR) <= now;
  const realGifts: Record<string, Record<string, Partial<Record<Item, number>>>> = {};
  for (const g of await store.gifts(s.id)) if (giftClosed(g.gift_day)) {
    const m = ((realGifts[g.gift_day] ??= {})[g.character_id] ??= {});
    m[g.item as Item] = (m[g.item as Item] ?? 0) + 1;
  }

  const ai = priv.ai as AiSeason;
  const looks = priv.looks as Record<string, Look>;
  const simulate = () => new Season(priv!.pool as Character[], island, { ...config, realVotes, realGifts }).run();
  let r = simulate();
  const lastTick = r.snapshots.at(-1)!.tick;
  const until = publishUntil(config, base, now, lastTick);

  const publish = async () => {
    const rep = buildReplay(r, { looks, ai });
    const rows = buildRows(rep, config, base, until, now);
    const known = new Map((await store.revealHashes(s.id)).map((x) => [`${x.kind}|${x.key}`, x.hash]));
    const changed = rows.filter((x) => known.get(`${x.kind}|${x.key}`) !== x.hash);
    await store.upsertReveals(s.id, changed);
    return { rep, rows, changed: changed.length };
  };

  let { rep, rows, changed } = await publish();
  const patch: Partial<SeasonRow> = {};
  if (!s.public) patch.public = publicMeta(rep, config, s.start_at);
  const ended = rows.some((x) => x.kind === "end");
  const status = ended && tickTime(base, lastTick) <= now ? "done" : now >= new Date(s.start_at).getTime() ? "live" : s.status;
  if (status !== s.status) patch.status = status;
  if (ended) patch.winner = rep.winner;
  log(`« ${s.name} » (graine ${s.seed}) : heure ${tickAt(base, now)} de la saison, publié jusqu'à l'heure ${until} (jour ${Math.floor(until / 24) + 1}, ${until % 24}h), ${changed} morceau(x) mis à jour.`);

  // 3. Gemini écrit les répliques et les confessionnaux de ce qui est déjà joué
  let aiInfo: Record<string, unknown> = { model: ai.model || null, lines: Object.keys(ai.lines).length, confessions: Object.values(ai.confessions).reduce((n, d) => n + Object.keys(d).length, 0) };
  if (o.gemini) {
    const cfg = json<AiConfig & { eventsPerCall: number; charactersPerCall: number }>("config/ai.json");
    try {
      const res = await writeAi(r, ai, o.gemini, {
        maxTick: until, budgetMs: o.aiBudgetMs ?? 6 * 60_000, eventsPerCall: cfg.eventsPerCall, charactersPerCall: cfg.charactersPerCall,
        onSave: () => store.putPrivate(s.id, { ai }), log,
      });
      if (res.calls) { r = simulate(); ({ rep, rows, changed } = await publish()); log(`Gemini : ${res.calls} appel(s), ${changed} morceau(x) enrichi(s).`); }
      aiInfo = { ...aiInfo, calls: res.calls, unfinished: res.stopped };
    } catch (e: any) {
      aiInfo = { ...aiInfo, error: e instanceof QuotaError ? "quota" : String(e?.message ?? e).slice(0, 300) };
      log(`Gemini : ${aiInfo.error} (les textes écrits à la main prennent le relais).`);
    }
    aiInfo.lines = Object.keys(ai.lines).length;
    aiInfo.confessions = Object.values(ai.confessions).reduce((n, d) => n + Object.keys(d).length, 0);
  }

  // 4. Fin de saison : le vainqueur gagne des points et une couronne pour les saisons suivantes (une seule fois)
  const engine = { ...(s.engine ?? {}) } as Record<string, unknown>;
  if (status === "done" && !engine.careerApplied) {
    const played = new Map((await store.characters()).map((c) => [c.id, c]));
    const updated = applyCareer([...played.values()].map((c) => c.data as Character), r);
    const rowsC = updated.filter((c) => r.cast.some((x) => x.id === c.id)).map((c) => ({ ...played.get(c.id)!, data: c, updated_at: new Date().toISOString() }));
    if (rowsC.length) await store.db.upsert("characters", rowsC, "id");
    engine.careerApplied = true;
    log(`Fin de saison : ${r.cast.find((c) => c.id === r.winner)?.name} gagne une couronne et des points de courage et de sang-froid.`);
  }
  Object.assign(engine, { at: new Date(now).toISOString(), until, untilAt: new Date(tickTime(base, until)).toISOString(), changed, ai: aiInfo, error: null });
  await store.updateSeason(s.id, { ...patch, engine });
  return { season: s.id, until, changed, status, rows: rows.length };
}
