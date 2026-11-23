// Types partagés par le moteur, les récits et (plus tard) l'app web.

export type Lang = "fr" | "en";
export type I18n = Record<Lang, string>;

export const TRAITS = ["courage", "empathy", "cunning", "loyalty", "composure"] as const;
export type Trait = (typeof TRAITS)[number];

export const SKILLS = [
  "firstAid",
  "tracking",
  "climbing",
  "swimming",
  "foraging",
  "negotiation",
  "stealth",
  "endurance",
  "crafting",
  "orientation",
] as const;
export type Skill = (typeof SKILLS)[number];

export type Phobia = "insects" | "heights" | "water" | "darkness" | "solitude";

/** Fiche permanente d'un personnage (pool de ~100, réutilisé de saison en saison). */
export interface Character {
  id: string;
  name: string;
  age: number;
  gender: "f" | "m" | "x";
  origin: I18n; // ville, pays
  job: I18n;
  backstory: I18n;
  secret: I18n;
  motivation: I18n;
  catchphrase: I18n;
  traits: Record<Trait, number>; // 0-100
  skills: Skill[];
  phobia: Phobia;
  /** Progression entre saisons : un vainqueur gagne des points et des effets visuels. */
  career: { seasons: number; wins: number; bonus: Partial<Record<Trait, number>>; cosmetics: string[] };
}

export type ZoneId = string;

export interface Zone {
  id: ZoneId;
  name: I18n;
  water: number; // 0-1 : chance de trouver de l'eau par tentative
  food: number; // 0-1
  shelter: number; // 0-1 : protège la nuit et des tempêtes
  neighbors: ZoneId[];
  hazards: HazardId[];
}

export type HazardId = "wasps" | "fall" | "drowning" | "snake" | "rockslide" | "fever";

export interface Hazard {
  id: HazardId;
  /** Probabilité de base par heure et par personnage présent dans la zone. */
  base: number;
  /** Dégâts (points de santé). */
  damage: [number, number];
  /** Compétence qui protège, phobie qui aggrave. */
  counter?: Skill;
  phobia?: Phobia;
}

export interface Arena {
  id: string;
  name: I18n;
  zones: Zone[];
  start: ZoneId;
  hazards: Record<HazardId, Hazard>;
}

export type Item = "flask" | "medkit" | "map" | "rope" | "rations" | "torch";

/** État d'un personnage pendant une saison. */
export interface Contestant {
  id: string;
  zone: ZoneId;
  health: number;
  energy: number;
  hunger: number; // 0 = rassasié, 100 = affamé
  thirst: number; // 0 = désaltéré, 100 = déshydraté
  morale: number;
  inventory: Item[];
  alive: boolean;
  eliminatedAt?: number;
  eliminationCause?: EliminationCause;
  allies: string[];
  /** Opinion sur les autres (-100 à 100). */
  opinions: Record<string, number>;
  /** Score de popularité simulé auprès des spectateurs. */
  popularity: number;
  /** Nombre d'actions marquantes (sert au showrunner et à la popularité). */
  spotlight: number;
}

export type EliminationCause =
  | "hazard"
  | "thirst"
  | "hunger"
  | "exhaustion"
  | "withdrawal"
  | "vote"
  | "trial"
  | "finale";

/** Tout ce qui arrive dans l'arène devient un événement. Le récit est généré à partir de ces événements. */
export interface GameEvent {
  tick: number;
  type: EventType;
  actors: string[];
  zone?: ZoneId;
  data?: Record<string, unknown>;
  /** Importance 1-5 : sert à choisir ce qui apparaît dans la quotidienne et le prime. */
  weight: number;
}

export type EventType =
  | "season_start"
  | "move"
  | "found_water"
  | "found_food"
  | "found_item"
  | "alliance"
  | "share"
  | "steal"
  | "dispute"
  | "sabotage"
  | "challenge"
  | "hazard"
  | "evacuated"
  | "showrunner"
  | "gift_delivered"
  | "gift_lost"
  | "vote_threat"
  | "vote_saved"
  | "trial"
  | "finale"
  | "winner";

export interface SeasonConfig {
  seed: number;
  participants: number;
  days: number;
  /** Heure de la quotidienne et du vote (0-23). */
  voteHour: number;
  /** Nombre de personnages menacés chaque soir ; les spectateurs en sauvent tous sauf un. */
  threatened: number;
  /** Éliminations totales visées à la fin de chaque jour (hors vote), en cumul. */
  eliminationCurve: number[];
  showrunner: { intensity: number; maxEventsPerDay: number };
  gifts: {
    perCharacterPerDay: number;
    deliveryRate: number;
    catalog: Item[];
    /** Simulation : nombre de spectateurs fictifs qui envoient des étincelles chaque jour. */
    simulatedViewers: number;
  };
  needs: { thirstPerHour: number; hungerPerHour: number; energyPerHour: number };
}

export interface SeasonResult {
  config: SeasonConfig;
  arena: Arena;
  cast: Character[];
  final: Contestant[];
  events: GameEvent[];
  winner: string | null;
  /** Photo de l'arène à chaque heure : sert au replay visuel et au suivi d'un personnage. */
  snapshots: Snapshot[];
}

export interface Snapshot {
  tick: number;
  /** id -> [zone, santé, soif, moral] pour chaque candidat encore en jeu. */
  people: Record<string, [ZoneId, number, number, number]>;
}
