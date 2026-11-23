// Écriture par Gemini des bulles de dialogue et des confessionnaux d'une saison, jour par jour.
// Utilisé par « npm run ai » (toute la saison de démo) et par le vrai direct (seulement ce qui est déjà joué).
// Le travail est enregistré après chaque appel (onSave) : on peut s'arrêter et reprendre à tout moment.
import { dayOf, hourOf } from "../engine/season";
import type { SeasonResult } from "../engine/types";
import { Narrator } from "../narration/narrator";
import { Gemini } from "./gemini";
import { SYSTEM, SLOTS, card, linesPrompt, confessionPrompt, type EvLite, type ConfIn } from "./prompts";
import { aiKey, secretDayFor, type AiSeason } from "./season-text";

export interface WriteOptions {
  /** Dernière heure (tick) déjà jouée : on n'écrit rien au-delà. */
  maxTick?: number;
  /** Candidats dont les confessionnaux sont écrits à la main (démo). */
  skipConfessions?: Set<string>;
  /** Arrêter proprement après ce délai (ms), pour ne pas dépasser le temps d'un passage du moteur. */
  budgetMs?: number;
  eventsPerCall: number;
  charactersPerCall: number;
  onSave: () => Promise<void> | void;
  log?: (s: string) => void;
}

export async function writeAi(r: SeasonResult, store: AiSeason, g: Gemini, o: WriteOptions) {
  const log = o.log ?? console.log;
  const t0 = Date.now();
  const late = () => o.budgetMs !== undefined && Date.now() - t0 > o.budgetMs;
  const maxTick = o.maxTick ?? Infinity;
  const fr = new Narrator(r, "fr");
  const C = Object.fromEntries(r.cast.map((c) => [c.id, c]));
  const events = r.events.filter((e) => (e.weight >= 2 || e.type === "evacuated") && e.tick <= maxTick && fr.line(e));
  const outAt = Object.fromEntries(r.final.filter((s) => !s.alive).map((s) => [s.id, s.eliminatedAt!]));
  const snapAt = (tick: number) => [...r.snapshots].reverse().find((s) => s.tick <= tick)?.people ?? {};
  const wasAliveOn = (id: string, day: number) => outAt[id] === undefined || dayOf(outAt[id]) >= day;
  const lastTick = r.snapshots.at(-1)!.tick;
  let calls = 0;

  for (let day = 1; day <= r.config.days; day++) {
    if (late()) break;
    // 1. bulles de dialogue
    const todo: EvLite[] = events.filter((e) => dayOf(e.tick) === day && SLOTS[e.type] && !store.lines[aiKey(e)])
      .map((e) => ({ key: aiKey(e), type: e.type, hour: `${hourOf(e.tick)}h`, actors: e.actors.map((id) => C[id]?.name ?? id), fr: fr.line(e)!, caught: !!e.data?.caught, betrayal: !!e.data?.betrayal }));
    for (let i = 0; i < todo.length && !late(); i += o.eventsPerCall) {
      const chunk = todo.slice(i, i + o.eventsPerCall);
      const ids = [...new Set(events.filter((e) => chunk.some((c) => c.key === aiKey(e))).flatMap((e) => e.actors))];
      const res = await g.json<Record<string, Record<string, { fr: string; en: string }>>>(SYSTEM, linesPrompt(day, chunk, ids.map((id) => card(C[id]))));
      for (const c of chunk) store.lines[c.key] = clean(res[c.key] ?? {}); // vide = déjà essayé, on n'y revient pas
      store.model = g.model; calls++; await o.onSave();
      log(`  jour ${day} · bulles ${Math.min(i + o.eventsPerCall, todo.length)}/${todo.length}`);
    }
    // 2. confessionnaux (tous les candidats en jeu à 21 h, ou évacués ce jour-là), une fois la journée jouée
    const end = Math.min((day - 1) * 24 + 21, lastTick);
    if (end > maxTick) break;
    const present = r.cast.filter((c) => !o.skipConfessions?.has(c.id) && !store.confessions[c.id]?.[day] && wasAliveOn(c.id, day));
    for (let i = 0; i < present.length && !late(); i += o.charactersPerCall) {
      const chunk = present.slice(i, i + o.charactersPerCall);
      const list: ConfIn[] = chunk.map((c) => {
        const out = outAt[c.id] !== undefined && dayOf(outAt[c.id]) === day ? fr.line(r.events.find((e) => e.type === "evacuated" && e.actors[0] === c.id)!) ?? "évacué" : null;
        return {
          card: card(c),
          events: events.filter((e) => dayOf(e.tick) === day && e.actors.includes(c.id) && e.type !== "season_start").map((e) => `${hourOf(e.tick)}h : ${fr.line(e)}`),
          clan: snapAt(end)[c.id]?.[4] || null,
          out,
          previous: store.confessions[c.id]?.[day - 1]?.fr ?? null,
          secret: secretDayFor(c.id) === day || (out && secretDayFor(c.id) > day) ? c.secret.fr : null,
        };
      });
      const res = await g.json<Record<string, { fr: string; en: string }>>(SYSTEM, confessionPrompt(day, list));
      for (const c of chunk) if (res[c.id]?.fr) (store.confessions[c.id] ??= {})[day] = { fr: res[c.id].fr.trim(), en: (res[c.id].en ?? "").trim() };
      store.model = g.model; calls++; await o.onSave();
      log(`  jour ${day} · confessionnaux ${Math.min(i + o.charactersPerCall, present.length)}/${present.length}`);
    }
  }
  return { calls, stopped: late() };
}

function clean(o: Record<string, { fr: string; en: string }>) {
  const res: Record<string, { fr: string; en: string }> = {};
  for (const [k, v] of Object.entries(o)) if (v?.fr && v.fr.length <= 90) res[k] = { fr: v.fr.trim(), en: (v.en ?? "").trim() };
  return res;
}
