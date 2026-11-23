// Progression des personnages d'une émission à l'autre : palmarès, expérience, niveau, évolutions.
// Règles volontairement simples et lisibles, pour que les spectateurs les comprennent :
// - chaque émission rapporte de l'expérience selon la place obtenue (et un bonus au podium) ;
// - le niveau monte avec l'expérience (niveau 1 à 10) ;
// - le podium fait progresser le caractère, le vainqueur apprend une compétence de l'émission
//   et gagne un effet visuel (cosmétique seulement, jamais un avantage acheté).

export type Trait = "courage" | "empathy" | "cunning" | "loyalty" | "composure";
export interface ShowResult { show: string; season: number; rank: number; of: number; day?: number; cause?: string }
export interface Career {
  results: ShowResult[];
  xp: number;
  level: number;
  next: number | null; // expérience du niveau suivant (null au niveau maximum)
  bonus: Partial<Record<Trait, number>>;
  learned: string[];
  cosmetics: string[];
  titles: string[];
  wins: number;
  shows: string[]; // émissions gagnées, sans doublon
  legend: boolean;
}

/** Une Légende a gagné au moins deux émissions différentes (ou trois saisons, toutes émissions confondues). */
export const LEGEND = { shows: 2, wins: 3 };

export const SHOW_NAMES: Record<string, string> = { survivor: "Survivor", arena: "Arena Battle", treasure: "Chasse au trésor" };
const nameOf = (r: ShowResult) => `${SHOW_NAMES[r.show] ?? r.show} ${r.season === 0 ? "pilote" : `S${r.season}`}`;

export const LEVELS = [0, 40, 100, 180, 280, 400, 540, 700, 880, 1080];

/** Compétences que chaque émission peut apprendre à son vainqueur. */
export const SHOW_SKILLS: Record<string, string[]> = {
  survivor: ["foraging", "crafting", "swimming", "orientation", "endurance", "firstAid"],
  arena: ["endurance", "stealth", "climbing", "tracking"],
  treasure: ["orientation", "tracking", "negotiation", "climbing"],
};

export function xpFor(r: ShowResult): number {
  const share = r.of > 1 ? (r.of - r.rank) / (r.of - 1) : 1; // 1 pour le vainqueur, 0 pour le premier éliminé
  return Math.round(20 + 120 * share) + (r.rank === 1 ? 120 : r.rank <= 3 ? 50 : r.rank <= 10 ? 20 : 0);
}

export function levelOf(xp: number): number {
  let l = 1;
  for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i]) l = i + 1;
  return l;
}

/** Calcule la carrière à partir des résultats, dans l'ordre chronologique. */
export function careerOf(c: { skills: string[]; traits: Record<Trait, number> }, results: ShowResult[]): Career {
  const k: Career = { results, xp: 0, level: 1, next: LEVELS[1], bonus: {}, learned: [], cosmetics: [], titles: [], wins: 0, shows: [], legend: false };
  const add = (t: Trait, n: number) => (k.bonus[t] = Math.min((k.bonus[t] ?? 0) + n, 100 - c.traits[t]));
  for (const r of results) {
    k.xp += xpFor(r);
    if (r.rank === 1) {
      (["courage", "composure", "cunning", "empathy", "loyalty"] as Trait[]).forEach((t) => add(t, t === "courage" || t === "composure" ? 5 : 2));
      const skill = (SHOW_SKILLS[r.show] ?? []).find((s) => !c.skills.includes(s) && !k.learned.includes(s));
      if (skill) k.learned.push(skill);
      k.cosmetics.push(`aura_${r.show}`);
      k.wins++;
      if (!k.shows.includes(r.show)) k.shows.push(r.show);
      k.titles.push(`Vainqueur · ${nameOf(r)}`);
    } else if (r.rank <= 3) {
      add("courage", 2); add("composure", 2);
      k.cosmetics.push(`frame_${r.show}`);
      k.titles.push(`Finaliste · ${nameOf(r)}`);
    } else if (r.rank <= 10) {
      add("composure", 1);
    }
  }
  k.legend = k.shows.length >= LEGEND.shows || k.wins >= LEGEND.wins;
  if (k.legend) { k.titles.unshift("Légende de The Last"); k.cosmetics.push("legend"); }
  k.level = levelOf(k.xp);
  k.next = k.level < LEVELS.length ? LEVELS[k.level] : null;
  return k;
}

/** Sélection des candidats d'une émission : les plus votés par le public, complétés par un tirage au sort. */
export function selectCast(votes: Record<string, number>, pool: string[], size: number, voted: number, rand: () => number): string[] {
  const ranked = [...pool].sort((a, b) => (votes[b] ?? 0) - (votes[a] ?? 0) || a.localeCompare(b));
  const top = ranked.slice(0, Math.min(voted, size));
  const rest = ranked.slice(top.length);
  const drawn: string[] = [];
  while (drawn.length < size - top.length && rest.length) drawn.push(rest.splice(Math.floor(rand() * rest.length), 1)[0]);
  return [...top, ...drawn];
}
