// Lance une saison complète et écrit les récits dans out/.
// Usage : npm run simulate -- [graine]
// Avec la variable GEMINI_API_KEY, la quotidienne et le prime sont réécrits par l'IA.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { island } from "../engine/arenas/island";
import { Season, dayOf } from "../engine/season";
import type { Character, Lang, SeasonConfig } from "../engine/types";
import { Narrator } from "../narration/narrator";
import { UI } from "../narration/templates";
import { polisherFromEnv } from "../narration/llm";

const pool: Character[] = JSON.parse(readFileSync("data/characters.json", "utf8"));
const config: SeasonConfig = JSON.parse(readFileSync("config/season.json", "utf8"));
if (process.argv[2]) config.seed = Number(process.argv[2]);

const result = new Season(pool, island, config).run();
const dir = `out/saison-${config.seed}`;
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/season.json`, JSON.stringify(result, null, 2));

const polisher = polisherFromEnv();
for (const lang of ["fr", "en"] as Lang[]) {
  const n = new Narrator(result, lang);
  const parts = [`# The Last · ${result.arena.name[lang]}`, ""];
  for (let d = 1; d <= config.days; d++) {
    const daily = await polisher.polish(n.daily(d), lang, "daily");
    parts.push(`## ${UI.day[lang]} ${d}`, "", daily, "", `<details><summary>${UI.feed[lang]}</summary>`, "", n.feed(d), "", "</details>", "");
  }
  parts.push(await polisher.polish(n.prime(), lang, "prime"));
  writeFileSync(`${dir}/saison.${lang}.md`, parts.join("\n") + "\n");
}

const winner = result.cast.find((c) => c.id === result.winner);
const perDay = Array.from({ length: config.days }, (_, i) => result.final.filter((s) => s.eliminatedAt !== undefined && dayOf(s.eliminatedAt) === i + 1).length);
console.log(`Saison ${config.seed} terminée (${polisher.name}).`);
console.log(`Vainqueur : ${winner?.name ?? "aucun"}`);
console.log(`Évacuations par jour : ${perDay.join(" · ")}`);
console.log(`Récits : ${dir}/saison.fr.md et ${dir}/saison.en.md`);
