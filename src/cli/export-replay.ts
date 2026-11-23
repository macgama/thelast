// Exporte une saison au format compact lu par la démo visuelle (demo/index.html).
// Usage : npm run replay -- [graine=42]  -> demo/data.json
import { resolveLook, type Look } from "../characters/looks.js";
import { existsSync } from "node:fs";
import { aiKey, secretDayFor, type AiSeason } from "../ai/season-text";
import { readFileSync, writeFileSync } from "node:fs";
import { island } from "../engine/arenas/island";
import { Season, dayOf } from "../engine/season";
import type { Character, SeasonConfig } from "../engine/types";
import { CATASTROPHES } from "../engine/catastrophes";
import { Narrator } from "../narration/narrator";

const pool: Character[] = JSON.parse(readFileSync("data/characters.json", "utf8"));
const config: SeasonConfig = JSON.parse(readFileSync("config/season.json", "utf8"));
if (process.argv[2]) config.seed = Number(process.argv[2]);
const featured = JSON.parse(readFileSync("demo/featured.json", "utf8"));
const looks: Record<string, Look> = Object.fromEntries(JSON.parse(readFileSync("data/looks.json", "utf8")).map((l: Look) => [l.id, l]));

const r = new Season(pool, island, config).run();
// Textes écrits par l'IA (npm run ai), s'ils existent ; sinon on garde les textes écrits à la main.
const aiPath = `data/ai/season-${config.seed}.json`;
const ai: AiSeason | null = existsSync(aiPath) ? JSON.parse(readFileSync(aiPath, "utf8")) : null;
const aiConf = (id: string) => ai?.confessions[id] && Object.keys(ai.confessions[id]).length ? Object.fromEntries(Object.entries(ai.confessions[id]).map(([d, t]) => [d, t.fr])) : null;
const fr = new Narrator(r, "fr");
const en = new Narrator(r, "en");

const cast = r.cast.map((c) => {
  const f = featured[c.id];
  return {
    id: c.id, name: c.name, age: c.age, gender: c.gender,
    origin: c.origin.fr, job: f?.job ?? c.job.fr, bio: f?.bio ?? c.backstory.fr,
    motivation: f?.motivation ?? c.motivation.fr, catchphrase: f?.catchphrase ?? c.catchphrase.fr,
    secret: f?.secret ?? c.secret.fr, secretDay: f?.secretDay ?? (aiConf(c.id) ? secretDayFor(c.id) : null),
    traits: c.traits, skills: c.skills, phobia: c.phobia,
    confessions: f?.confessions ?? aiConf(c.id),
    ai: !f?.confessions && !!aiConf(c.id),
    look: looks[c.id] ? resolveLook(looks[c.id]) : null,
  };
});

const events = r.events
  .filter((e) => e.weight >= 2 || e.type === "evacuated")
  .map((e) => {
    // répliques IA : celles de l'événement, plus le plaidoyer de la campagne pour la scène du vote
    let lines = ai?.lines[aiKey(e)] ?? null;
    if (e.type === "vote_threat" && ai) for (const c of r.events.filter((x) => x.tick === e.tick && x.type === "campaign")) lines = { ...(lines ?? {}), ...(ai.lines[aiKey(c)] ?? {}) };
    const say = lines && Object.keys(lines).length ? Object.fromEntries(Object.entries(lines).map(([k, v]) => [k, [v.fr, v.en]])) : undefined;
    return { t: e.tick, type: e.type, a: e.actors, z: e.zone ?? null, w: e.weight, fr: fr.line(e), en: en.line(e), d: e.data ?? null, ...(say ? { say } : {}) };
  })
  .filter((e) => e.fr);

const out = {
  aiModel: ai?.model ?? null,
  catastrophes: Object.fromEntries(Object.values(CATASTROPHES).map((c) => [c.id, { family: c.family, icon: c.icon, color: c.color ?? null, size: c.size ?? 1, intro: c.intro ?? null, cry: c.cry ?? null }])),
  seed: config.seed,
  days: config.days,
  voteHour: config.voteHour,
  arena: { name: r.arena.name.fr, zones: r.arena.zones.map((z) => ({ id: z.id, name: z.name.fr, neighbors: z.neighbors })) },
  winner: r.winner,
  cast,
  events,
  snapshots: r.snapshots.map((s) => [s.tick, s.people]),
  eliminations: r.final.filter((s) => !s.alive).map((s) => ({ id: s.id, t: s.eliminatedAt, day: dayOf(s.eliminatedAt!), cause: s.eliminationCause })),
};
writeFileSync("demo/data.json", JSON.stringify(out));
console.log(`demo/data.json : ${cast.length} personnages, ${events.length} événements, ${out.snapshots.length} heures`);
