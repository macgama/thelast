// Moteur de saison : fait avancer l'arène heure par heure (1 tick = 1 heure).
// Le moteur décide de tout ce qui compte (survie, éliminations) avec des règles et des dés pondérés :
// c'est équitable, rejouable et vérifiable. L'IA sert seulement à raconter (voir src/narration).
import { Rng } from "./rng";
import type {
  Arena, Character, Contestant, EliminationCause, EventType, GameEvent, Item, SeasonConfig, SeasonResult, Zone,
} from "./types";

export const START_HOUR = 8;

export const dayOf = (tick: number) => Math.floor(tick / 24) + 1;
export const hourOf = (tick: number) => tick % 24;
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const isNight = (h: number) => h >= 22 || h < 6;

export type ShowrunnerKind = "wasp_swarm" | "storm" | "drought" | "supply_drop" | "heatwave";

export class Season {
  readonly rng: Rng;
  readonly cast: Character[];
  readonly byId: Map<string, Character>;
  readonly state: Map<string, Contestant>;
  readonly events: GameEvent[] = [];
  readonly zones: Map<string, Zone>;
  tick = 0;
  votesDone = 0;
  /** Multiplicateur de danger piloté par le showrunner. */
  danger = 1;
  private droughtUntil = -1;
  private heatUntil = -1;
  private swarm: { zone: string; until: number } | null = null;
  private showrunnerToday = 0;
  winner: string | null = null;

  constructor(pool: Character[], readonly arena: Arena, readonly config: SeasonConfig) {
    this.rng = new Rng(config.seed);
    this.cast = this.rng.sample(pool, Math.min(config.participants, pool.length));
    this.byId = new Map(this.cast.map((c) => [c.id, c]));
    this.zones = new Map(arena.zones.map((z) => [z.id, z]));
    this.state = new Map(
      this.cast.map((c) => [
        c.id,
        {
          id: c.id, zone: arena.start, health: 100, energy: 90, hunger: 10, thirst: 10, morale: 60 + c.traits.composure / 5,
          inventory: [], alive: true, allies: [], opinions: {}, spotlight: 0,
          popularity: 20 + (c.traits.empathy + c.traits.courage) / 10 + this.rng.int(0, 15),
        },
      ]),
    );
  }

  // ---------- Outils ----------

  alive(): Contestant[] {
    return [...this.state.values()].filter((s) => s.alive);
  }

  private emit(type: EventType, actors: string[], weight: number, data?: Record<string, unknown>, zone?: string) {
    this.events.push({ tick: this.tick, type, actors, weight, data, zone });
    for (const id of actors) {
      const s = this.state.get(id);
      if (s && weight >= 3) s.spotlight++;
    }
  }

  private trait(id: string, t: keyof Character["traits"]): number {
    const c = this.byId.get(id)!;
    return clamp(c.traits[t] + (c.career.bonus[t] ?? 0));
  }

  private has(id: string, skill: Character["skills"][number]): boolean {
    return this.byId.get(id)!.skills.includes(skill);
  }

  /** Éliminations visées (hors vote) au moment présent, interpolées dans la journée. */
  targetEliminations(): number {
    const curve = this.config.eliminationCurve;
    const day = dayOf(this.tick);
    const prev = day >= 2 ? curve[day - 2] : 0;
    const cur = curve[Math.min(day - 1, curve.length - 1)];
    return prev + ((cur - prev) * hourOf(this.tick)) / 24;
  }

  nonVoteEliminations(): number {
    return [...this.state.values()].filter((s) => !s.alive && s.eliminationCause !== "vote" && s.eliminationCause !== "finale").length;
  }

  /** Garde-fou : on n'élimine pas si on est trop en avance sur la courbe ou s'il faut garder du monde pour les votes et la finale. */
  private canEliminate(): boolean {
    const votesLeft = this.config.days - 1 - this.votesDone;
    if (this.alive().length <= votesLeft + 2) return false;
    return this.nonVoteEliminations() < this.targetEliminations() + 2;
  }

  private eliminate(s: Contestant, cause: EliminationCause, data?: Record<string, unknown>) {
    s.alive = false;
    s.health = Math.max(0, s.health);
    s.eliminatedAt = this.tick;
    s.eliminationCause = cause;
    for (const other of this.alive()) other.allies = other.allies.filter((a) => a !== s.id);
    this.emit("evacuated", [s.id], 4, { cause, remaining: this.alive().length, ...data }, s.zone);
  }

  /** Inflige des dégâts ; renvoie true si le personnage est évacué. */
  private hurt(s: Contestant, amount: number, cause: EliminationCause, data?: Record<string, unknown>): boolean {
    s.health = clamp(s.health - amount);
    if (s.health <= 0) {
      if (!this.canEliminate()) {
        s.health = 5; // sauvé de justesse : le garde-fou évite une hécatombe hors rythme
        return false;
      }
      this.eliminate(s, cause, data);
      return true;
    }
    return false;
  }

  // ---------- Boucle principale ----------

  run(): SeasonResult {
    const end = (this.config.days - 1) * 24 + 21;
    this.tick = START_HOUR;
    this.emit("season_start", this.cast.map((c) => c.id), 5, { arena: this.arena.id, participants: this.cast.length });
    for (this.tick = START_HOUR; this.tick <= end && !this.winner; this.tick++) this.step();
    return {
      config: this.config, arena: this.arena, cast: this.cast,
      final: [...this.state.values()], events: this.events, winner: this.winner,
    };
  }

  step() {
    const h = hourOf(this.tick);
    if (h === 0) this.showrunnerToday = 0;
    this.needs();
    for (const s of this.rng.shuffle(this.alive())) if (s.alive) this.act(s);
    this.encounters();
    this.hazards();
    this.showrunner();
    if (h === 12) this.gifts();
    const lastDay = dayOf(this.tick) === this.config.days;
    if (h === this.config.voteHour && !lastDay) this.vote();
    if (h === this.config.voteHour && lastDay) this.finale();
  }

  // ---------- Besoins vitaux ----------

  private needs() {
    const n = this.config.needs;
    const heat = this.heatUntil > this.tick ? 1.6 : 1;
    const night = isNight(hourOf(this.tick));
    for (const s of this.alive()) {
      s.thirst = clamp(s.thirst + n.thirstPerHour * heat * (this.has(s.id, "endurance") ? 0.8 : 1) * (night ? 0.5 : 1));
      s.hunger = clamp(s.hunger + n.hungerPerHour * (night ? 0.5 : 1));
      s.energy = clamp(s.energy + (night ? 6 * (0.6 + this.zones.get(s.zone)!.shelter) : -n.energyPerHour));
      if (s.thirst >= 100) this.hurt(s, 7, "thirst");
      if (s.alive && s.hunger >= 100) this.hurt(s, 2.5, "hunger");
      if (s.alive && s.energy <= 0) this.hurt(s, 3, "exhaustion");
      if (!s.alive) continue;
      const lonely = s.allies.length === 0 && this.byId.get(s.id)!.phobia === "solitude" ? 1.5 : 0;
      s.morale = clamp(s.morale - 0.4 - lonely + s.allies.length * 0.3 - (s.thirst > 70 ? 1 : 0));
      if (s.morale <= 0 && this.rng.chance(0.03) && this.canEliminate()) this.eliminate(s, "withdrawal");
    }
  }

  // ---------- Décisions individuelles (règles simples, pondérées par la personnalité) ----------

  private act(s: Contestant) {
    const zone = this.zones.get(s.zone)!;
    const h = hourOf(this.tick);
    if (isNight(h) && !this.rng.chance(0.08)) return; // on dort

    // Objets d'abord
    if (s.thirst > 60 && this.useItem(s, "flask")) { s.thirst = clamp(s.thirst - 60); return; }
    if (s.hunger > 60 && this.useItem(s, "rations")) { s.hunger = clamp(s.hunger - 60); return; }
    if (s.health < 45 && this.useItem(s, "medkit")) { s.health = clamp(s.health + 45); return; }

    const water = this.droughtUntil > this.tick ? zone.water * 0.3 : zone.water;
    if (s.thirst > 50) {
      if (this.rng.chance(water + (this.has(s.id, "foraging") ? 0.1 : 0))) {
        s.thirst = 0;
        s.morale = clamp(s.morale + 3);
        if (this.rng.chance(0.15)) this.emit("found_water", [s.id], 1, undefined, s.zone);
      } else this.moveToward(s, (z) => z.water);
      return;
    }
    if (s.hunger > 55) {
      if (this.rng.chance(zone.food + (this.has(s.id, "foraging") ? 0.15 : 0))) {
        s.hunger = clamp(s.hunger - 55);
        if (this.rng.chance(0.1)) this.emit("found_food", [s.id], 1, undefined, s.zone);
      } else this.moveToward(s, (z) => z.food);
      return;
    }
    if (s.energy < 25) return; // repos
    // Exploration : chance de trouver un objet, ou déplacement
    if (this.rng.chance(0.03 + (this.has(s.id, "crafting") ? 0.03 : 0))) {
      const item = this.rng.pick(this.config.gifts.catalog);
      s.inventory.push(item);
      this.emit("found_item", [s.id], 1, { item }, s.zone);
      return;
    }
    if (this.rng.chance(0.25 + this.trait(s.id, "courage") / 400)) {
      // Les alliés se suivent
      const allyZone = s.allies.length ? this.state.get(this.rng.pick(s.allies))!.zone : null;
      if (allyZone === s.zone && this.rng.chance(0.7)) return; // on reste avec ses alliés
      s.zone = allyZone && zone.neighbors.includes(allyZone) ? allyZone : this.rng.pick(zone.neighbors);
    }
  }

  private useItem(s: Contestant, item: Item): boolean {
    const i = s.inventory.indexOf(item);
    if (i < 0) return false;
    s.inventory.splice(i, 1);
    return true;
  }

  private moveToward(s: Contestant, score: (z: Zone) => number) {
    const zone = this.zones.get(s.zone)!;
    const best = [...zone.neighbors].map((id) => this.zones.get(id)!).sort((a, b) => score(b) - score(a))[0];
    const smart = s.inventory.includes("map") || this.has(s.id, "orientation") ? 0.9 : 0.6;
    s.zone = this.rng.chance(smart) ? best.id : this.rng.pick(zone.neighbors);
  }

  // ---------- Rencontres entre personnages ----------

  private encounters() {
    if (isNight(hourOf(this.tick))) return;
    const byZone = new Map<string, Contestant[]>();
    for (const s of this.alive()) byZone.set(s.zone, [...(byZone.get(s.zone) ?? []), s]);
    for (const group of byZone.values()) {
      if (group.length < 2) continue;
      const meetings = Math.min(3, Math.floor(group.length / 3) + 1);
      for (let m = 0; m < meetings; m++) {
        if (!this.rng.chance(0.18)) continue;
        const [a, b] = this.rng.sample(group, 2);
        if (a.alive && b.alive) this.interact(a, b);
      }
    }
  }

  private opinion(a: Contestant, b: Contestant) {
    return a.opinions[b.id] ?? 0;
  }

  private shiftOpinion(a: Contestant, b: Contestant, delta: number) {
    a.opinions[b.id] = clamp(this.opinion(a, b) + delta, -100, 100);
  }

  private interact(a: Contestant, b: Contestant) {
    const allied = a.allies.includes(b.id);
    const scarcity = (a.thirst + a.hunger) / 200; // 0 = tout va bien, 1 = désespéré
    const kindness = (this.trait(a.id, "empathy") + this.trait(a.id, "loyalty")) / 200;
    const cunning = this.trait(a.id, "cunning") / 100;
    const aggression = (this.trait(a.id, "courage") / 100) * (0.4 + scarcity) * (1 - kindness * 0.7) * (this.opinion(a, b) < -20 ? 1.6 : 1);

    if (allied) {
      // Partage entre alliés
      const needy = b.thirst > a.thirst + 30 ? "water" : b.hunger > a.hunger + 30 ? "food" : null;
      if (needy && this.rng.chance(kindness)) {
        if (needy === "water") { b.thirst = clamp(b.thirst - 30); a.thirst = clamp(a.thirst + 10); }
        else { b.hunger = clamp(b.hunger - 30); a.hunger = clamp(a.hunger + 10); }
        this.shiftOpinion(b, a, 15);
        a.popularity += 3;
        this.emit("share", [a.id, b.id], 2, { what: needy }, a.zone);
      } else if (this.rng.chance(0.03 * cunning * (1 - this.trait(a.id, "loyalty") / 100) * 3)) {
        // Trahison : rupture d'alliance et vol
        a.allies = a.allies.filter((x) => x !== b.id);
        b.allies = b.allies.filter((x) => x !== a.id);
        this.steal(a, b, true);
      }
      return;
    }

    const roll = this.rng.next();
    if (roll < kindness * 0.35 && a.allies.length < 3 && b.allies.length < 3 && this.opinion(b, a) > -30) {
      a.allies.push(b.id);
      b.allies.push(a.id);
      this.shiftOpinion(a, b, 25);
      this.shiftOpinion(b, a, 25);
      a.popularity += 1; b.popularity += 1;
      this.emit("alliance", [a.id, b.id], 3, undefined, a.zone);
    } else if (roll < kindness * 0.35 + cunning * 0.12 && b.inventory.length > 0) {
      this.steal(a, b, false);
    } else if (roll < kindness * 0.35 + cunning * 0.12 + aggression * 0.12) {
      this.duel(a, b);
    }
  }

  private steal(a: Contestant, b: Contestant, betrayal: boolean) {
    const stealth = this.has(a.id, "stealth") ? 0.25 : 0;
    if (b.inventory.length && this.rng.chance(0.45 + stealth)) {
      const item = b.inventory.splice(this.rng.int(0, b.inventory.length - 1), 1)[0];
      a.inventory.push(item);
      this.shiftOpinion(b, a, -40);
      a.popularity -= 1;
      b.popularity += 2;
      this.emit("steal", [a.id, b.id], betrayal ? 4 : 3, { item, betrayal, caught: false }, a.zone);
    } else {
      this.shiftOpinion(b, a, -25);
      a.popularity -= 2;
      this.emit("steal", [a.id, b.id], betrayal ? 4 : 2, { betrayal, caught: true }, a.zone);
    }
  }

  /** Affrontement : résolu hors champ, raconté sobrement. Le perdant est blessé, parfois évacué. */
  private duel(a: Contestant, b: Contestant) {
    const power = (s: Contestant) =>
      this.trait(s.id, "courage") * 0.4 + this.trait(s.id, "composure") * 0.3 + s.health * 0.3 + s.energy * 0.2 + s.allies.length * 8 + this.rng.int(0, 50);
    const pa = power(a);
    const pb = power(b);
    const [win, lose] = pa >= pb ? [a, b] : [b, a];
    this.shiftOpinion(lose, win, -50);
    this.shiftOpinion(win, lose, -20);
    win.popularity += 2;
    win.energy = clamp(win.energy - 15);
    const damage = this.rng.int(15, 45) * this.danger;
    if (lose.inventory.length) win.inventory.push(lose.inventory.pop()!);
    this.emit("duel", [win.id, lose.id], 3, { damage: Math.round(damage) }, a.zone);
    // Les alliés du perdant lui en veulent
    for (const allyId of lose.allies) {
      const ally = this.state.get(allyId);
      if (ally) this.shiftOpinion(ally, win, -30);
    }
    this.hurt(lose, damage, "duel", { by: win.id });
  }

  // ---------- Dangers de l'arène ----------

  private hazards() {
    for (const s of this.alive()) {
      const zone = this.zones.get(s.zone)!;
      const c = this.byId.get(s.id)!;
      const list = [...zone.hazards];
      if (this.swarm && this.swarm.until > this.tick && this.swarm.zone === zone.id) list.push("wasps", "wasps", "wasps");
      for (const hid of list) {
        const hz = this.arena.hazards[hid];
        let p = hz.base * this.danger * this.config.showrunner.intensity;
        if (hz.counter && c.skills.includes(hz.counter)) p *= 0.4;
        if (hz.phobia && c.phobia === hz.phobia) p *= 1.6;
        p *= 1 - this.trait(s.id, "composure") / 250;
        if (s.energy < 20) p *= 1.5;
        if (!this.rng.chance(p)) continue;
        let damage = this.rng.int(hz.damage[0], hz.damage[1]);
        // Une trousse de secours ou des alliés avec premiers soins réduisent la gravité
        const medic = s.allies.some((id) => this.state.get(id)?.zone === s.zone && this.has(id, "firstAid"));
        if (medic) damage *= 0.6;
        if (s.inventory.includes(hid === "fall" ? "rope" : "torch")) damage *= 0.75;
        const out = this.hurt(s, damage, "hazard", { hazard: hid });
        if (!out) {
          s.popularity += 2;
          this.emit("hazard", [s.id], 3, { hazard: hid, damage: Math.round(damage), rescuedBy: medic ? s.allies.find((id) => this.state.get(id)?.zone === s.zone && this.has(id, "firstAid")) : undefined }, s.zone);
        } else {
          // l'événement d'évacuation porte déjà la cause
        }
        if (!s.alive) break;
      }
    }
  }

  // ---------- Showrunner : maintient le rythme ----------

  private showrunner() {
    const target = this.targetEliminations();
    const actual = this.nonVoteEliminations();
    const gap = target - actual; // > 0 : en retard, il ne se passe pas assez de choses
    this.danger = clamp(1 + gap * 0.6, 0.15, 6);
    const h = hourOf(this.tick);
    if (isNight(h) || this.showrunnerToday >= this.config.showrunner.maxEventsPerDay) return;
    // Au moins 4 heures entre deux rebondissements
    const last = [...this.events].reverse().find((e) => e.type === "showrunner");
    if (last && this.tick - last.tick < 4) return;
    // Calme plat depuis 6 heures ? On provoque.
    const recent = this.events.filter((e) => e.tick > this.tick - 6 && e.weight >= 3).length;
    const pressure = (gap > 1.5 ? 0.25 : 0.04) + (recent === 0 ? 0.12 : 0);
    if (!this.rng.chance(pressure * this.config.showrunner.intensity)) return;
    this.showrunnerToday++;
    const options: ShowrunnerKind[] = gap > 1.5 ? ["wasp_swarm", "storm", "drought", "heatwave"] : ["supply_drop", "storm", "drought"];
    // Jamais deux fois le même rebondissement dans la journée
    const today = new Set(this.events.filter((e) => e.type === "showrunner" && dayOf(e.tick) === dayOf(this.tick)).map((e) => e.data?.kind));
    const fresh = options.filter((k) => !today.has(k));
    if (!fresh.length) return;
    const kind = this.rng.pick(fresh);
    const crowded = [...this.zones.values()].map((z) => ({ z, n: this.alive().filter((s) => s.zone === z.id).length })).sort((a, b) => b.n - a.n)[0].z;
    switch (kind) {
      case "wasp_swarm":
        this.swarm = { zone: crowded.id, until: this.tick + 4 };
        this.emit("showrunner", [], 4, { kind }, crowded.id);
        break;
      case "storm":
        for (const s of this.alive()) {
          const z = this.zones.get(s.zone)!;
          s.energy = clamp(s.energy - 25 * (1 - z.shelter));
          s.morale = clamp(s.morale - 10 * (1 - z.shelter));
          if (this.rng.chance(0.25 * (1 - z.shelter) * this.danger) && s.inventory.length) s.inventory.pop();
        }
        this.emit("showrunner", [], 4, { kind });
        break;
      case "drought":
        this.droughtUntil = this.tick + 10;
        this.emit("showrunner", [], 4, { kind });
        break;
      case "heatwave":
        this.heatUntil = this.tick + 8;
        for (const s of this.alive()) s.thirst = clamp(s.thirst + 20);
        this.emit("showrunner", [], 4, { kind });
        break;
      case "supply_drop": {
        const zone = this.rng.pick([...this.zones.values()]);
        this.emit("showrunner", [], 4, { kind }, zone.id);
        // Tout le monde à proximité y court : rencontres garanties
        for (const s of this.alive()) if (zone.neighbors.includes(s.zone) && this.rng.chance(0.5)) s.zone = zone.id;
        const there = this.rng.shuffle(this.alive().filter((s) => s.zone === zone.id));
        if (there[0]) { there[0].inventory.push("medkit", "flask"); there[0].spotlight++; }
        for (let i = 1; i < there.length && i < 4; i++) this.interact(there[i], there[0]);
        break;
      }
    }
  }

  // ---------- Avantages des spectateurs (monnaie gratuite, colis plafonné) ----------

  private gifts() {
    const alive = this.alive();
    const sparks = new Map<string, number[]>();
    // Simulation : chaque spectateur fictif soutient un personnage, proportionnellement à sa popularité
    const weights = alive.map((s) => Math.max(1, s.popularity + s.spotlight * 2));
    const total = weights.reduce((a, b) => a + b, 0);
    for (let v = 0; v < this.config.gifts.simulatedViewers; v++) {
      let r = this.rng.next() * total;
      let i = 0;
      while (r > weights[i]) r -= weights[i++];
      const target = alive[Math.min(i, alive.length - 1)];
      const amount = this.rng.chance(0.05) ? 100 : this.rng.int(1, 5); // quelques gros donateurs
      sparks.set(target.id, [...(sparks.get(target.id) ?? []), amount]);
    }
    // Rendement décroissant : la racine carrée de chaque don, puis somme. 100 petits fans > 1 gros donateur.
    const score = (list: number[]) => list.reduce((a, x) => a + Math.sqrt(x), 0);
    const threshold = 22;
    for (const s of alive) {
      const sc = score(sparks.get(s.id) ?? []);
      if (sc < threshold) continue;
      // 1 colis maximum par personnage et par jour, quel que soit le montant
      const item: Item = s.thirst > 50 ? "flask" : s.health < 60 ? "medkit" : s.hunger > 50 ? "rations" : this.rng.pick(this.config.gifts.catalog);
      if (this.rng.chance(this.config.gifts.deliveryRate)) {
        s.inventory.push(item);
        s.morale = clamp(s.morale + 15); // se savoir soutenu remonte le moral
        this.emit("gift_delivered", [s.id], 2, { item, supporters: (sparks.get(s.id) ?? []).length }, s.zone);
      } else {
        const thief = this.rng.pick(alive.filter((o) => o.id !== s.id && o.zone === s.zone).concat([undefined as unknown as Contestant]));
        if (thief) thief.inventory.push(item);
        this.emit("gift_lost", thief ? [s.id, thief.id] : [s.id], 2, { item, intercepted: !!thief }, s.zone);
      }
    }
  }

  // ---------- Vote du soir : les spectateurs sauvent, un seul part ----------

  private vote() {
    const alive = this.alive();
    if (alive.length <= this.config.threatened) return;
    const threatened = [...alive].sort((a, b) => a.popularity + a.spotlight - (b.popularity + b.spotlight)).slice(0, this.config.threatened);
    this.emit("vote_threat", threatened.map((s) => s.id), 4);
    // Un vote gratuit par spectateur, même poids pour tous
    const votes = new Map(threatened.map((s) => [s.id, 0]));
    for (let v = 0; v < this.config.gifts.simulatedViewers; v++) {
      const w = threatened.map((s) => Math.max(1, s.popularity + s.spotlight + this.rng.int(0, 20)));
      let r = this.rng.next() * w.reduce((a, b) => a + b, 0);
      let i = 0;
      while (r > w[i]) r -= w[i++];
      const id = threatened[Math.min(i, threatened.length - 1)].id;
      votes.set(id, votes.get(id)! + 1);
    }
    const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
    const out = this.state.get(ranked[ranked.length - 1][0])!;
    const saved = ranked.slice(0, -1).map(([id]) => id);
    for (const id of saved) this.state.get(id)!.popularity += 5;
    this.emit("vote_saved", saved, 4, { votes: Object.fromEntries(votes) });
    this.votesDone++;
    this.eliminate(out, "vote", { votes: Object.fromEntries(votes) });
  }

  // ---------- Finale du jour 7 ----------

  private finale() {
    const alive = this.alive();
    this.emit("finale", alive.map((s) => s.id), 5);
    const score = (s: Contestant) =>
      s.health * 0.6 + s.energy * 0.3 + this.trait(s.id, "courage") * 0.3 + this.trait(s.id, "composure") * 0.3 + s.popularity * 0.2 + this.rng.int(0, 40);
    const ranked = [...alive].sort((a, b) => score(b) - score(a));
    for (const s of ranked.slice(1).reverse()) this.eliminate(s, "finale");
    this.winner = ranked[0]?.id ?? null;
    if (this.winner) this.emit("winner", [this.winner], 5);
  }
}

/** Progression du vainqueur entre saisons : un bonus de trait et un effet visuel. */
export function applyCareer(pool: Character[], result: SeasonResult): Character[] {
  const played = new Set(result.cast.map((c) => c.id));
  return pool.map((c) => {
    if (!played.has(c.id)) return c;
    const career = { ...c.career, seasons: c.career.seasons + 1 };
    if (c.id === result.winner) {
      career.wins++;
      career.bonus = { ...career.bonus, courage: (career.bonus.courage ?? 0) + 3, composure: (career.bonus.composure ?? 0) + 3 };
      career.cosmetics = [...career.cosmetics, `crown_${result.arena.id}`];
    }
    return { ...c, career };
  });
}
