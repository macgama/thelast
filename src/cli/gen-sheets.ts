// Génère la planche de référence « cinématique » de chaque personnage avec le modèle d'image de Google
// (Nano Banana), dans le style d'une planche déjà validée (celle de Morgan par défaut).
// Usage : npm run sheets -- [dossier=/mnt/project-files/personnages] [--limit N] [--only c001,c002]
// Les planches déjà présentes ne sont pas refaites. La clé vient de GEMINI_API_KEY ou du secret réseau.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { cinePrompt, type Look } from "../characters/looks.js";

const args = process.argv.slice(2);
const flag = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const limit = Number(flag("--limit") ?? 1e9);
const only = flag("--only")?.split(",");
const dir = (args[0] ?? "/mnt/project-files/personnages").replace(/\/?$/, "/");
const cfg = JSON.parse(readFileSync("config/ai.json", "utf8"));
const pool = JSON.parse(readFileSync("data/characters.json", "utf8"));
const looks: Record<string, Look> = Object.fromEntries(JSON.parse(readFileSync("data/looks.json", "utf8")).map((l: Look) => [l.id, l]));
const key = process.env.GEMINI_API_KEY;
const BASE = "https://generativelanguage.googleapis.com/v1beta";
const headers = { "content-type": "application/json", ...(key ? { "x-goog-api-key": key } : {}) };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
mkdirSync(dir, { recursive: true });
const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
const done = new Set(readdirSync(dir).filter((f) => /^c\d{3}-.*reference\.png$/.test(f)).map((f) => f.slice(0, 4)));

// planche de style : la première planche validée trouvée dans le dossier
const styleFile = existsSync(`${dir}c100-morgan-reference.png`) ? `${dir}c100-morgan-reference.png` : readdirSync(dir).map((f) => dir + f).find((f) => f.endsWith("reference.png"));
const style = styleFile ? { inlineData: { mimeType: "image/png", data: readFileSync(styleFile).toString("base64") } } : null;

async function pickModel(): Promise<string> {
  const res = await fetch(`${BASE}/models?pageSize=200`, { headers });
  if (res.status === 401 || res.status === 403) throw new Error(`accès refusé (${res.status}) : la clé est absente ou invalide.`);
  const names: string[] = ((await res.json()) as any).models?.map((m: any) => m.name.replace("models/", "")) ?? [];
  const m = cfg.imageModels.find((n: string) => names.includes(n)) ?? names.find((n) => /image/.test(n) && /gemini/.test(n));
  if (!m) throw new Error(`aucun modèle d'image disponible avec cette clé (modèles vus : ${names.slice(0, 8).join(", ")}…)`);
  return m;
}

async function one(model: string, prompt: string): Promise<Buffer> {
  const text = style
    ? `Match the exact art style, rendering quality, lighting, light grey background and sheet layout (large full-body front view, side view, back view, smaller full-body view and a face close-up in the top-left corner) of the attached reference sheet ONLY. Do not reuse anything else from it: not the face, body, skin tone, hairstyle, clothes, colors, bag, camera or any accessory. Draw a completely different person, described here. ${prompt}`
    : prompt;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BASE}/models/${model}:generateContent`, {
      method: "POST", headers,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [...(style ? [style] : []), { text }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: "1:1" } },
      }),
    });
    const body: any = await res.json().catch(() => ({}));
    const img = body?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data)?.inlineData?.data;
    if (res.ok && img) return Buffer.from(img, "base64");
    const msg = JSON.stringify(body?.error ?? body?.promptFeedback ?? body).slice(0, 300);
    if (res.status === 401 || res.status === 403) throw new Error(`accès refusé (${res.status}).`);
    if (/billing|paid|free tier.*not|limit: 0/i.test(msg)) throw new Error(`la génération d'images n'est pas incluse dans le palier gratuit de cette clé : ${msg}`);
    if (attempt >= cfg.maxRetries) throw new Error(`échec après ${attempt + 1} essais : ${res.status} ${msg}`);
    const hinted = /"retryDelay":\s*"(\d+)s"/.exec(msg)?.[1];
    await sleep(hinted ? (+hinted + 1) * 1000 : Math.min(60000, 4000 * 2 ** attempt));
  }
}

(async () => {
  const model = await pickModel();
  const todo = pool.filter((c: any) => !done.has(c.id) && (!only || only.includes(c.id))).slice(0, limit);
  console.log(`Modèle ${model} · style : ${styleFile ?? "aucun"} · ${todo.length} planches à faire, ${done.size} déjà faites`);
  let n = 0;
  for (const c of todo) {
    const t0 = Date.now();
    const png = await one(model, cinePrompt(c, looks[c.id]));
    const file = `${dir}${c.id}-${slug(c.name)}-reference.png`;
    writeFileSync(file, png);
    console.log(`  ${++n}/${todo.length} ${file}`);
    const wait = cfg.imageIntervalMs - (Date.now() - t0);
    if (wait > 0) await sleep(wait);
  }
  console.log("Terminé.");
})().catch((e) => { console.log(`Arrêt : ${e.message} Les planches déjà faites sont gardées ; relancer reprend où ça s'est arrêté.`); process.exitCode = 1; });
