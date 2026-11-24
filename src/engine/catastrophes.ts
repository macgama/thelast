// Catalogue des catastrophes (config/catastrophes.json) : des dizaines de variantes réparties en familles.
// La famille fixe les effets dans le moteur ; la variante, tirée avec son propre générateur aléatoire,
// donne le nom, l'icône et la mise en scène. Ajouter une variante ne change donc pas le déroulé d'une saison.
import catalog from "../../config/catastrophes.json";
import type { Rng } from "./rng";
import type { I18n, ZoneId } from "./types";

export interface Catastrophe {
  id: string;
  family: string;
  zones?: string[];
  when?: "day" | "night";
  weight?: number;
  name?: I18n;
  announce?: I18n;
  icon: string;
  color?: string;
  size?: number;
  intro?: string;
  cry?: string[];
}

export const INDIVIDUAL = catalog.individual as Catastrophe[];
export const ISLAND = catalog.island as Catastrophe[];
export const CATASTROPHES: Record<string, Catastrophe> = Object.fromEntries([...INDIVIDUAL, ...ISLAND].map((c) => [c.id, c]));

/** Tire une variante de la famille, compatible avec la zone et le moment. */
export function pickVariant(rng: Rng, family: string, zone: ZoneId | null, night: boolean, island = false): string {
  const list = (island ? ISLAND : INDIVIDUAL).filter(
    (c) => c.family === family && (!zone || !c.zones || c.zones.includes(zone)) && (!c.when || (c.when === "night") === night),
  );
  if (!list.length) return family;
  const total = list.reduce((s, c) => s + (c.weight ?? 1), 0);
  let x = rng.next() * total;
  for (const c of list) if ((x -= c.weight ?? 1) < 0) return c.id;
  return list[list.length - 1].id;
}

/**
 * Remplace le catalogue (vrai direct : il vient du back-office). Les tableaux sont modifiés sur place
 * pour que tous les modules qui les ont importés voient le nouveau catalogue.
 */
export function loadCatastrophes(cat: { individual: Catastrophe[]; island: Catastrophe[] }) {
  INDIVIDUAL.splice(0, INDIVIDUAL.length, ...cat.individual);
  ISLAND.splice(0, ISLAND.length, ...cat.island);
  for (const k of Object.keys(CATASTROPHES)) delete CATASTROPHES[k];
  for (const c of [...INDIVIDUAL, ...ISLAND]) CATASTROPHES[c.id] = c;
}
