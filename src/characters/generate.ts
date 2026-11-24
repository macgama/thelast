// Génère le pool de personnages permanents dans data/characters.json.
// Usage : npm run characters -- [nombre=100] [graine=2026]
import { writeFileSync } from "node:fs";
import { Rng } from "../engine/rng";
import { SKILLS, TRAITS, type Character, type I18n, type Trait } from "../engine/types";
import { agree } from "../narration/templates";
import {
  CATCHPHRASES, CHILDHOOD, FIRST_NAMES, JOBS, MOTIVATIONS, ORIGINS, PHOBIAS, SECRETS, TURNING_POINT,
} from "./pools";

export function generateCharacters(count: number, seed: number): Character[] {
  const rng = new Rng(seed);
  const names = rng.sample(FIRST_NAMES, Math.min(count, FIRST_NAMES.length));
  return names.map((n, i) => {
    const traits = Object.fromEntries(TRAITS.map((tr) => [tr, rng.int(10, 95)])) as Record<Trait, number>;
    const childhood = rng.pick(CHILDHOOD);
    const turning = rng.pick(TURNING_POINT);
    // Accord en genre du français : « {e} » et « masculin|féminin »
    const g = (x: I18n): I18n => ({
      fr: x.fr.replace(/\{e\}/g, agree(n.gender, "fr")).replace(/([^|"]+)\|([^|"]+)/, (_, m, f) => (n.gender === "f" ? f : m)),
      en: x.en,
    });
    const c: Character = {
      id: `c${String(i + 1).padStart(3, "0")}`,
      name: n.name,
      age: rng.int(19, 62),
      gender: n.gender,
      origin: rng.pick(ORIGINS),
      job: g(rng.pick(JOBS)),
      backstory: g({ fr: `${childhood.fr} ${turning.fr}`, en: `${childhood.en} ${turning.en}` }),
      secret: g(rng.pick(SECRETS)),
      motivation: rng.pick(MOTIVATIONS),
      catchphrase: rng.pick(CATCHPHRASES),
      traits,
      skills: rng.sample(SKILLS, rng.int(2, 4)),
      phobia: rng.pick(PHOBIAS),
      career: { seasons: 0, wins: 0, bonus: {}, cosmetics: [] },
    };
    // Cohérence : un secret « ne sait pas nager » exclut la compétence natation
    if (c.secret.en.startsWith("Can't swim")) c.skills = c.skills.filter((sk) => sk !== "swimming");
    return c;
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const count = Number(process.argv[2] ?? 100);
  const seed = Number(process.argv[3] ?? 2026);
  const chars = generateCharacters(count, seed);
  writeFileSync("data/characters.json", JSON.stringify(chars, null, 2) + "\n");
  console.log(`${chars.length} personnages écrits dans data/characters.json`);
}
