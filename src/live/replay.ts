// Données de la démo et du vrai direct : la saison simulée, mise au format lu par demo/survivor.html.
// - La démo (npm run replay) écrit tout dans demo/data.json.
// - Le direct (npm run live) découpe le même objet heure par heure et ne publie chaque morceau qu'à son heure.
import { resolveLook, type Look } from "../characters/looks.js";
import { aiKey, secretDayFor, type AiSeason } from "../ai/season-text";
import { dayOf } from "../engine/season";
import { CATASTROPHES } from "../engine/catastrophes";
import type { SeasonResult } from "../engine/types";
import { Narrator } from "../narration/narrator";

export interface Featured {
  job?: string; bio?: string; motivation?: string; catchphrase?: string; secret?: string; secretDay?: number;
  confessions?: Record<string, string>;
}

export interface ReplayOptions {
  looks: Record<string, Look>;
  ai: AiSeason | null;
  /** Fiches et confessionnaux écrits à la main (seulement pour la saison de démo, graine 42). */
  featured?: Record<string, Featured>;
}

type Txt = { fr: string; en: string };

export function buildReplay(r: SeasonResult, o: ReplayOptions) {
  const { ai, looks } = o;
  const featured = o.featured ?? {};
  const conf = (id: string, lang: "fr" | "en") => {
    const c = ai?.confessions[id];
    if (!c || !Object.keys(c).length) return null;
    return Object.fromEntries(Object.entries(c).map(([d, t]) => [d, (t as Txt)[lang] || (t as Txt).fr]));
  };
  const fr = new Narrator(r, "fr");
  const en = new Narrator(r, "en");

  const cast = r.cast.map((c) => {
    const f = featured[c.id];
    const aiFr = conf(c.id, "fr");
    return {
      id: c.id, name: c.name, age: c.age, gender: c.gender,
      origin: c.origin.fr, job: f?.job ?? c.job.fr, bio: f?.bio ?? c.backstory.fr,
      motivation: f?.motivation ?? c.motivation.fr, catchphrase: f?.catchphrase ?? c.catchphrase.fr,
      secret: f?.secret ?? c.secret.fr, secretDay: f?.secretDay ?? (aiFr ? secretDayFor(c.id) : null),
      traits: c.traits, skills: c.skills, phobia: c.phobia,
      confessions: f?.confessions ?? aiFr,
      ai: !f?.confessions && !!aiFr,
      look: looks[c.id] ? resolveLook(looks[c.id]) : null,
      // version anglaise : l'interface remplace les champs ci-dessus quand on choisit l'anglais
      en: {
        origin: c.origin.en, job: c.job.en, bio: c.backstory.en, motivation: c.motivation.en, catchphrase: c.catchphrase.en,
        secret: c.secret.en, confessions: f?.confessions ? null : conf(c.id, "en"),
      },
      career: c.career,
    };
  });

  const events = r.events
    .filter((e) => e.weight >= 2 || e.type === "evacuated")
    .map((e) => {
      // répliques IA : celles de l'événement, plus le plaidoyer de la campagne pour la scène du vote
      let lines = ai?.lines[aiKey(e)] ?? null;
      if (e.type === "vote_threat" && ai) for (const c of r.events.filter((x) => x.tick === e.tick && x.type === "campaign")) lines = { ...(lines ?? {}), ...(ai.lines[aiKey(c)] ?? {}) };
      const say = lines && Object.keys(lines).length ? Object.fromEntries(Object.entries(lines).map(([k, v]) => [k, [v.fr, v.en]])) : undefined;
      return { t: e.tick, type: e.type, a: e.actors, z: e.zone ?? null, w: e.weight, fr: fr.line(e), en: en.line(e), d: e.data ?? null, ...(say ? { say } : {}) };
    })
    .filter((e) => e.fr);

  return {
    aiModel: ai?.model ?? null,
    catastrophes: Object.fromEntries(Object.values(CATASTROPHES).map((c) => [c.id, { family: c.family, icon: c.icon, color: c.color ?? null, size: c.size ?? 1, intro: c.intro ?? null, cry: c.cry ?? null }])),
    seed: r.config.seed,
    days: r.config.days,
    voteHour: r.config.voteHour,
    arena: { name: r.arena.name.fr, en: r.arena.name.en, zones: r.arena.zones.map((z) => ({ id: z.id, name: z.name.fr, en: z.name.en, neighbors: z.neighbors })) },
    winner: r.winner,
    cast,
    events,
    snapshots: r.snapshots.map((s) => [s.tick, s.people] as [number, Record<string, unknown>]),
    eliminations: r.final.filter((s) => !s.alive).map((s) => ({ id: s.id, t: s.eliminatedAt!, day: dayOf(s.eliminatedAt!), cause: s.eliminationCause })),
  };
}

export type Replay = ReturnType<typeof buildReplay>;
export type ReplayEvent = Replay["events"][number];

/** Heure (tick) où le confessionnal du jour d s'ouvre : 21h, ou au moment de l'évacuation si elle a lieu ce jour-là. */
export function confUnlock(rep: Replay, id: string, d: number) {
  const out = rep.eliminations.find((e) => e.id === id);
  if (out && out.day === d) return out.t;
  return (d - 1) * 24 + 21;
}

/**
 * La Quotidienne du jour d : moments forts, évacués depuis la veille, vote ou finale.
 * Même sélection que l'onglet Quotidienne de la démo ; elle est calculée ici pour les spectateurs gratuits,
 * qui ne reçoivent pas le fil heure par heure.
 */
export function dailyOf(rep: Replay, d: number) {
  const from = (d - 2) * 24 + rep.voteHour, to = (d - 1) * 24 + rep.voteHour;
  const win = rep.events.filter((ev) => ev.t > from && ev.t <= to);
  const hl = win.filter((ev) => ev.w >= 3 && !["evacuated", "vote_threat", "vote_saved", "season_start", "trial", "finale", "winner"].includes(ev.type))
    .filter((ev, i, a) => ev.type !== "showrunner" || a.findIndex((x) => x.type === "showrunner" && (x.d as any)?.kind === (ev.d as any)?.kind) === i)
    .sort((a, b) => b.w - a.w || a.t - b.t).slice(0, 6).sort((a, b) => a.t - b.t);
  const outs = win.filter((ev) => ev.type === "evacuated");
  const vote = win.filter((ev) => ["vote_threat", "vote_saved", "trial", "finale", "winner"].includes(ev.type));
  const snap = [...rep.snapshots].reverse().find(([t]) => t <= to);
  const pick = (ev: ReplayEvent) => ({ t: ev.t, type: ev.type, a: ev.a, fr: ev.fr, en: ev.en, d: ev.d });
  return { day: d, left: snap ? Object.keys(snap[1]).length : 0, hl: hl.map(pick), outs: outs.map(pick), vote: vote.map(pick) };
}
