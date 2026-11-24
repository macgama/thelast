// Branchement facultatif d'une IA pour réécrire les récits avec le ton d'un présentateur télé.
// Sans clé, le texte « sans IA » est utilisé tel quel. La clé se met dans la variable GEMINI_API_KEY,
// jamais dans le code.
import type { Lang } from "../engine/types";

export interface Polisher {
  name: string;
  polish(markdown: string, lang: Lang, kind: "daily" | "prime"): Promise<string>;
}

export const noLlm: Polisher = { name: "sans IA", polish: async (md) => md };

const STYLE: Record<Lang, string> = {
  fr: "Tu es le présentateur d'une émission de télé-réalité familiale, ton dynamique et chaleureux.",
  en: "You are the host of a family-friendly reality TV show, with an upbeat and warm tone.",
};

const RULES: Record<Lang, string> = {
  fr: "Réécris ce résumé en gardant tous les faits, les noms et les chiffres, sans en inventer. Aucune violence graphique : on parle d'évacuation, jamais de mort ni de sang. Garde le format Markdown. Réponds uniquement avec le texte réécrit.",
  en: "Rewrite this recap keeping every fact, name and number, without inventing any. No graphic violence: people are evacuated, never dead or bleeding. Keep the Markdown format. Reply with the rewritten text only.",
};

export function gemini(apiKey: string, model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash"): Polisher {
  return {
    name: `Gemini (${model})`,
    async polish(markdown, lang) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: `${STYLE[lang]} ${RULES[lang]}` }] },
          contents: [{ role: "user", parts: [{ text: markdown }] }],
          generationConfig: { temperature: 0.8 },
        }),
      });
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
      const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      return json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") || markdown;
    },
  };
}

export function polisherFromEnv(): Polisher {
  const key = process.env.GEMINI_API_KEY;
  return key ? gemini(key) : noLlm;
}
