import { describe, expect, it } from "vitest";
import pool from "../data/characters.json";
import config from "../config/season.json";
import { island } from "../src/engine/arenas/island";
import { Season, applyCareer, dayOf } from "../src/engine/season";
import type { Character, SeasonConfig } from "../src/engine/types";
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

  it("garde des candidats jusqu'à la finale", () => {
    for (const seed of [21, 22, 23]) {
      const finale = run(seed).events.find((e) => e.type === "finale")!;
      expect(finale.actors.length).toBeGreaterThanOrEqual(2);
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
});
