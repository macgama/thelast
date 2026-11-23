// Fait écrire par Gemini les bulles de dialogue et les confessionnaux d'une saison.
// Usage : npm run ai -- [graine=42]   -> data/ai/season-<graine>.json
// Le travail est sauvegardé après chaque appel : relancer la commande reprend où elle s'était arrêtée.
// Sans clé, ou quand le quota gratuit est épuisé, la commande s'arrête proprement :
// la démo garde alors les textes écrits à la main pour ce qui manque.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { island } from "../engine/arenas/island";
import { Season, dayOf, hourOf } from "../engine/season";
import type { Character, SeasonConfig } from "../engine/types";
import { Narrator } from "../narration/narrator";
import { Gemini, QuotaError } from "../ai/gemini";
import { SYSTEM, SLOTS, card, linesPrompt, confessionPrompt, type EvLite, type ConfIn } from "../ai/prompts";
import { aiKey, secretDayFor, type AiSeason } from "../ai/season-text";

const pool: Character[] = JSON.parse(readFileSync("data/characters.json", "utf8"));
const config: SeasonConfig = JSON.parse(readFileSync("config/season.json", "utf8"));
if (process.argv[2]) config.seed = Number(process.argv[2]);
const ai = JSON.parse(readFileSync("config/ai.json", "utf8"));
const featured = JSON.parse(readFileSync("demo/featured.json", "utf8"));

const r = new Season(pool, island, config).run();
const fr = new Narrator(r, "fr");
const C = Object.fromEntries(r.cast.map((c) => [c.id, c]));
const out = `data/ai/season-${config.seed}.json`;
mkdirSync("data/ai", { recursive: true });
const store: AiSeason = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : { seed: config.seed, model: "", lines: {}, confessions: {} };
const save = () => writeFileSync(out, JSON.stringify(store, null, 1) + "\n");
const g = new Gemini(ai);

const events = r.events.filter((e) => (e.weight >= 2 || e.type === "evacuated") && fr.line(e));
const outAt = Object.fromEntries(r.final.filter((s) => !s.alive).map((s) => [s.id, s.eliminatedAt!]));
const snapAt = (tick: number) => [...r.snapshots].reverse().find((s) => s.tick <= tick)?.people ?? {};

async function run() {
  console.log(`Saison ${config.seed} · modèle ${g.model} · ${events.length} scènes · 7 jours de confessionnaux`);
  for (let day = 1; day <= config.days; day++) {
    // 1. bulles de dialogue
    const todo: EvLite[] = events.filter((e) => dayOf(e.tick) === day && SLOTS[e.type] && !store.lines[aiKey(e)])
      .map((e) => ({ key: aiKey(e), type: e.type, hour: `${hourOf(e.tick)}h`, actors: e.actors.map((id) => C[id]?.name ?? id), fr: fr.line(e)!, caught: !!e.data?.caught, betrayal: !!e.data?.betrayal }));
    for (let i = 0; i < todo.length; i += ai.eventsPerCall) {
      const chunk = todo.slice(i, i + ai.eventsPerCall);
      const ids = [...new Set(events.filter((e) => chunk.some((c) => c.key === aiKey(e))).flatMap((e) => e.actors))];
      const res = await g.json<Record<string, Record<string, { fr: string; en: string }>>>(SYSTEM, linesPrompt(day, chunk, ids.map((id) => card(C[id]))));
      for (const c of chunk) if (res[c.key]) store.lines[c.key] = clean(res[c.key]);
      store.model = g.model; save();
      console.log(`  jour ${day} · bulles ${Math.min(i + ai.eventsPerCall, todo.length)}/${todo.length}`);
    }
    // 2. confessionnaux (tous les candidats en jeu à 21 h, ou évacués ce jour-là)
    const end = Math.min((day - 1) * 24 + 21, r.snapshots.at(-1)!.tick);
    const present = r.cast.filter((c) => !featured[c.id] && !store.confessions[c.id]?.[day] && wasAliveOn(c.id, day));
    for (let i = 0; i < present.length; i += ai.charactersPerCall) {
      const chunk = present.slice(i, i + ai.charactersPerCall);
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
      store.model = g.model; save();
      console.log(`  jour ${day} · confessionnaux ${Math.min(i + ai.charactersPerCall, present.length)}/${present.length}`);
    }
  }
  console.log(`Terminé : ${out}. Lance « npm run replay » pour mettre la démo à jour.`);
}

function wasAliveOn(id: string, day: number) { return outAt[id] === undefined || dayOf(outAt[id]) >= day; }
function clean(o: Record<string, { fr: string; en: string }>) {
  const res: Record<string, { fr: string; en: string }> = {};
  for (const [k, v] of Object.entries(o)) if (v?.fr && v.fr.length <= 90) res[k] = { fr: v.fr.trim(), en: (v.en ?? "").trim() };
  return res;
}

run().catch((e) => {
  if (Object.keys(store.lines).length || Object.keys(store.confessions).length) save();
  if (e instanceof QuotaError) console.log(`${e.message} Ce qui est écrit est sauvegardé ; relance plus tard pour continuer.`);
  else console.log(`Arrêt. ${e.message} Ce qui a déjà été écrit est sauvegardé.`);
  process.exitCode = e instanceof QuotaError ? 0 : 1;
});
