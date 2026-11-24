import { describe, expect, it } from "vitest";
import pool from "../data/characters.json";
import config from "../config/season.json";
import { island } from "../src/engine/arenas/island";
import { Season, applyCareer, dayOf } from "../src/engine/season";
import type { Character, SeasonConfig } from "../src/engine/types";
import { CATASTROPHES, INDIVIDUAL, ISLAND } from "../src/engine/catastrophes";
import { Narrator } from "../src/narration/narrator";

const chars = pool as Character[];
const run = (seed: number) => new Season(chars, island, { ...(config as SeasonConfig), seed }).run();

describe("saison", () => {
  it("est rejouable : même graine, même saison", () => {
    const a = run(7);
    const b = run(7);
    expect(a.winner).toBe(b.winner);
    expect(a.events.length).toBe(b.events.length);
  });

  it.each([1, 2, 3, 4, 5, 42])("finit avec un seul vainqueur au jour 7 (graine %i)", (seed) => {
    const r = run(seed);
    expect(r.cast).toHaveLength(50);
    expect(r.winner).not.toBeNull();
    expect(r.final.filter((s) => s.alive)).toHaveLength(1);
    const lastEvent = r.events[r.events.length - 1];
    expect(lastEvent.type).toBe("winner");
    expect(dayOf(lastEvent.tick)).toBe(7);
  });

  it("organise un vote par soir du jour 1 au jour 6, avec une seule évacuation", () => {
    const r = run(3);
    const votes = r.final.filter((s) => s.eliminationCause === "vote");
    expect(votes).toHaveLength(6);
    expect(new Set(votes.map((s) => dayOf(s.eliminatedAt!))).size).toBe(6);
  });

  it("ne livre jamais plus d'un colis par personnage et par jour", () => {
    const r = run(11);
    const seen = new Set<string>();
    for (const e of r.events.filter((e) => e.type === "gift_delivered" || e.type === "gift_lost")) {
      const key = `${e.actors[0]}-${dayOf(e.tick)}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("resserre le groupe à 3 finalistes grâce aux épreuves du jour 7", () => {
    for (const seed of [21, 22, 23, 42]) {
      const r = run(seed);
      const finale = r.events.find((e) => e.type === "finale")!;
      expect(finale.actors.length).toBeGreaterThanOrEqual(2);
      expect(finale.actors.length).toBeLessThanOrEqual(3);
      expect(r.snapshots.length).toBeGreaterThan(150);
    }
  });

  it("fait progresser le vainqueur pour les saisons suivantes", () => {
    const r = run(5);
    const next = applyCareer(chars, r);
    const w = next.find((c) => c.id === r.winner)!;
    expect(w.career.wins).toBe(1);
    expect(w.career.cosmetics).toContain("crown_island");
  });
});

describe("récit", () => {
  it("produit la quotidienne et le prime en français et en anglais, sans balise oubliée", () => {
    const r = run(42);
    for (const lang of ["fr", "en"] as const) {
      const n = new Narrator(r, lang);
      const text = n.book();
      expect(text).not.toMatch(/\{\w+\}/);
      expect(text).not.toMatch(/undefined/);
      expect(text).not.toMatch(/ à les | à le /);
    }
  });

  it("forme des clans de 5 au plus, qui partagent et défendent les leurs", () => {
    for (const seed of [1, 2, 3, 42]) {
      const r = run(seed);
      for (const snap of r.snapshots) {
        const sizes = new Map<string, number>();
        for (const p of Object.values(snap.people)) if (p[4]) sizes.set(p[4], (sizes.get(p[4]) ?? 0) + 1);
        for (const n of sizes.values()) expect(n).toBeLessThanOrEqual(5);
      }
      expect(r.events.some((e) => e.type === "clan_meal")).toBe(true);
      for (const e of r.events.filter((x) => x.type === "defend")) expect(new Set(e.actors).size).toBe(3);
    }
  });

  it("annonce chaque trahison de clan par de la méfiance puis un complot", () => {
    for (const seed of [1, 2, 3, 42]) {
      const r = run(seed);
      for (const b of r.events.filter((e) => e.type === "steal" && e.data?.betrayal && e.data?.clan)) {
        const [a, target] = b.actors;
        const sus = r.events.find((e) => e.type === "suspicion" && e.actors[0] === a && e.actors[1] === target && e.tick < b.tick);
        const plot = r.events.find((e) => e.type === "conspire" && e.actors[0] === a && e.actors[2] === target && e.tick < b.tick);
        expect(sus, `méfiance avant la trahison de ${a}`).toBeDefined();
        expect(plot, `complot avant la trahison de ${a}`).toBeDefined();
      }
    }
  });

  it("fait plaider le clan pour un membre menacé", () => {
    const r = run(42);
    for (const c of r.events.filter((e) => e.type === "campaign")) {
      const threat = r.events.find((e) => e.type === "vote_threat" && e.tick === c.tick)!;
      expect(threat.actors).toContain(c.actors[1]);
      expect(threat.actors).not.toContain(c.actors[0]);
    }
  });

  it("tire des dizaines de catastrophes différentes, toujours possibles là où elles arrivent", () => {
    expect(INDIVIDUAL.length + ISLAND.length).toBeGreaterThanOrEqual(40);
    const seen = new Set<string>();
    for (const seed of [1, 2, 3, 42]) {
      const r = run(seed);
      for (const e of r.events.filter((x) => x.type === "hazard")) {
        const c = CATASTROPHES[e.data!.variant as string];
        expect(c.family).toBe(e.data!.hazard);
        if (c.zones && !(e.data!.variant === "fire_ants" || e.data!.variant === "mosquitoes" || e.data!.variant === "hornet" || e.data!.variant === "wasps")) expect(c.zones).toContain(e.zone);
        seen.add(c.id);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(20);
  });
});
