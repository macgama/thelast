// Moteur du vrai direct : un passage (lancé toutes les 10 minutes par .github/workflows/direct.yml).
// Variables : SUPABASE_URL, SUPABASE_SECRET_KEY (secrets GitHub), GEMINI_API_KEY (facultatif).
import { Gemini } from "../ai/gemini";
import { readFileSync } from "node:fs";
import { runOnce } from "../live/run";
import { LiveStore, Rest } from "../live/store";

const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  // pas encore configuré : on s'arrête sans erreur (sinon GitHub enverrait un e-mail d'échec toutes les 10 minutes)
  console.log("Il manque SUPABASE_URL ou SUPABASE_SECRET_KEY (voir le guide de mise en ligne, étape « Secrets GitHub »). Rien à faire.");
  process.exit(0);
}
const gem = process.env.GEMINI_API_KEY || process.env.GEMINI_VIA_PROXY ? new Gemini(JSON.parse(readFileSync("config/ai.json", "utf8"))) : null;
if (!gem) console.log("Pas de clé Gemini : les textes écrits à la main seront utilisés.");
const store = new LiveStore(new Rest(url, key));
runOnce(store, { gemini: gem, aiBudgetMs: Number(process.env.AI_BUDGET_MS || 6 * 60_000) }).catch(async (e) => {
  console.error(`Erreur du moteur : ${e?.message ?? e}`);
  // on note l'erreur dans la saison pour que le back-office l'affiche
  try {
    const s = await store.currentSeason();
    if (s) await store.updateSeason(s.id, { engine: { ...(s.engine ?? {}), at: new Date().toISOString(), error: String(e?.message ?? e).slice(0, 500) } });
  } catch {}
  process.exitCode = 1;
});
