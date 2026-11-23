// Transforme les événements du moteur en texte : fil horaire, quotidienne de 19h et prime du jour 7.
import { dayOf, hourOf, type ShowrunnerKind } from "../engine/season";
import type { Character, GameEvent, HazardId, Item, Lang, SeasonResult } from "../engine/types";
import { CAUSE, HAZARD, ITEM, LINES, SHOWRUNNER, UI, WHAT, agree, at, fill, list } from "./templates";

export class Narrator {
  private chars: Map<string, Character>;

  constructor(private readonly result: SeasonResult, private readonly lang: Lang) {
    this.chars = new Map(result.cast.map((c) => [c.id, c]));
  }

  private name(id: string) {
    return this.chars.get(id)?.name ?? id;
  }

  private zone(id?: string) {
    return this.result.arena.zones.find((z) => z.id === id)?.name[this.lang] ?? "";
  }

  private pick(key: string, e: GameEvent) {
    const variants = LINES[key];
    return variants[(e.tick + e.actors.length) % variants.length][this.lang];
  }

  /** Une ligne de récit pour un événement (ou null si trop anodin pour être raconté). */
  line(e: GameEvent): string | null {
    const L = this.lang;
    const [a, b] = e.actors.map((id) => this.name(id));
    const d = e.data ?? {};
    const zone = this.zone(e.zone);
    const base = { a, b, zone, at: at(zone, L), e: agree(this.chars.get(e.actors[0])?.gender, L) };
    switch (e.type) {
      case "season_start":
        return fill(this.pick("season_start", e), { n: e.actors.length, arena: this.result.arena.name[L] });
      case "move":
        return null;
      case "found_water":
      case "found_food":
      case "alliance":
      case "hazard":
        if (e.type === "hazard") {
          const hz = HAZARD[d.hazard as HazardId][L];
          if (d.rescuedBy) return fill(this.pick("hazard_rescued", e), { ...base, hazard: hz, r: this.name(d.rescuedBy as string) });
          return fill(this.pick("hazard", e), { ...base, hazard: hz });
        }
        return fill(this.pick(e.type, e), base);
      case "found_item":
        return fill(this.pick("found_item", e), { ...base, item: ITEM[d.item as Item][L] });
      case "share":
        return fill(this.pick("share", e), { ...base, what: WHAT[d.what as string][L] });
      case "steal":
        if (d.betrayal) {
          const first = fill(this.pick("betrayal", e), base);
          return d.caught ? first : `${first} ${fill(this.pick("steal_ok", e), { ...base, item: ITEM[d.item as Item][L] })}`;
        }
        return d.caught ? fill(this.pick("steal_caught", e), base) : fill(this.pick("steal_ok", e), { ...base, item: ITEM[d.item as Item][L] });
      case "duel":
        return fill(this.pick("duel", e), base);
      case "evacuated":
        return fill(this.pick("evacuated", e), { a, cause: this.cause(e.actors[0]), n: d.remaining as number });
      case "showrunner":
        return "📢 " + fill(SHOWRUNNER[d.kind as ShowrunnerKind][L], { zone: this.zone(e.zone) });
      case "gift_delivered":
        return fill(this.pick("gift_delivered", e), { a, item: ITEM[d.item as Item][L], s: d.supporters as number });
      case "gift_lost":
        return d.intercepted ? fill(this.pick("gift_intercepted", e), base) : fill(this.pick("gift_lost", e), base);
      case "vote_threat":
        return fill(this.pick("vote_threat", e), { list: list(e.actors.map((id) => this.name(id)), L) });
      case "vote_saved":
        return fill(this.pick("vote_saved", e), { list: list(e.actors.map((id) => this.name(id)), L) });
      case "finale":
        return fill(this.pick("finale", e), { list: list(e.actors.map((id) => this.name(id)), L) });
      case "winner":
        return "🏆 " + fill(this.pick("winner", e), { a });
    }
  }

  private cause(id: string) {
    const e = this.result.events.find((x) => x.type === "evacuated" && x.actors[0] === id);
    const d = e?.data ?? {};
    return fill(CAUSE[d.cause as keyof typeof CAUSE][this.lang], {
      hazard: d.hazard ? HAZARD[d.hazard as HazardId][this.lang] : "",
      by: d.by ? this.name(d.by as string) : "",
      e: agree(this.chars.get(id)?.gender, this.lang),
    });
  }

  /** Typographie : espace avant les deux-points en français seulement. */
  private colon() {
    return this.lang === "fr" ? " :" : ":";
  }

  private clock(tick: number) {
    return `${String(hourOf(tick)).padStart(2, "0")}h`;
  }

  /** Fil horaire d'une journée (contenu abonnés). */
  feed(day: number): string {
    const lines = this.result.events
      .filter((e) => dayOf(e.tick) === day && e.weight >= 2)
      .map((e) => [e, this.line(e)] as const)
      .filter(([, l]) => l)
      .map(([e, l]) => `- **${this.clock(e.tick)}** ${l}`);
    return lines.join("\n");
  }

  /** Quotidienne de 19h, visible par tous : moments forts, évacués, vote, popularité. */
  daily(day: number): string {
    const L = this.lang;
    const evs = this.result.events.filter((e) => dayOf(e.tick) === day && hourOf(e.tick) <= this.result.config.voteHour);
    const prevDay = this.result.events.filter((e) => dayOf(e.tick) === day - 1 && hourOf(e.tick) > this.result.config.voteHour);
    const pool = [...prevDay, ...evs];
    const highlights = pool
      .filter((e) => e.weight >= 3 && e.type !== "evacuated" && !e.type.startsWith("vote") && e.type !== "season_start")
      .filter((e, i, arr) => e.type !== "showrunner" || arr.findIndex((x) => x.type === "showrunner" && x.data?.kind === e.data?.kind) === i)
      .sort((a, b) => b.weight - a.weight || a.tick - b.tick)
      .slice(0, 6)
      .sort((a, b) => a.tick - b.tick)
      .map((e) => `- ${this.line(e)}`);
    const out = pool.filter((e) => e.type === "evacuated").map((e) => `- ${this.line(e)}`);
    const vote = pool.filter((e) => e.type === "vote_threat" || e.type === "vote_saved").map((e) => this.line(e));
    const remaining = this.result.final.filter((s) => !s.eliminatedAt || s.eliminatedAt > (day - 1) * 24 + this.result.config.voteHour).length;
    return [
      `### ${UI.daily[L]} · ${UI.day[L]} ${day}`,
      "",
      `**${UI.remaining[L]}${this.colon()} ${remaining}**`,
      "",
      `#### ${UI.highlights[L]}`,
      highlights.join("\n") || `- ${UI.nobody[L]}`,
      "",
      `#### ${UI.eliminated[L]}`,
      out.join("\n") || `- ${UI.nobody[L]}`,
      "",
      vote.length ? vote.join(" ") : "",
    ].join("\n");
  }

  /** Prime du jour 7 : bilan de saison et portrait du vainqueur. */
  prime(): string {
    const L = this.lang;
    const r = this.result;
    const w = r.winner ? this.chars.get(r.winner)! : null;
    const order = r.final
      .filter((s) => !s.alive)
      .sort((a, b) => a.eliminatedAt! - b.eliminatedAt!)
      .map((s, i) => `${i + 1}. ${this.name(s.id)} · ${UI.day[L]} ${dayOf(s.eliminatedAt!)} · ${this.cause(s.id)}`);
    const count = (t: string) => r.events.filter((e) => e.type === t).length;
    // Un moment fort par jour : trahison, sauvetage ou affrontement plutôt que la météo
    const drama = (e: GameEvent) =>
      e.weight * 10 + (e.data?.betrayal ? 15 : 0) + (e.data?.rescuedBy ? 12 : 0) + (e.type === "duel" ? 8 : 0) + (e.type === "alliance" ? 4 : 0) - (e.type === "showrunner" ? 5 : 0);
    const used = new Set<string>();
    const kind = (e: GameEvent) => (e.data?.rescuedBy ? "rescue" : e.data?.betrayal ? "betrayal" : e.type);
    const best = Array.from({ length: r.config.days }, (_, i) => {
      const top = r.events
        .filter((e) => dayOf(e.tick) === i + 1 && e.weight >= 3 && !["evacuated", "vote_threat", "vote_saved", "finale", "winner", "season_start"].includes(e.type))
        .sort((a, b) => drama(b) - (used.has(kind(b)) ? 30 : 0) - (drama(a) - (used.has(kind(a)) ? 30 : 0)))[0];
      if (top) used.add(kind(top));
      return top;
    })
      .filter(Boolean)
      .map((e) => `- ${UI.day[L]} ${dayOf(e.tick)}${this.colon()} ${this.line(e)}`);
    return [
      `## ${UI.prime[L]}`,
      "",
      w
        ? [
            `### 🏆 ${UI.winnerCard[L]}${this.colon()} ${w.name}, ${w.age} ${L === "fr" ? "ans" : "years old"} · ${w.job[L]} · ${w.origin[L]}`,
            "",
            `> « ${w.catchphrase[L]} »`,
            "",
            `${w.backstory[L]} ${L === "fr" ? "Son rêve" : "Their dream"}${this.colon()} ${w.motivation[L].charAt(0).toLowerCase()}${w.motivation[L].slice(1)}`,
          ].join("\n")
        : "",
      "",
      `### ${UI.highlights[L]}`,
      best.join("\n"),
      "",
      `### ${UI.stats[L]}`,
      `| | |\n| --- | --- |`,
      `| Alliances | ${count("alliance")} |`,
      `| ${L === "fr" ? "Trahisons et vols" : "Betrayals and thefts"} | ${count("steal")} |`,
      `| ${L === "fr" ? "Affrontements" : "Standoffs"} | ${count("duel")} |`,
      `| ${L === "fr" ? "Colis livrés" : "Crates delivered"} | ${count("gift_delivered")} |`,
      `| ${L === "fr" ? "Interventions du showrunner" : "Showrunner twists"} | ${count("showrunner")} |`,
      "",
      `### ${UI.route[L]}`,
      order.join("\n"),
    ].join("\n");
  }

  /** Le livret complet de la saison (fil + quotidiennes + prime). */
  book(): string {
    const L = this.lang;
    const parts = [`# The Last · ${this.result.arena.name[L]}`, ""];
    for (let d = 1; d <= this.result.config.days; d++) {
      parts.push(`## ${UI.day[L]} ${d}`, "", this.daily(d), "", `<details><summary>${UI.feed[L]}</summary>`, "", this.feed(d), "", "</details>", "");
    }
    parts.push(this.prime());
    return parts.join("\n");
  }
}
