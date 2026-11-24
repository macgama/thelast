// Vrai direct : découpe la saison en morceaux diffusés chacun à son heure (table « reveals »).
// Règle d'or : on ne publie que ce qui ne peut plus changer. Les colis (midi) et le vote (19h) des vrais
// spectateurs changent la suite ; on publie donc tout jusqu'à la prochaine décision des spectateurs, pas au-delà.
// La base de données ne montre chaque morceau qu'à son heure (reveal_at), même s'il est publié en avance.
import { createHash } from "node:crypto";
import { secretDayFor } from "../ai/season-text";
import { START_HOUR } from "../engine/season";
import type { SeasonConfig } from "../engine/types";
import { confUnlock, dailyOf, type Replay } from "./replay";

export const HOUR = 3600_000;
export const GIFT_HOUR = 12;

export interface LiveConfig extends SeasonConfig {
  /** Heure d'ouverture du vote (les menacés sont annoncés à cette heure). */
  voteOpenHour: number;
}

export interface RevealRow { kind: string; key: string; reveal_at: string; payload: unknown; hash: string }

/** Minuit du jour 1, en millisecondes : l'heure t de la simulation tombe à base + t heures. */
export const baseOf = (startAt: string | number) => new Date(startAt).getTime() - START_HOUR * HOUR;
export const tickTime = (base: number, t: number) => base + t * HOUR;
export const tickAt = (base: number, now: number) => Math.floor((now - base) / HOUR);

/** Les heures où les spectateurs décident : colis à midi chaque jour, vote à 19h (sauf le dernier jour). */
export function decisionTicks(c: Pick<SeasonConfig, "days" | "voteHour">) {
  const out: number[] = [];
  for (let d = 1; d <= c.days; d++) {
    out.push((d - 1) * 24 + GIFT_HOUR);
    if (d < c.days) out.push((d - 1) * 24 + c.voteHour);
  }
  return out.sort((a, b) => a - b);
}

/** Dernière heure qu'on peut publier maintenant : juste avant la prochaine décision des spectateurs. */
export function publishUntil(c: Pick<SeasonConfig, "days" | "voteHour">, base: number, now: number, lastTick: number) {
  const next = decisionTicks(c).find((t) => tickTime(base, t) > now);
  return next === undefined ? lastTick : Math.min(lastTick, next - 1);
}

const iso = (ms: number) => new Date(ms).toISOString();
const hashOf = (reveal: string, payload: unknown) => createHash("sha1").update(reveal + JSON.stringify(payload)).digest("hex").slice(0, 16);

/** Données publiques de la saison (montrées dès le lancement) : casting sans secrets ni confessionnaux. */
export function publicMeta(rep: Replay, c: LiveConfig, startAt: string) {
  return {
    startAt, seed: rep.seed, days: rep.days, voteHour: rep.voteHour, voteOpenHour: c.voteOpenHour, giftHour: GIFT_HOUR,
    aiModel: rep.aiModel, catastrophes: rep.catastrophes, arena: rep.arena,
    cast: rep.cast.map(({ secret, confessions, en, ai, ...pub }) => ({ ...pub, en: { origin: en.origin, job: en.job, bio: en.bio, motivation: en.motivation, catchphrase: en.catchphrase } })),
  };
}

export function buildRows(rep: Replay, c: LiveConfig, base: number, until: number, now: number): RevealRow[] {
  const rows: RevealRow[] = [];
  const add = (kind: string, key: string | number, tick: number, payload: unknown) => {
    const reveal_at = iso(tickTime(base, tick));
    rows.push({ kind, key: String(key), reveal_at, payload, hash: hashOf(reveal_at, payload) });
  };
  const lastTick = rep.snapshots.at(-1)![0];
  const ended = rep.winner && lastTick <= until;
  const outAt = Object.fromEntries(rep.eliminations.map((e) => [e.id, e.t]));

  // 1. chaque heure sur l'île : les événements et la position de chacun (abonnés)
  const byTick = new Map<number, typeof rep.events>();
  for (const ev of rep.events) (byTick.get(ev.t) ?? byTick.set(ev.t, []).get(ev.t)!).push(ev);
  for (const [t, people] of rep.snapshots) if (t <= until) add("tick", t, t, { e: byTick.get(t) ?? [], s: people });

  for (let d = 1; d <= rep.days; d++) {
    const voteTick = (d - 1) * 24 + rep.voteHour;
    // 2. les menacés du soir, annoncés à l'ouverture du vote ; connus dès que les colis de midi sont arrivés
    if (d < rep.days && (tickTime(base, (d - 1) * 24 + GIFT_HOUR) <= now || voteTick <= until)) {
      const thr = rep.events.find((ev) => ev.t === voteTick && ev.type === "vote_threat");
      if (thr) add("threat", d, (d - 1) * 24 + c.voteOpenHour, {
        day: d, ids: thr.a, opens: iso(tickTime(base, (d - 1) * 24 + c.voteOpenHour)), closes: iso(tickTime(base, voteTick)),
      });
    }
    // 3. la Quotidienne de 19h (tout le monde, même sans abonnement)
    if (voteTick <= until && voteTick <= lastTick) add("daily", d, voteTick, dailyOf(rep, d));
  }

  for (const ch of rep.cast) {
    // 4. confessionnaux (abonnés), à 21h ou au moment de l'évacuation
    const days = new Set([...Object.keys(ch.confessions ?? {}), ...Object.keys(ch.en.confessions ?? {})]);
    for (const d of days) {
      const u = confUnlock(rep, ch.id, Number(d));
      if (u <= until && u <= lastTick) add("conf", `${ch.id}:${d}`, u, { id: ch.id, day: Number(d), fr: ch.confessions?.[d] ?? null, en: ch.en.confessions?.[d] ?? null });
    }
    // 5. le secret : le soir de son jour de révélation, ou à son départ de l'île, ou à la fin de la saison
    const sd = ch.secretDay ?? secretDayFor(ch.id);
    const u = Math.min(confUnlock(rep, ch.id, sd), outAt[ch.id] ?? Infinity, ended ? lastTick : Infinity);
    if (u <= until && u <= lastTick) add("secret", ch.id, u, { id: ch.id, fr: ch.secret, en: ch.en.secret });
  }

  // 6. la fin : le vainqueur
  if (ended) add("end", "winner", lastTick, { winner: rep.winner });
  return rows;
}
