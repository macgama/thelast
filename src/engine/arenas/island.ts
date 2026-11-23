// Gabarit d'aventure « Survie » : une île tropicale de 8 zones.
// Une nouvelle aventure = un nouveau fichier de ce type (plus tard : éditable dans le back-office).
import type { Arena } from "../types";

export const island: Arena = {
  id: "island",
  name: { fr: "L'Île aux Échos", en: "Echo Island" },
  start: "beach",
  zones: [
    { id: "beach", name: { fr: "la plage", en: "the beach" }, water: 0.05, food: 0.35, shelter: 0.1, neighbors: ["jungle", "lagoon", "cliffs"], hazards: ["drowning"] },
    { id: "lagoon", name: { fr: "le lagon", en: "the lagoon" }, water: 0.15, food: 0.5, shelter: 0.1, neighbors: ["beach", "mangrove"], hazards: ["drowning"] },
    { id: "jungle", name: { fr: "la jungle", en: "the jungle" }, water: 0.25, food: 0.45, shelter: 0.5, neighbors: ["beach", "river", "ruins", "mangrove"], hazards: ["wasps", "snake"] },
    { id: "river", name: { fr: "la rivière", en: "the river" }, water: 0.85, food: 0.3, shelter: 0.2, neighbors: ["jungle", "waterfall", "mangrove"], hazards: ["drowning", "fever"] },
    { id: "waterfall", name: { fr: "la cascade", en: "the waterfall" }, water: 0.9, food: 0.15, shelter: 0.4, neighbors: ["river", "summit"], hazards: ["fall", "drowning"] },
    { id: "ruins", name: { fr: "les ruines", en: "the ruins" }, water: 0.1, food: 0.1, shelter: 0.8, neighbors: ["jungle", "summit", "cliffs"], hazards: ["rockslide", "snake"] },
    { id: "cliffs", name: { fr: "les falaises", en: "the cliffs" }, water: 0.05, food: 0.25, shelter: 0.3, neighbors: ["beach", "ruins"], hazards: ["fall", "rockslide"] },
    { id: "mangrove", name: { fr: "la mangrove", en: "the mangrove" }, water: 0.4, food: 0.4, shelter: 0.3, neighbors: ["lagoon", "jungle", "river"], hazards: ["wasps", "fever", "snake"] },
    { id: "summit", name: { fr: "le sommet", en: "the summit" }, water: 0.1, food: 0.05, shelter: 0.2, neighbors: ["waterfall", "ruins"], hazards: ["fall"] },
  ],
  hazards: {
    wasps: { id: "wasps", base: 0.0096, damage: [25, 60], counter: "stealth", phobia: "insects" },
    fall: { id: "fall", base: 0.008, damage: [30, 80], counter: "climbing", phobia: "heights" },
    drowning: { id: "drowning", base: 0.0064, damage: [30, 90], counter: "swimming", phobia: "water" },
    snake: { id: "snake", base: 0.0064, damage: [20, 55], counter: "tracking" },
    rockslide: { id: "rockslide", base: 0.0048, damage: [30, 70], counter: "orientation" },
    fever: { id: "fever", base: 0.0064, damage: [15, 40], counter: "firstAid" },
  },
};
