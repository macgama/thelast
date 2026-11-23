// Client Gemini minimal (API REST « generateContent »), sans dépendance.
// La clé n'est jamais dans le code : variable d'environnement GEMINI_API_KEY,
// ou secret réseau ajouté automatiquement par l'environnement cloud (le proxy remplace
// alors la valeur provisoire de l'en-tête x-goog-api-key par la vraie clé).
// Respecte un intervalle minimal entre deux appels (palier gratuit) et réessaie sur 429/5xx.

export interface AiConfig { model: string; fallbackModels: string[]; temperature: number; minIntervalMs: number; maxRetries: number }

export class QuotaError extends Error {}

const BASE = "https://generativelanguage.googleapis.com/v1beta";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Gemini {
  private last = 0;
  private rotations = 0;
  private models: string[];
  constructor(private cfg: AiConfig, private key = process.env.GEMINI_API_KEY) {
    this.models = [cfg.model, ...cfg.fallbackModels];
  }
  get model() { return this.models[0]; }

  /** Envoie une consigne et renvoie la réponse JSON déjà décodée. */
  async json<T>(system: string, prompt: string): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const wait = this.last + this.cfg.minIntervalMs - Date.now();
      if (wait > 0) await sleep(wait);
      this.last = Date.now();
      const res = await fetch(`${BASE}/models/${this.model}:generateContent`, {
        method: "POST",
        signal: AbortSignal.timeout(150000),
        headers: { "content-type": "application/json", "x-goog-api-key": this.key || "injecte-par-le-proxy" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: this.cfg.temperature, responseMimeType: "application/json" },
        }),
      }).catch((e) => ({ ok: false, status: 0, text: async () => String(e), json: async () => ({}) }) as unknown as Response);
      if (res.ok) {
        this.rotations = 0;
        const body: any = await res.json();
        const text = body?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
        try { return JSON.parse(text.replace(/^```(json)?|```$/g, "").trim()) as T; }
        catch { if (attempt < this.cfg.maxRetries) continue; throw new Error("Réponse illisible de Gemini"); }
      }
      const err = await res.text();
      if (res.status === 401 || res.status === 403) throw new Error(`Gemini refuse l'accès (${res.status}) : la clé est absente ou invalide.`);
      if (res.status === 404 && this.models.length > 1) { this.models.shift(); attempt--; continue; } // modèle retiré : on l'abandonne
      const hinted = Number(/"retryDelay":\s*"(\d+)s"/.exec(err)?.[1] ?? 0);
      if (res.status === 429 && hinted > 120) { // quota du jour épuisé pour ce modèle : on l'abandonne jusqu'à demain
        if (this.models.length === 1) throw new QuotaError("Quota gratuit du jour atteint pour tous les modèles Gemini.");
        console.log(`  (quota du jour atteint pour ${this.model}, on continue avec un autre modèle)`);
        this.models.shift(); attempt = -1; continue;
      }
      // modèle saturé ou qui ne répond pas : on essaie le suivant (en tournant), sans perdre les autres
      const busy = res.status === 0 || res.status === 429 || res.status === 500 || res.status === 503 || res.status === 504;
      if (busy && attempt >= 1 && this.models.length > 1 && ++this.rotations <= this.models.length * this.cfg.maxRetries) { console.log(`  (${this.model} indisponible : ${res.status}, essai avec un autre modèle)`); this.models.push(this.models.shift()!); attempt = -1; await sleep(3000); continue; }
      if (attempt >= this.cfg.maxRetries) {
        if (res.status === 429) throw new QuotaError("Quota gratuit de Gemini atteint pour le moment.");
        throw new Error(`Gemini : erreur ${res.status} ${err.slice(0, 200)}`);
      }
      await sleep(hinted ? (hinted + 1) * 1000 : Math.min(60000, 2000 * 2 ** attempt));
    }
  }
}
