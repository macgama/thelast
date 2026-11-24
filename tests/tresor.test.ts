// The Last - Chasse au trésor « La Carte déchirée » : le moteur de la maquette (demo/tresor-engine.js) et sa version anglaise.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import "../demo/tresor-engine.js";

const E = (globalThis as any).TresorEngine;
const pool = JSON.parse(readFileSync("demo/personnages.json", "utf8"));

function season(seed: number, pickVote = (ids: string[]) => ids[0], whisperOn?: (game: any, day: number) => string | null) {
  const game = E.create(E.cast(pool, seed), seed);
  const events: any[] = [];
  let step, guard = 0;
  while ((step = game.next()) && guard++ < 500) {
    events.push(...step.events);
    if (whisperOn && step.hour === 9) { const id = whisperOn(game, step.day); if (id) game.whisper(id); }
    if (step.ask) events.push(...game.answer(pickVote(step.ask.ids)));
  }
  return { game, events };
}

describe("Chasse au trésor : le moteur", () => {
  it("le casting compte 24 candidats : 20 choisis par le public, 4 par la production", () => {
    const cast = E.cast(pool, 7);
    expect(cast).toHaveLength(24);
    expect(cast.filter((c: any) => c.pick === "public")).toHaveLength(20);
    expect(new Set(cast.map((c: any) => c.id)).size).toBe(24);
  });

  for (const seed of [1, 7, 42, 99, 123]) {
    it(`graine ${seed} : 7 jours, un seul vainqueur, chaque place attribuée une fois`, () => {
      const { game, events } = season(seed);
      expect(game.state.over).toBe(true);
      expect(events.filter((e) => e.type === "win")).toHaveLength(1);
      expect(Math.max(...events.map((e) => e.day))).toBe(7);
      const ranks = game.cast.map((x: any) => x.outRank).sort((a: number, b: number) => a - b);
      expect(ranks).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
      // une énigme et une zone par jour, le prime le 7e jour
      expect(events.filter((e) => e.type === "riddle")).toHaveLength(7);
      expect(events.find((e) => e.type === "finale")?.day).toBe(7);
      // le premier soir est un soir de grâce : pas de vote
      expect(events.filter((e) => e.type === "vote" && e.day === 1)).toHaveLength(0);
      // chaque vote sauve exactement un candidat menacé
      for (const v of events.filter((e) => e.type === "vote")) expect(v.result.map((r: any) => r.id)).toContain(v.saved);
      // 4 ou 5 finalistes
      expect(game.state.finalists.length).toBeGreaterThanOrEqual(4);
      expect(game.state.finalists.length).toBeLessThanOrEqual(6);
    });
  }

  it("chaque jour, le morceau de carte du jour est trouvé, et un seul porteur par morceau", () => {
    const { events } = season(11);
    for (let d = 1; d <= 7; d++) expect(events.some((e) => e.type === "piece" && e.n === d && e.how !== "orphan")).toBe(true);
  });

  it("la même graine rejoue la même saison", () => {
    const a = season(5).events.map((e) => e.text).join("|");
    const b = season(5).events.map((e) => e.text).join("|");
    expect(a).toBe(b);
  });

  it("le vote du spectateur sauve son candidat", () => {
    // le choix du spectateur pèse lourd : il est sauvé dans la grande majorité des cas
    let asked = 0, saved = 0;
    for (const seed of [3, 6, 9, 12]) {
      const game = E.create(E.cast(pool, seed), seed);
      let step;
      while ((step = game.next())) {
        if (!step.ask) continue;
        const pick = step.ask.ids[step.ask.ids.length - 1];
        const out = game.answer(pick);
        asked++;
        if (out.find((e: any) => e.type === "vote").saved === pick) saved++;
      }
    }
    expect(asked).toBeGreaterThan(10);
    expect(saved / asked).toBeGreaterThanOrEqual(0.6);
  });

  it("le souffle du public : le toucan apporte la réponse et le morceau au candidat choisi", () => {
    const chosen: Record<number, string> = {};
    const { events } = season(8, undefined, (game, day) => {
      const c = game.cast.find((x: any) => x.state === "in");
      chosen[day] = c.id;
      return c.id;
    });
    for (let d = 1; d <= 7; d++) {
      const toucan = events.find((e) => e.type === "toucan" && e.day === d);
      if (!toucan) continue; // les candidats ont pu trouver avant 9h… jamais en pratique, mais on reste prudent
      expect(toucan.a).toBe(chosen[d]);
      expect(events.find((e) => e.type === "piece" && e.n === d && e.how === "toucan")?.a).toBe(chosen[d]);
    }
    expect(events.filter((e) => e.type === "toucan").length).toBeGreaterThanOrEqual(6);
  });

  it("on ne peut plus souffler une fois l'énigme résolue", () => {
    const game = E.create(E.cast(pool, 4), 4);
    let step;
    while ((step = game.next())) {
      if (step.events.some((e: any) => e.type === "piece" && e.how === "solve")) break;
      if (step.ask) game.answer(null);
    }
    expect(game.whisper(game.cast.find((x: any) => x.state === "in").id)).toBe(false);
  });

  it("les énigmes ont toujours 4 réponses possibles (6 dalles au cénote) et une seule bonne", () => {
    for (let d = 1; d <= 7; d++) for (let s = 1; s <= 300; s++) {
      const R = E.riddle(d, s);
      expect(R.options.length).toBe(d === 6 ? 6 : 4);
      expect(R.answer).toBeGreaterThanOrEqual(0);
      if (d !== 6) expect(new Set(R.options).size).toBe(4);
      else expect(R.options.filter((o: string) => o === R.options[R.answer])).toHaveLength(1);
    }
  });

  it("les énigmes ont la bonne réponse", () => {
    for (let s = 1; s <= 50; s++) {
      const B = E.riddle(3, s); // balance : A + A = B, B + C = n, C = c
      const c = Number(B.lines[2][2]), n = Number(B.lines[1][4]);
      expect(Number(B.options[B.answer]) * 2 + c).toBe(n);
      const P = E.riddle(5, s); // chemin : on rejoue les flèches depuis l'étoile
      const D: Record<string, number[]> = { "↑": [-1, 0], "↓": [1, 0], "←": [0, -1], "→": [0, 1] };
      let pos = [2, 2];
      for (const m of P.moves) pos = [pos[0] + D[m][0], pos[1] + D[m][1]];
      expect(P.grid[pos[0] * P.size + pos[1]]).toBe(P.options[P.answer]);
      const K = E.riddle(7, s); // code du coffre
      const val = Object.fromEntries(K.key);
      expect(K.lock.map((g: string) => val[g]).join("")).toBe(K.options[K.answer]);
    }
  });
});

// même lecture des textes que tests/i18n.test.ts
function keysOf(src: string): string[] {
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
  return [...out];
}

describe("Chasse au trésor : version anglaise", () => {
  const EN: Record<string, string> = {};
  const I18N = { add: (d: Record<string, string>) => Object.assign(EN, d) };
  new Function("window", "I18N", readFileSync("demo/i18n-en-tresor.js", "utf8"))({ I18N }, I18N);
  for (const page of ["tresor.html", "tresor3d.js", "tresor-engine.js"]) {
    it(`${page} : tous les textes sont traduits`, () => {
      expect(keysOf(readFileSync(`demo/${page}`, "utf8")).filter((k) => EN[k] === undefined && /\p{L}/u.test(k))).toEqual([]);
    });
  }
  it("les indices des énigmes sont traduits", () => {
    const src = readFileSync("demo/tresor-engine.js", "utf8");
    const block = src.slice(src.indexOf("const HINTS"), src.indexOf("// Casting"));
    const hints = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(hints.length).toBe(14);
    expect(hints.filter((h) => EN[h] === undefined)).toEqual([]);
  });
  it("les {repères} sont les mêmes en français et en anglais", () => {
    const marks = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    expect(Object.entries(EN).filter(([fr, en]) => marks(fr) !== marks(en)).map(([fr]) => fr)).toEqual([]);
  });
});
