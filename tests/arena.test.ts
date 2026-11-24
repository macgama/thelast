// The Last - Arena Battle : le moteur de la maquette (demo/arena-engine.js) et sa version anglaise.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import "../demo/arenas.js";
import "../demo/arena-engine.js";

const E = (globalThis as any).ArenaEngine;
const pool = JSON.parse(readFileSync("demo/personnages.json", "utf8"));

const ARENAS: string[] = (globalThis as any).ARENA_LIST;

function season(seed: number, pickVote = (ids: string[]) => ids[0], arena?: string) {
  const game = E.create(E.cast(pool, seed), seed, arena);
  const events: any[] = [];
  let step, guard = 0;
  while ((step = game.next()) && guard++ < 500) {
    events.push(...step.events);
    if (step.ask) events.push(...game.answer(step.ask.kind === "duel" ? step.ask.options[0] : pickVote(step.ask.ids)));
  }
  return { game, events };
}

describe("Arena Battle : le moteur", () => {
  it("le casting compte 30 candidats : 24 choisis par le public, 6 par la production", () => {
    const cast = E.cast(pool, 7);
    expect(cast).toHaveLength(30);
    expect(cast.filter((c: any) => c.pick === "public")).toHaveLength(24);
    expect(new Set(cast.map((c: any) => c.id)).size).toBe(30);
  });

  for (const seed of [1, 7, 42, 99]) {
    it(`graine ${seed} : un seul vainqueur en 7 jours au plus, chaque place attribuée une fois`, () => {
      const { game, events } = season(seed);
      expect(game.state.over).toBe(true);
      expect(events.filter((e) => e.type === "win")).toHaveLength(1);
      expect(Math.max(...events.map((e) => e.day))).toBeLessThanOrEqual(7);
      const ranks = game.cast.map((x: any) => x.outRank).sort((a: number, b: number) => a - b);
      expect(ranks).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
      // la Cage du sursis : chaque vote du soir sauve exactement un candidat
      for (const v of events.filter((e) => e.type === "vote")) expect(v.saved).toBeTruthy();
      // la finale a lieu le 7e jour
      expect(events.find((e) => e.type === "finale")?.day).toBe(7);
    });
  }

  it("il y a 5 arènes, chacune avec ses lieux reliés, 3 pièges et 3 dangers", () => {
    expect(ARENAS).toHaveLength(5);
    for (const id of ARENAS) {
      const A = (globalThis as any).ARENAS[id];
      const ids = new Set(A.places.map((p: any) => p.id));
      expect(A.places.length).toBeGreaterThanOrEqual(7);
      for (const p of A.places) for (const l of p.links) expect(ids.has(l)).toBe(true);
      expect(A.places.some((p: any) => p.kind === "hide")).toBe(true);
      expect(A.traps).toHaveLength(3);
      expect(A.hazards).toHaveLength(3);
    }
  });

  for (const arena of ARENAS) {
    it(`${arena} : la saison va jusqu'à la finale du 7e jour, avec pièges, cachettes et dangers`, () => {
      const { game, events } = season(11, undefined, arena);
      expect(game.arena.places[0].id).toBe((globalThis as any).ARENAS[arena].places[0].id);
      expect(events.filter((e) => e.type === "win")).toHaveLength(1);
      expect(events.find((e) => e.type === "finale")?.day).toBe(7);
      expect(events.some((e) => e.type === "trapSet")).toBe(true);
      expect(events.some((e) => e.type === "hit" && e.kind === "trap")).toBe(true);
      expect(events.some((e) => e.type === "hide")).toBe(true);
      expect(events.some((e) => e.type === "hazard")).toBe(true);
      expect(events.some((e) => e.type === "danger")).toBe(true);
    });
  }

  it("prévenir son favori : il fait demi-tour ou fonce quand même", () => {
    const game = E.create(E.cast(pool, 4), 4, "colisee");
    let step, warned = false, guard = 0;
    while ((step = game.next()) && guard++ < 400) {
      if (step.ask) game.answer(step.ask.kind === "duel" ? step.ask.options[0] : null);
      if (warned) {
        expect(step.events.some((e: any) => e.type === "heed" || e.type === "ignore")).toBe(true);
        return;
      }
      const at = game.snapshot().cast.find((c: any) => c.state === "in" && game.trapAhead(c.id));
      if (at) { game.warn(at.id); warned = true; }
    }
    throw new Error("aucun piège sur le chemin");
  });

  it("la même graine rejoue la même saison", () => {
    const a = season(5).events.map((e) => e.text).join("|");
    const b = season(5).events.map((e) => e.text).join("|");
    expect(a).toBe(b);
  });

  it("le vote du spectateur sauve son candidat", () => {
    const game = E.create(E.cast(pool, 3), 3);
    let step;
    while ((step = game.next())) {
      if (step.ask?.kind === "vote") {
        const pick = step.ask.ids[step.ask.ids.length - 1];
        const out = game.answer(pick);
        expect(out.find((e: any) => e.type === "vote").saved).toBe(pick);
        return;
      }
      if (step.ask) game.answer(step.ask.options[0]);
    }
    throw new Error("aucun vote");
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

describe("Arena Battle : version anglaise", () => {
  const EN: Record<string, string> = {};
  new Function("window", readFileSync("demo/i18n-en-arena.js", "utf8"))({ I18N: { add: (d: Record<string, string>) => Object.assign(EN, d) } });
  for (const page of ["arena.html", "arena3d.js", "arena-engine.js", "arenas.js"]) {
    it(`${page} : tous les textes sont traduits`, () => {
      expect(keysOf(readFileSync(`demo/${page}`, "utf8")).filter((k) => EN[k] === undefined)).toEqual([]);
    });
  }
  it("les {repères} sont les mêmes en français et en anglais", () => {
    const marks = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    expect(Object.entries(EN).filter(([fr, en]) => marks(fr) !== marks(en)).map(([fr]) => fr)).toEqual([]);
  });
});
