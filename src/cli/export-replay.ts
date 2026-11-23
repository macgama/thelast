// Exporte une saison au format compact lu par la démo visuelle (demo/survivor.html).
// Usage : npm run replay -- [graine=42]  -> demo/data.json
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { Look } from "../characters/looks.js";
import type { AiSeason } from "../ai/season-text";
import { island } from "../engine/arenas/island";
import { Season } from "../engine/season";
import type { Character, SeasonConfig } from "../engine/types";
import { buildReplay } from "../live/replay";

const pool: Character[] = JSON.parse(readFileSync("data/characters.json", "utf8"));
const config: SeasonConfig = JSON.parse(readFileSync("config/season.json", "utf8"));
if (process.argv[2]) config.seed = Number(process.argv[2]);
const featured = JSON.parse(readFileSync("demo/featured.json", "utf8"));
const looks: Record<string, Look> = Object.fromEntries(JSON.parse(readFileSync("data/looks.json", "utf8")).map((l: Look) => [l.id, l]));

const r = new Season(pool, island, config).run();
// Textes écrits par l'IA (npm run ai), s'ils existent ; sinon on garde les textes écrits à la main.
const aiPath = `data/ai/season-${config.seed}.json`;
const ai: AiSeason | null = existsSync(aiPath) ? JSON.parse(readFileSync(aiPath, "utf8")) : null;
// Les fiches écrites à la main racontent la saison 42 : on ne les utilise que pour elle.
const out = buildReplay(r, { looks, ai, featured: config.seed === 42 ? featured : {} });
writeFileSync("demo/data.json", JSON.stringify(out));
console.log(`demo/data.json : ${out.cast.length} personnages, ${out.events.length} événements, ${out.snapshots.length} heures`);
