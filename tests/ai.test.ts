import { describe, it, expect } from "vitest";
import { aiKey, secretDayFor } from "../src/ai/season-text";
import { SLOTS, linesPrompt, confessionPrompt } from "../src/ai/prompts";
import { readFileSync } from "node:fs";

describe("écriture par IA", () => {
  it("chaque rôle demandé à l'IA existe dans les répliques de la démo", () => {
    const scenes = readFileSync("demo/scenes.js", "utf8");
    for (const roles of Object.values(SLOTS)) for (const k of Object.keys(roles)) expect(scenes).toContain(`${k}: [`);
  });
  it("clés stables et secrets révélés entre le 3e et le 6e jour", () => {
    expect(aiKey({ tick: 19, type: "steal", actors: ["c016", "c041"] })).toBe("19:steal:c016,c041");
    for (let i = 1; i <= 100; i++) { const d = secretDayFor(`c${String(i).padStart(3, "0")}`); expect(d).toBeGreaterThanOrEqual(3); expect(d).toBeLessThanOrEqual(6); }
  });
  it("les consignes ne contiennent jamais de clé d'API", () => {
    const card = { id: "c1", name: "A", age: 30, gender: "f", job: "j", origin: "o", traits: "t", phobia: "p", catchphrase: "c", motivation: "m", backstory: "b" };
    const txt = linesPrompt(1, [{ key: "1:steal:c1", type: "steal", hour: "8h", actors: ["A"], fr: "x" }], [card]) + confessionPrompt(1, [{ card, events: [], clan: null, out: null, previous: null, secret: null }]);
    expect(txt).not.toMatch(/AIza|api[_-]?key/i);
    expect(readFileSync("config/ai.json", "utf8")).not.toMatch(/AIza/);
  });
});
