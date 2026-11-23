// Exporte une saison au format compact lu par la démo visuelle (demo/index.html).
// Usage : npm run replay -- [graine=42]  -> demo/data.json
import { readFileSync, writeFileSync } from "node:fs";
import { island } from "../engine/arenas/island";
import { Season, dayOf } from "../engine/season";
import type { Character, SeasonConfig } from "../engine/types";
import { Narrator } from "../narration/narrator";

const pool: Character[] = JSON.parse(readFileSync("data/characters.json", "utf8"));
const config: SeasonConfig = JSON.parse(readFileSync("config/season.json", "utf8"));
if (process.argv[2]) config.seed = Number(process.argv[2]);
const featured = JSON.parse(readFileSync("demo/featured.json", "utf8"));

const r = new Season(pool, island, config).run();
const fr = new Narrator(r, "fr");
const en = new Narrator(r, "en");

const cast = r.cast.map((c) => {
  const f = featured[c.id];
  return {
    id: c.id, name: c.name, age: c.age, gender: c.gender,
    origin: c.origin.fr, job: f?.job ?? c.job.fr, bio: f?.bio ?? c.backstory.fr,
    motivation: f?.motivation ?? c.motivation.fr, catchphrase: f?.catchphrase ?? c.catchphrase.fr,
    secret: f?.secret ?? c.secret.fr, secretDay: f?.secretDay ?? null,
    traits: c.traits, skills: c.skills, phobia: c.phobia,
    confessions: f?.confessions ?? null,
  };
});

const events = r.events
  .filter((e) => e.weight >= 2 || e.type === "evacuated")
  .map((e) => ({ t: e.tick, type: e.type, a: e.actors, z: e.zone ?? null, w: e.weight, fr: fr.line(e), en: en.line(e), d: e.data ?? null }))
  .filter((e) => e.fr);

const out = {
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
