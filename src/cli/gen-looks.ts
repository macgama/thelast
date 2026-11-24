// Génère data/looks.json (fiches visuelles des 100 personnages) et docs/prompts-personnages.md.
// Une fiche déjà présente n'est jamais écrasée : les retouches à la main sont conservées.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { makeLook, makeFace, cinePrompt, lookPrompt, silhouetteKey, resolveLook, CLOTH, type Look } from "../characters/looks.js";

const pool = JSON.parse(readFileSync("data/characters.json", "utf8"));
const path = "data/looks.json";
const old: Record<string, Look> = existsSync(path) ? Object.fromEntries(JSON.parse(readFileSync(path, "utf8")).map((l: Look) => [l.id, l])) : {};
const seen = new Set<string>();
const looks: Look[] = pool.map((c: any) => {
  if (old[c.id]) { old[c.id].face ??= makeFace(c, old[c.id]); seen.add(silhouetteKey(old[c.id])); return old[c.id]; }
  const l = makeLook(c);
  // si un autre personnage a déjà la même silhouette, on change la couleur du haut
  const colors = Object.keys(CLOTH);
  for (let k = 0; seen.has(silhouetteKey(l)) && k < colors.length; k++) l.top.color = colors[(colors.indexOf(l.top.color) + 1) % colors.length];
  seen.add(silhouetteKey(l));
  l.face = makeFace(c, l);
  return l;
});
writeFileSync(path, JSON.stringify(looks, null, 1) + "\n");
mkdirSync("docs", { recursive: true });
const md = ["# Prompts des 100 personnages", "", "Deux prompts par personnage, à copier tel quel dans un outil d'image ou de 3D pour obtenir sa planche de référence (face, profil, dos) :", "", "- **Cinématique** : 3D stylisée haut de gamme, pour les petites cinématiques.", "- **Low poly** : le style du jeu.", "", "Généré depuis `data/looks.json` par `npm run looks`.", ""];
pool.forEach((c: any, i: number) => md.push(`## ${c.name} (${c.id}) · ${c.job.fr}`, "", "**Cinématique**", "", "```", cinePrompt(c, looks[i]), "```", "", "**Low poly**", "", "```", lookPrompt(c, looks[i]), "```", ""));
writeFileSync("docs/prompts-personnages.md", md.join("\n"));
writeFileSync("demo/casting.json", JSON.stringify(pool.map((c: any, i: number) => ({
  id: c.id, name: c.name, age: c.age, gender: c.gender, job: c.job.fr, origin: c.origin.fr,
  signature: looks[i].signature, look: resolveLook(looks[i]), prompt: lookPrompt(c, looks[i]), cine: cinePrompt(c, looks[i]),
}))));
console.log(`${path} : ${looks.length} fiches, ${seen.size} silhouettes distinctes`);

