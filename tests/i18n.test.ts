// Version anglaise : chaque texte de l'interface doit avoir sa traduction dans demo/i18n-en.js,
// avec les mêmes {repères} que le français.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PAGES = ["survivor.html", "scenes.js", "live.js", "index.html", "personnages.html", "selection.html", "fanclub.js", "compte.html"];
const read = (f: string) => { try { return readFileSync(`demo/${f}`, "utf8"); } catch { return ""; } };

function dictionary(): Record<string, string> {
  const EN: Record<string, string> = {};
  const window = { I18N: { add: (d: Record<string, string>) => Object.assign(EN, d) } };
  new Function("window", read("i18n-en.js"))(window);
  return EN;
}

export function keysOf(src: string): string[] {
  const out = new Set<string>();
  const lit = /(?<![\w$.])(?:_|t|I18N\.t)\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;
  for (const m of src.matchAll(lit)) out.add(m[1][0] === "'" ? m[1].slice(1, -1).replace(/\\'/g, "'") : JSON.parse(m[1]));
  const el = /<(\w+)\b[^>]*?\sdata-i18n(?:="([^"]*)")?(?=[\s>])[^>]*>([\s\S]*?)<\/\1>/g;
  for (const m of src.matchAll(el)) out.add(m[2] || m[3].trim());
  for (const m of src.matchAll(/<[^>]*\sdata-i18n-attr="([^"]+)"[^>]*>/g)) {
    for (const a of m[1].split(",")) {
      const v = new RegExp(`\\s${a.trim()}="([^"]*)"`).exec(m[0]);
      if (v) out.add(v[1]);
    }
  }
  // textes passés par une table (ex. messages d'erreur) : // i18n: "…"
  for (const m of src.matchAll(/\/\/ i18n: (".*")/g)) out.add(JSON.parse(m[1]));
  return [...out];
}

const marks = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((k) => k !== "e").sort();

describe("version anglaise", () => {
  const EN = dictionary();
  for (const page of PAGES) {
    const src = read(page);
    if (!src) continue;
    it(`${page} : tous les textes sont traduits`, () => {
      const missing = keysOf(src).filter((k) => EN[k] === undefined);
      expect(missing).toEqual([]);
    });
  }
  it("les {repères} sont les mêmes en français et en anglais", () => {
    const bad = Object.entries(EN).filter(([fr, en]) => marks(fr).join() !== marks(en).join()).map(([fr]) => fr);
    expect(bad).toEqual([]);
  });
  it("les messages d'erreur des comptes sont traduits", () => {
    const err = /const ERR = \{([\s\S]*?)\};/.exec(read("live.js"))?.[1] ?? "";
    const vals = [...err.matchAll(/:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => JSON.parse(`"${m[1]}"`));
    expect(vals.length).toBeGreaterThan(5);
    expect(vals.filter((v) => EN[v] === undefined)).toEqual([]);
  });
});
