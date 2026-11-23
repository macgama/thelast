// Client Gemini minimal (API REST « generateContent »), sans dépendance.
// La clé n'est jamais dans le code : variable d'environnement GEMINI_API_KEY,
// ou secret réseau ajouté automatiquement par l'environnement cloud.
// Respecte un intervalle minimal entre deux appels (palier gratuit) et réessaie sur 429/5xx.

export interface AiConfig { model: string; fallbackModels: string[]; temperature: number; minIntervalMs: number; maxRetries: number }

export class QuotaError extends Error {}

const BASE = "https://generativelanguage.googleapis.com/v1beta";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Gemini {
  private last = 0;
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
        headers: { "content-type": "application/json", ...(this.key ? { "x-goog-api-key": this.key } : {}) },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: this.cfg.temperature, responseMimeType: "application/json" },
        }),
      }).catch((e) => ({ ok: false, status: 0, text: async () => String(e), json: async () => ({}) }) as unknown as Response);
      if (res.ok) {
        const body: any = await res.json();
        const text = body?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
        try { return JSON.parse(text.replace(/^```(json)?|```$/g, "").trim()) as T; }
        catch { if (attempt < this.cfg.maxRetries) continue; throw new Error("Réponse illisible de Gemini"); }
      }
      const err = await res.text();
      if (res.status === 404 && this.models.length > 1) { this.models.shift(); attempt--; continue; } // modèle retiré : on passe au suivant
      if (res.status === 401 || res.status === 403) throw new Error(`Gemini refuse l'accès (${res.status}) : la clé est absente ou invalide.`);
      if (attempt >= this.cfg.maxRetries) {
        if (res.status === 429) throw new QuotaError("Quota gratuit de Gemini atteint pour le moment.");
        throw new Error(`Gemini : erreur ${res.status} ${err.slice(0, 200)}`);
      }
      const hinted = /"retryDelay":\s*"(\d+)s"/.exec(err)?.[1];
      await sleep(hinted ? (+hinted + 1) * 1000 : Math.min(60000, 2000 * 2 ** attempt));
    }
  }
}
