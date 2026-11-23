import { describe, it, expect } from "vitest";
import { careerOf, xpFor, levelOf, selectCast } from "../src/characters/career";

const c = { skills: ["swimming"], traits: { courage: 50, empathy: 50, cunning: 50, loyalty: 50, composure: 98 } };

describe("progression des personnages", () => {
  it("le vainqueur gagne plus que le finaliste, qui gagne plus que le premier éliminé", () => {
    const w = xpFor({ show: "survivor", season: 1, rank: 1, of: 50 });
    const f = xpFor({ show: "survivor", season: 1, rank: 3, of: 50 });
    const l = xpFor({ show: "survivor", season: 1, rank: 50, of: 50 });
    expect(w).toBeGreaterThan(f);
    expect(f).toBeGreaterThan(l);
    expect(l).toBeGreaterThan(0);
  });
  it("le vainqueur apprend une compétence qu'il n'a pas, et ses traits ne dépassent jamais 100", () => {
    const k = careerOf(c, [{ show: "survivor", season: 1, rank: 1, of: 50 }]);
    expect(k.learned).toHaveLength(1);
    expect(k.learned[0]).not.toBe("swimming");
    expect(98 + (k.bonus.composure ?? 0)).toBeLessThanOrEqual(100);
    expect(k.cosmetics).toContain("aura_survivor");
    expect(k.level).toBeGreaterThan(1);
  });
  it("le niveau suit les paliers", () => {
    expect(levelOf(0)).toBe(1);
    expect(levelOf(40)).toBe(2);
    expect(levelOf(99999)).toBe(10);
  });
  it("la sélection prend les plus votés puis tire au sort le reste", () => {
    const pool = Array.from({ length: 100 }, (_, i) => `c${String(i + 1).padStart(3, "0")}`);
    const votes = { c010: 50, c020: 40, c030: 30 };
    const cast = selectCast(votes, pool, 50, 30, () => 0.5);
    expect(cast).toHaveLength(50);
    expect(new Set(cast).size).toBe(50);
    expect(cast.slice(0, 3)).toEqual(["c010", "c020", "c030"]);
  });
});
