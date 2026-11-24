// Textes écrits par l'IA pour une saison, et leur fusion dans les données de la démo.
import type { GameEvent } from "../engine/types";

export interface AiText { fr: string; en: string }
export interface AiSeason {
  seed: number;
  model: string;
  /** clé de scène -> rôle (allyAsk, caughtB…) -> réplique */
  lines: Record<string, Record<string, AiText>>;
  /** id du candidat -> jour -> confessionnal */
  confessions: Record<string, Record<string, AiText>>;
}

export const aiKey = (e: Pick<GameEvent, "tick" | "type" | "actors">) => `${e.tick}:${e.type}:${e.actors.join(",")}`;

/** Jour où un candidat sans fiche écrite à la main révèle son secret (entre le 3e et le 6e jour). */
export const secretDayFor = (id: string) => 3 + ([...id].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7) % 4);
