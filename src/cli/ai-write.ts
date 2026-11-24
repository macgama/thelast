// Fait écrire par Gemini les bulles de dialogue et les confessionnaux d'une saison.
// Usage : npm run ai -- [graine=42]   -> data/ai/season-<graine>.json
// Le travail est sauvegardé après chaque appel : relancer la commande reprend où elle s'était arrêtée.
// Sans clé, ou quand le quota gratuit est épuisé, la commande s'arrête proprement :
// la démo garde alors les textes écrits à la main pour ce qui manque.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { island } from "../engine/arenas/island";
import { Season } from "../engine/season";
import type { Character, SeasonConfig } from "../engine/types";
import { Gemini, QuotaError } from "../ai/gemini";
import { writeAi } from "../ai/writer";
import type { AiSeason } from "../ai/season-text";

const pool: Character[] = JSON.parse(readFileSync("data/characters.json", "utf8"));
const config: SeasonConfig = JSON.parse(readFileSync("config/season.json", "utf8"));
if (process.argv[2]) config.seed = Number(process.argv[2]);
const ai = JSON.parse(readFileSync("config/ai.json", "utf8"));
const featured = config.seed === 42 ? JSON.parse(readFileSync("demo/featured.json", "utf8")) : {};

const r = new Season(pool, island, config).run();
const out = `data/ai/season-${config.seed}.json`;
mkdirSync("data/ai", { recursive: true });
const store: AiSeason = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : { seed: config.seed, model: "", lines: {}, confessions: {} };
const save = () => writeFileSync(out, JSON.stringify(store, null, 1) + "\n");
const g = new Gemini(ai);

console.log(`Saison ${config.seed} · modèle ${g.model} · 7 jours de bulles et de confessionnaux`);
writeAi(r, store, g, { eventsPerCall: ai.eventsPerCall, charactersPerCall: ai.charactersPerCall, skipConfessions: new Set(Object.keys(featured)), onSave: save })
  .then(() => console.log(`Terminé : ${out}. Lance « npm run replay » pour mettre la démo à jour.`))
  .catch((e) => {
    if (Object.keys(store.lines).length || Object.keys(store.confessions).length) save();
    if (e instanceof QuotaError) console.log(`${e.message} Ce qui est écrit est sauvegardé ; relance plus tard pour continuer.`);
    else console.log(`Arrêt. ${e.message} Ce qui a déjà été écrit est sauvegardé.`);
    process.exitCode = e instanceof QuotaError ? 0 : 1;
  });
