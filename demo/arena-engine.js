// The Last - Arena Battle : le moteur de la saison, heure par heure, dans le navigateur.
// 30 candidats, 7 jours au plus, une Garde de 3 étoiles, la Cage du sursis et le vote de 19h qui sauve.
// Les candidats se déplacent entre les lieux de l'arène (arenas.js), s'y cachent, y posent des pièges
// et subissent les dangers de l'arène. Le spectateur voit tout cela avant eux : c'est le suspense.
// Tout est déterministe à partir de la graine, sauf les choix du spectateur (duel, vote, caisse, alerte).
// Expose window.ArenaEngine = { cast(pool, seed), create(cast, seed, arenaId) }. Fonctionne aussi dans Node (tests).
(function (root) {
  "use strict";
  const t = (s, v) => (root.t ? root.t(s, v) : s.replace(/\{(\w+)\}/g, (m, k) => (v && k in v ? v[k] : m)));

  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let x = s;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pickOne = (r, arr) => arr[Math.floor(r() * arr.length)];
  function weighted(r, arr, w) {
    const ws = arr.map(w), sum = ws.reduce((a, b) => a + Math.max(0, b), 0);
    let x = r() * sum;
    for (let i = 0; i < arr.length; i++) { x -= Math.max(0, ws[i]); if (x <= 0) return arr[i]; }
    return arr[arr.length - 1];
  }

  // Réglages (plus tard dans le back-office)
  const RULES = {
    size: 30, voted: 24, days: 7, stars: 3,
    firstHour: 8, lastFight: 17, duelHour: 18, voteHour: 19, finaleHour: 20,
    aliveAfter: [26, 22, 17, 12, 7, 3, 1], // repères de fin de journée
    cageUntil: 5, // la Cage du sursis existe du jour 1 au jour 5
    closeOn: [2, 4, 6], // un lieu se ferme ces jours-là, à midi
    hazardsPerDay: 3, trapsPerCandidate: 1, maxTraps: 6,
  };
  const WEAPONS = ["foam", "paint", "potion"];

  // Casting : 24 personnages choisis par le public (simulé), 6 repêchés par la production parmi les moins vus
  function cast(pool, seed = 7) {
    const r = rng(seed * 977 + 13);
    const scored = pool.map((c) => ({ c, s: (c.career?.xp || 0) + (c.career?.wins || 0) * 120 + r() * 220 }));
    scored.sort((a, b) => b.s - a.s);
    const voted = scored.slice(0, RULES.voted).map((x) => ({ ...x.c, pick: "public", votes: Math.round(800 + x.s * 9) }));
    const rest = scored.slice(RULES.voted).map((x) => x.c);
    const fewest = Math.min(...rest.map((c) => c.career?.played?.length || 0));
    const shy = rest.filter((c) => (c.career?.played?.length || 0) <= fewest + 1);
    const prod = [];
    while (prod.length < RULES.size - RULES.voted && shy.length) prod.push({ ...shy.splice(Math.floor(r() * shy.length), 1)[0], pick: "prod" });
    return [...voted, ...prod].sort((a, b) => a.id.localeCompare(b.id));
  }

  function create(castList, seed = 7, arenaId) {
    const r = rng(seed);
    const ARENAS = root.ARENAS;
    const A = ARENAS[arenaId] || ARENAS[root.ARENA_LIST[seed % root.ARENA_LIST.length]];
    const PL = Object.fromEntries(A.places.map((p) => [p.id, p]));
    const center = A.places[0];
    const ringPlaces = A.places.slice(1);
    const C = castList.map((c, i) => {
      const home = ringPlaces[i % ringPlaces.length].id;
      return {
        id: c.id, name: c.name, c,
        stars: RULES.stars, state: "in", // in | cage | out
        place: home, intent: home, hidden: false, item: null, shield: 0, map: false, ally: null,
        stats: { hits: 0, kos: 0, taken: 0, saved: 0, traps: 0, caught: 0 }, outDay: 0, outRank: 0,
      };
    });
    const byId = Object.fromEntries(C.map((x) => [x.id, x]));
    const tr = (x, k) => x.c.traits?.[k] ?? 50;
    const S = { day: 1, hour: RULES.firstHour, closed: [], alliances: [], traps: [], hazards: [], over: false, winner: null, log: [], pending: null, drops: {}, warn: null, trapSeq: 0 };
    const inArena = () => C.filter((x) => x.state === "in");
    const alive = () => C.filter((x) => x.state !== "out");
    const caged = () => C.filter((x) => x.state === "cage");
    const rivalsOf = (x) => (x.c.career?.rivals || []).map((rv) => rv.id).filter((id) => byId[id] && byId[id].state === "in");
    const openPlaces = () => A.places.filter((p) => !S.closed.includes(p.id));
    const pname = (id) => PL[id].name;
    // « à le » → « au », « de les » → « des »… (en anglais : « at the … »)
    const EN = () => root.I18N?.lang === "en";
    const at = (id) => { const n = PL[id].name; if (EN()) return "at " + n; return n.startsWith("le ") ? "au " + n.slice(3) : n.startsWith("les ") ? "aux " + n.slice(4) : "à " + n; };
    const of = (id) => { const n = PL[id].name; if (EN()) return "at " + n; return n.startsWith("le ") ? "du " + n.slice(3) : n.startsWith("les ") ? "des " + n.slice(4) : "de " + n; };
    const arenaName = () => A.name.replace(/^(Le |La |Les |L'|The )/, (m) => m.toLowerCase());
    const trapKind = (id) => A.traps.find((k) => k.id === id) || A.traps[0];
    let rank = C.length;

    const ev = (type, data) => ({ type, day: S.day, hour: S.hour, ...data });

    // ---------- coups et dégâts ----------
    function weaponFor(a) {
      if (a.item && WEAPONS.includes(a.item)) return a.item;
      const cun = tr(a, "cunning"), cou = tr(a, "courage");
      return weighted(r, WEAPONS, (w) => ({ foam: 10 + cou / 4, paint: 14, potion: 4 + cun / 5 })[w]);
    }
    // soft : les pièges et les dangers ne mettent pas hors jeu quand le rythme de la saison est déjà atteint
    const envSoft = () => S.day >= RULES.days || koNeeded() <= 0;
    function damage(v, by, out, dmg, soft) {
      const floor = soft ? 1 : 0;
      v.stars = Math.max(floor, v.stars - dmg);
      v.stats.taken++;
      if (v.stars === 0) knockOut(v, by, out);
    }
    function knockOut(v, by, out) {
      v.stars = 0; v.hidden = false;
      if (by) by.stats.kos++;
      if (v.ally) breakAlliance(v.ally);
      if (S.day <= RULES.cageUntil) { v.state = "cage"; out.push(ev("ko", { v: v.id, by: by?.id, place: v.place, to: "cage", text: t("{v} est hors jeu ! Le drone l'emporte dans la Cage du sursis.", { v: v.name }) })); }
      else evacuate(v, out, by);
    }
    function evacuate(v, out, by) {
      v.state = "out"; v.outDay = S.day; v.outRank = rank--;
      out.push(ev("out", { v: v.id, by: by?.id, place: v.place, rank: v.outRank, text: t("{v} est évacué·e par drone. {n}e place.", { v: v.name, n: v.outRank }) }));
    }
    function hit(a, v, kind, out, dmg = 1) {
      if (v.state !== "in") return;
      if (kind !== "betray" && kind !== "duel" && v.shield > 0) {
        v.shield--;
        out.push(ev("block", { a: a.id, v: v.id, kind, place: v.place, text: t("Le bouclier en mousse de {v} renvoie l'attaque de {a} !", { a: a.name, v: v.name }) }));
        return;
      }
      a.stats.hits++;
      // le rythme de la saison est atteint : on ne sort plus personne avant le soir (sauf en finale)
      const floor = kind !== "finale" && koNeeded() <= 0 ? 1 : 0;
      v.stars = Math.max(floor, v.stars - dmg);
      v.stats.taken++;
      v.hidden = false;
      out.push(ev("hit", { a: a.id, v: v.id, kind, stars: v.stars, place: v.place, text: hitLine(kind, a, v) }));
      if (v.stars === 0) knockOut(v, a, out);
    }
    function hitLine(kind, a, v) {
      const L = {
        foam: [t("BOING ! {a} assomme {v} d'un coup de masse en mousse.", { a: a.name, v: v.name }), t("{a} fait tournoyer son épée en mousse : {v} voit des étoiles.", { a: a.name, v: v.name })],
        paint: [t("SPLAT ! {a} repeint {v} en rose fluo.", { a: a.name, v: v.name }), t("{v} se fait arroser de peinture par {a}. Impossible de se cacher maintenant.", { a: a.name, v: v.name })],
        potion: [t("{a} offre une boisson à {v}. Potion du fou rire : {v} ne tient plus debout.", { a: a.name, v: v.name }), t("Hic ! La potion de {a} donne un hoquet géant à {v}.", { a: a.name, v: v.name })],
        betray: [t("TRAHISON ! {a} frappe son allié·e {v} dans le dos.", { a: a.name, v: v.name })],
        duel: [t("{a} remporte le duel du soir contre {v} !", { a: a.name, v: v.name })],
        finale: [t("{a} touche {v} au cœur de l'arène !", { a: a.name, v: v.name })],
      }[kind];
      return pickOne(r, L);
    }

    // ---------- alliances ----------
    function formAlliance(out) {
      const free = inArena().filter((x) => !x.ally);
      if (free.length < 2) return;
      const a = weighted(r, free, (x) => 10 + tr(x, "empathy"));
      const others = free.filter((x) => x !== a && !rivalsOf(a).includes(x.id));
      if (!others.length) return;
      const b = weighted(r, others, (x) => 10 + tr(x, "loyalty") + (x.place === a.place ? 40 : 0));
      const id = "al" + S.alliances.length;
      S.alliances.push({ id, members: [a.id, b.id], since: S.day });
      a.ally = b.ally = id;
      b.intent = b.place = a.place;
      out.push(ev("ally", { a: a.id, v: b.id, place: a.place, text: t("{a} et {v} topent là : alliance !", { a: a.name, v: b.name }) }));
    }
    function breakAlliance(id) {
      const al = S.alliances.find((x) => x.id === id);
      if (!al) return;
      for (const m of al.members) if (byId[m].ally === id) byId[m].ally = null;
      al.broken = S.day;
    }
    const partner = (x) => { const al = S.alliances.find((a) => a.id === x.ally); return al ? byId[al.members.find((m) => m !== x.id)] : null; };
    const friendly = (a, b) => a === b || (a.ally && a.ally === b.ally);

    // ---------- rythme ----------
    function koNeeded() {
      const goal = RULES.aliveAfter[S.day - 1];
      if (S.day <= RULES.cageUntil) return Math.max(0, alive().length - goal + 1 - caged().length);
      return Math.max(0, alive().length - goal);
    }

    // ---------- les dangers de l'arène ----------
    function scheduleHazards() {
      S.hazards = S.hazards.filter((h) => h.day >= S.day && !h.done);
      const n = S.day === RULES.days ? 2 : RULES.hazardsPerDay;
      const hours = [];
      while (hours.length < n) { const h = 10 + Math.floor(r() * 8); if (!hours.includes(h)) hours.push(h); }
      for (const h of hours.sort((a, b) => a - b)) {
        const spots = openPlaces().filter((p) => p !== center);
        const p = weighted(r, spots, (x) => (x.kind === "danger" ? 4 : x.kind === "open" ? 2 : 1));
        S.hazards.push({ day: S.day, hour: h, place: p.id, hz: pickOne(r, A.hazards).id });
      }
    }
    const hzOf = (id) => A.hazards.find((h) => h.id === id);
    function runHazards(out) {
      for (const h of S.hazards.filter((x) => x.day === S.day && x.hour === S.hour && !x.done)) {
        h.done = true;
        if (S.closed.includes(h.place)) continue;
        const hz = hzOf(h.hz);
        const there = inArena().filter((x) => x.place === h.place);
        const safe = there.filter((x) => x.hidden && PL[h.place].kind === "hide");
        const hitList = there.filter((x) => !safe.includes(x));
        out.push(ev("hazard", { place: h.place, hz: h.hz, fx: hz.fx, color: hz.color, ids: hitList.map((x) => x.id), safe: safe.map((x) => x.id),
          text: hitList.length ? t("Danger de l'arène : {d} frappe {l} !", { d: hz.name, l: pname(h.place) }) : t("Danger de l'arène : {d} frappe {l}… mais il n'y a personne.", { d: hz.name, l: pname(h.place) }) }));
        for (const x of safe) out.push(ev("note", { a: x.id, place: h.place, text: t("{a} était bien caché·e : le danger passe sans le·la toucher.", { a: x.name }) }));
        const soft = envSoft();
        for (const x of hitList) {
          out.push(ev("hit", { a: null, v: x.id, kind: "hazard", hz: h.hz, fx: hz.fx, place: h.place, stars: Math.max(soft ? 1 : 0, x.stars - 1), text: t(hz.hit, { v: x.name }) }));
          damage(x, null, out, 1, soft);
        }
      }
    }
    function announceHazards(out) {
      for (const h of S.hazards.filter((x) => x.day === S.day && x.hour === S.hour + 1 && !x.done)) {
        if (S.closed.includes(h.place)) continue;
        const going = inArena().filter((x) => x.intent === h.place).map((x) => x.id);
        out.push(ev("hazardSoon", { place: h.place, hz: h.hz, ids: going, text: going.length
          ? t("Dans une heure, {d} frappera {l}. {n} candidat(s) s'y trouveront. Eux ne le savent pas.", { d: hzOf(h.hz).name, l: pname(h.place), n: going.length })
          : t("Dans une heure, {d} frappera {l}. Les candidats ne le savent pas.", { d: hzOf(h.hz).name, l: pname(h.place) }) }));
      }
    }

    // ---------- pièges posés par les candidats ----------
    function setTraps(out) {
      for (const a of inArena()) {
        const mine = S.traps.filter((x) => x.owner === a.id).length;
        if (mine >= RULES.trapsPerCandidate || S.traps.length >= RULES.maxTraps) continue;
        const chance = 0.012 + tr(a, "cunning") / 2000 + (a.item === "trap" ? 0.2 : 0);
        if (r() > chance) continue;
        // là où il est, ou là où un rival risque de passer
        const rv = rivalsOf(a).map((id) => byId[id]).find((x) => PL[x.intent] && !S.closed.includes(x.intent));
        const place = rv && r() < 0.6 ? rv.intent : (r() < 0.5 ? a.place : pickOne(r, PL[a.place].links.filter((id) => !S.closed.includes(id))) || a.place);
        if (S.traps.some((x) => x.place === place)) continue;
        if (place === center.id && !(rv && rv.intent === place)) continue;
        const kind = pickOne(r, A.traps);
        const trap = { id: "tp" + ++S.trapSeq, place, owner: a.id, kind: kind.id, day: S.day, hour: S.hour };
        S.traps.push(trap);
        a.stats.traps++;
        if (a.item === "trap") a.item = null;
        out.push(ev("trapSet", { a: a.id, place, trap: trap.id, kind: kind.id, from: a.place, target: rv && rv.intent === place ? rv.id : null,
          text: rv && rv.intent === place ? t("{a} pose {p} {al}. Il·elle sait que {v} doit y passer.", { a: a.name, p: kind.name, al: at(place), v: rv.name }) : t("{a} pose {p} {al}.", { a: a.name, p: kind.name, al: at(place) }) }));
      }
    }
    function springTraps(x, out) {
      const tp = S.traps.find((p) => p.place === x.place && !friendly(byId[p.owner], x));
      if (!tp) return;
      const owner = byId[tp.owner], kind = trapKind(tp.kind);
      S.traps = S.traps.filter((p) => p !== tp);
      if (x.map) {
        out.push(ev("dodge", { a: owner.id, v: x.id, place: x.place, trap: tp.id, kind: tp.kind, text: t("{v} avait la carte des pièges : il·elle enjambe {p} de {a} et le démonte.", { a: owner.name, v: x.name, p: kind.name }) }));
        return;
      }
      owner.stats.hits++; owner.stats.caught++;
      const soft = envSoft();
      out.push(ev("hit", { a: owner.id, v: x.id, kind: "trap", trap: tp.id, trapKind: tp.kind, place: x.place, stars: Math.max(soft ? 1 : 0, x.stars - 1), text: t(kind.hit, { a: owner.name, v: x.name }) }));
      x.hidden = false;
      damage(x, owner, out, 1, soft);
    }

    // ---------- déplacements ----------
    function planMoves() {
      const open = openPlaces().map((p) => p.id);
      for (const x of inArena()) {
        const here = PL[x.place];
        const options = [x.place, ...here.links].filter((id) => open.includes(id));
        const rv = rivalsOf(x).map((id) => byId[id]);
        const p = partner(x);
        x.intent = weighted(r, options, (id) => {
          let w = id === x.place ? (x.hidden ? 8 : 3) : 2;
          if (PL[id].kind === "loot" && !x.item) w += 2.5;
          if (PL[id].kind === "hide" && x.stars <= 1) w += 4;
          if (PL[id].kind === "danger") w -= 0.5;
          if (rv.some((y) => y.place === id)) w += tr(x, "courage") / 30;
          if (p && p.state === "in" && p.place === id) w += 3;
          return w;
        });
      }
      // les alliés marchent ensemble
      for (const al of S.alliances) if (!al.broken) { const [a, b] = al.members.map((m) => byId[m]); if (a.state === "in" && b.state === "in") b.intent = a.intent; }
    }
    function moveAll(out) {
      // l'alerte du spectateur, juste avant le départ
      if (S.warn) {
        const x = byId[S.warn]; S.warn = null;
        const tp = x && x.state === "in" && S.traps.find((p) => p.place === x.intent && !friendly(byId[p.owner], x));
        if (tp) {
          if (r() < 0.45 + tr(x, "composure") / 200 + tr(x, "empathy") / 400) {
            const alt = [x.place, ...PL[x.place].links].filter((id) => id !== x.intent && !S.closed.includes(id));
            x.intent = pickOne(r, alt) || x.place;
            out.push(ev("heed", { v: x.id, place: tp.place, text: t("{v} entend les cris du public et fait demi-tour juste avant {l}. Ouf !", { v: x.name, l: pname(tp.place) }) }));
          } else out.push(ev("ignore", { v: x.id, place: tp.place, text: t("Le public a beau crier, {v} n'écoute rien et continue vers {l}…", { v: x.name, l: pname(tp.place) }) }));
        }
      }
      for (const x of inArena()) {
        if (x.intent !== x.place) { x.place = x.intent; x.hidden = false; }
      }
      for (const x of inArena()) springTraps(x, out);
    }
    function hideHour(out) {
      for (const x of inArena()) {
        if (x.hidden || PL[x.place].kind !== "hide") continue;
        const chance = 0.18 + (3 - x.stars) * 0.15 + (100 - tr(x, "courage")) / 400;
        if (r() < chance) {
          x.hidden = true;
          if (x.stars <= 1 || r() < 0.1) out.push(ev("hide", { a: x.id, place: x.place, text: t("{a} se cache dans {l}.", { a: x.name, l: pname(x.place) }) }));
        }
      }
    }
    function warnings(out) {
      // ironie dramatique : le public voit qui marche vers un piège
      let n = 0;
      for (const x of inArena()) {
        if (x.intent === x.place) continue;
        const tp = S.traps.find((p) => p.place === x.intent && !friendly(byId[p.owner], x));
        if (!tp) continue;
        out.push(ev("danger", { v: x.id, a: tp.owner, place: tp.place, trap: tp.id, quiet: n++ >= 2,
          text: t("{v} se dirige vers {l}… où {a} a caché {p}.", { v: x.name, l: pname(tp.place), a: byId[tp.owner].name, p: trapKind(tp.kind).name }) }));
      }
    }

    // ---------- combats ----------
    function fightHour(out) {
      const arena = inArena();
      if (arena.length < 2) return;
      const need = koNeeded();
      const hoursLeft = RULES.lastFight - S.hour + 2;
      const weakest = [...arena].sort((a, b) => a.stars - b.stars).slice(0, need);
      const starsNeeded = weakest.reduce((s, x) => s + x.stars + x.shield, 0);
      let n = Math.round(starsNeeded / hoursLeft + (r() - 0.45) * 1.1);
      if (S.day === RULES.days) n = 0; // le dernier jour, on garde les forces pour la finale
      n = Math.max(0, Math.min(4, n));
      for (let i = 0; i < n; i++) {
        const pool = inArena();
        if (pool.length < 2) break;
        const v = weighted(r, pool, (x) => ((4 - x.stars) * 3 + 1) * (x.hidden ? 0.35 : 1));
        const p = partner(v);
        if (p && p.state === "in" && S.day >= 3 && r() < 0.12 + (100 - tr(p, "loyalty")) / 400) {
          breakAlliance(v.ally);
          p.place = v.place;
          hit(p, v, "betray", out, 2);
          continue;
        }
        const near = [v.place, ...PL[v.place].links];
        let attackers = pool.filter((x) => x !== v && x !== p && near.includes(x.place));
        if (!attackers.length) attackers = pool.filter((x) => x !== v && x !== p);
        if (!attackers.length) break;
        const a = weighted(r, attackers, (x) => 6 + tr(x, "courage") / 10 + tr(x, "cunning") / 12 + (rivalsOf(v).includes(x.id) ? 10 : 0) + x.stars + (x.place === v.place ? 6 : 0));
        if (a.place !== v.place) { a.place = a.intent = v.place; a.hidden = false; }
        if (v.hidden) out.push(ev("found", { a: a.id, v: v.id, place: v.place, text: t("{a} débusque {v}, caché·e dans {l} !", { a: a.name, v: v.name, l: pname(v.place) }) }));
        hit(a, v, weaponFor(a), out);
      }
    }
    function lootHour(out) {
      const n = S.day === 1 && S.hour === RULES.firstHour ? 6 : 1;
      for (let i = 0; i < n; i++) {
        const pool = inArena().filter((x) => !x.item && (x.place === center.id || (S.day === 1 && S.hour === RULES.firstHour)));
        if (!pool.length || (n === 1 && r() > 0.5)) break;
        const x = weighted(r, pool, (y) => 5 + tr(y, "courage") / 8);
        const item = pickOne(r, ["foam", "paint", "potion", "shield", "map", "trap", "trap"]);
        x.item = item;
        if (item === "shield") x.shield = Math.min(2, x.shield + 1);
        if (item === "map") x.map = true;
        out.push(ev("loot", { a: x.id, item, place: center.id, text: t("{a} ramasse {item} dans une caisse {dl}.", { a: x.name, item: itemName(item), dl: of(center.id) }) }));
      }
    }
    const itemName = (it) => ({ foam: t("une masse en mousse"), paint: t("un lance-peinture"), potion: t("une potion douteuse"), shield: t("un bouclier en mousse"), map: t("la carte des pièges"), star: t("une étoile de Garde"), trap: t("un kit de piégeur") })[it];

    function closePlace(out) {
      if (!RULES.closeOn.includes(S.day) || S.hour !== 12) return;
      const open = ringPlaces.filter((p) => !S.closed.includes(p.id));
      if (open.length <= 3) return;
      const p = pickOne(r, open);
      S.closed.push(p.id);
      S.traps = S.traps.filter((x) => x.place !== p.id);
      for (const x of C) { if (x.place === p.id) { x.place = center.id; x.hidden = false; } if (x.intent === p.id) x.intent = center.id; }
      out.push(ev("zone", { place: p.id, text: t("Alerte ! Le brouillard qui fait éternuer envahit {l}. Tout le monde dehors !", { l: p.name }) }));
    }

    function duelOptions() {
      const pool = inArena();
      if (pool.length < 2) return [];
      const opts = [], used = new Set();
      for (const x of [...pool].sort(() => r() - 0.5)) {
        if (opts.length >= 2) break;
        const rv = rivalsOf(x).find((id) => !used.has(id) && !used.has(x.id) && byId[id].state === "in");
        if (rv) { opts.push({ a: x.id, b: rv, why: "rival" }); used.add(x.id); used.add(rv); }
      }
      while (opts.length < 3) {
        const free = pool.filter((x) => !used.has(x.id));
        if (free.length < 2) break;
        const a = pickOne(r, free), b = pickOne(r, free.filter((x) => x !== a));
        opts.push({ a: a.id, b: b.id, why: "public" }); used.add(a.id); used.add(b.id);
      }
      return opts;
    }
    function duel(o, out) {
      const a = byId[o.a], b = byId[o.b];
      if (a.state !== "in" || b.state !== "in") return;
      a.place = b.place = center.id; a.hidden = b.hidden = false;
      const pa = tr(a, "courage") + tr(a, "composure") + a.stars * 25 + r() * 120;
      const pb = tr(b, "courage") + tr(b, "composure") + b.stars * 25 + r() * 120;
      const [w, l] = pa >= pb ? [a, b] : [b, a];
      out.push(ev("duelStart", { a: a.id, v: b.id, place: center.id, text: t("Duel du soir au centre de l'arène : {a} contre {v} !", { a: a.name, v: b.name }) }));
      hit(w, l, "duel", out);
    }
    function forceKos(out) {
      let guard = 40;
      while (koNeeded() > 0 && inArena().length > 1 && guard--) {
        const pool = inArena();
        const v = [...pool].sort((a, b) => a.stars - b.stars || r() - 0.5)[0];
        const a = weighted(r, pool.filter((x) => x !== v), (x) => 5 + x.stars + (x.place === v.place ? 5 : 0));
        v.shield = 0;
        if (a.place !== v.place) a.place = a.intent = v.place;
        hit(a, v, weaponFor(a), out);
      }
    }

    function popularity(x) {
      return 1 + (x.c.career?.xp || 0) / 150 + x.stats.hits * 0.3 + (x.c.pick === "public" ? 0.5 : 0);
    }
    function voteResult(choice) {
      const cage = caged();
      const raw = cage.map((x) => popularity(x) * (0.7 + r() * 0.6) + (x.id === choice ? 3 : 0));
      const sum = raw.reduce((a, b) => a + b, 0);
      const pct = cage.map((x, i) => ({ id: x.id, pct: Math.round((raw[i] / sum) * 100) }));
      pct.sort((a, b) => b.pct - a.pct);
      return pct;
    }

    function finale(out) {
      for (const x of inArena()) { x.place = center.id; x.hidden = false; x.shield = 0; x.stars = Math.max(1, x.stars); }
      S.traps = [];
      out.push(ev("finale", { ids: inArena().map((x) => x.id), place: center.id, text: t("C'est l'heure de la grande finale ! Plus de Cage, plus de sursis : le dernier debout gagne The Last - Arena Battle.") }));
      let guard = 60;
      while (inArena().length > 1 && guard--) {
        const pool = inArena();
        const a = weighted(r, pool, (x) => 4 + x.stars + tr(x, "courage") / 25);
        const v = weighted(r, pool.filter((x) => x !== a), (x) => 5 - x.stars);
        hit(a, v, "finale", out);
      }
      crown(out);
    }
    function crown(out) {
      const w = inArena()[0] || alive()[0];
      S.over = true; S.winner = w.id;
      w.outRank = 1;
      out.push(ev("win", { a: w.id, place: w.place, text: t("{a} est le dernier debout ! Vainqueur de The Last - Arena Battle.", { a: w.name }) }));
    }

    // ---------- API ----------
    // next() renvoie l'heure suivante : { day, hour, events, ask? }. Si ask existe, appeler answer(valeur).
    function next() {
      if (S.over) return null;
      if (S.pending) throw new Error("answer() attendu");
      const out = [];
      const { day, hour } = S;
      if (hour === RULES.firstHour) {
        if (day === 1) out.push(ev("enter", { text: t("Les 30 candidats entrent dans {a}. Les caisses {dl} s'ouvrent : c'est parti !", { a: arenaName(), dl: of(center.id) }) }));
        for (const x of C) x.map = false; // la carte des pièges ne vaut que pour une journée
        scheduleHazards();
        if (day > 1) planMoves();
      }
      for (const [id, item] of Object.entries(S.drops)) {
        const x = byId[id];
        if (x && x.state === "in") {
          if (item === "star") x.stars = Math.min(RULES.stars, x.stars + 1);
          if (item === "shield") x.shield = Math.min(2, x.shield + 1);
          if (item === "map") x.map = true;
          out.push(ev("drop", { a: x.id, item, stars: x.stars, place: x.place, text: t("Une caisse tombe du ciel pour {a} : {item} !", { a: x.name, item: itemName(item) }) }));
        }
      }
      S.drops = {};

      if (hour <= RULES.lastFight) {
        if (!(day === 1 && hour === RULES.firstHour)) moveAll(out);
        closePlace(out);
        runHazards(out);
        lootHour(out);
        if (S.day <= 2 && r() < 0.45) formAlliance(out);
        hideHour(out);
        setTraps(out);
        fightHour(out);
        planMoves();
        warnings(out);
        announceHazards(out);
      }
      let ask = null;
      if (hour === RULES.duelHour && inArena().length > 2 && day < RULES.days) {
        const options = duelOptions();
        if (options.length) ask = { kind: "duel", options };
        else forceKos(out);
      } else if (hour === RULES.voteHour) {
        if (day <= RULES.cageUntil && caged().length) {
          if (caged().length === 1) { out.push(ev("note", { text: t("Un seul candidat dans la Cage ce soir : le public le sauve d'office.") })); const x = caged()[0]; x.state = "in"; x.stars = 1; x.stats.saved++; x.place = x.intent = center.id; }
          else ask = { kind: "vote", ids: caged().map((x) => x.id) };
        }
      } else if (hour === RULES.finaleHour && day === RULES.days) {
        finale(out);
      }
      if (!ask) advance(out);
      else S.pending = ask;
      S.log.push(...out);
      return { day, hour, events: out, ask };
    }
    function answer(value) {
      const ask = S.pending;
      if (!ask) return [];
      S.pending = null;
      const out = [];
      if (ask.kind === "duel") {
        const o = ask.options.find((x) => x.a === value?.a && x.b === value?.b) || ask.options[0];
        duel(o, out);
        forceKos(out);
      } else if (ask.kind === "vote") {
        const res = voteResult(value);
        const saved = byId[res[0].id];
        out.push(ev("vote", { result: res, saved: saved.id, text: t("Le public a parlé : {a} est sauvé·e avec {p} % des votes et retourne dans l'arène demain matin.", { a: saved.name, p: res[0].pct }) }));
        saved.state = "in"; saved.stars = 1; saved.stats.saved++; saved.place = saved.intent = center.id;
        for (const x of caged()) evacuate(x, out);
      }
      advance(out);
      S.log.push(...out);
      return out;
    }
    function advance(out) {
      if (S.over) return;
      if (inArena().length <= 1 && caged().length === 0) { crown(out); return; }
      S.hour++;
      if (S.hour > (S.day === RULES.days ? RULES.finaleHour : RULES.voteHour)) {
        out.push(ev("night", { text: t("La nuit tombe sur l'arène. {n} candidats encore en lice.", { n: alive().length }) }));
        S.day++; S.hour = RULES.firstHour;
        if (S.day > RULES.days && !S.over) crown(out);
      }
    }
    function drop(id, item) { S.drops[id] = item; }
    function warn(id) { S.warn = id; }
    function snapshot() {
      return {
        day: S.day, hour: S.hour, over: S.over, winner: S.winner, closed: [...S.closed], arena: A,
        traps: S.traps.map((x) => ({ ...x, name: trapKind(x.kind).name })),
        hazards: S.hazards.filter((h) => h.day === S.day && !h.done).map((h) => ({ ...h, name: hzOf(h.hz).name })),
        cast: C.map((x) => ({ id: x.id, name: x.name, stars: x.stars, state: x.state, place: x.place, intent: x.intent, hidden: x.hidden, shield: x.shield, map: x.map, ally: x.ally ? partner(x)?.id : null, rank: x.outRank, stats: { ...x.stats } })),
      };
    }
    function trapAhead(id) {
      const x = byId[id];
      if (!x || x.state !== "in" || x.intent === x.place) return null;
      const tp = S.traps.find((p) => p.place === x.intent && !friendly(byId[p.owner], x));
      return tp ? { ...tp, name: trapKind(tp.kind).name, placeName: pname(tp.place), ownerName: byId[tp.owner].name } : null;
    }
    return { next, answer, drop, warn, trapAhead, snapshot, state: S, cast: C, byId, rules: RULES, arena: A, places: PL, itemName, popularity, autoAnswer: (ask) => (ask.kind === "duel" ? ask.options[0] : null) };
  }

  const api = { cast, create, RULES };
  root.ArenaEngine = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
