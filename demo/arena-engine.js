// The Last - Arena Battle : le moteur de la saison, heure par heure, dans le navigateur.
// 30 candidats, 7 jours au plus, une Garde de 3 étoiles, la Cage du sursis et le vote de 19h qui sauve.
// Tout est déterministe à partir de la graine, sauf les choix du spectateur (duel, vote, caisse).
// Expose window.ArenaEngine = { cast(pool, seed), create(cast, seed) }. Fonctionne aussi dans Node (tests).
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
    const ws = arr.map(w), sum = ws.reduce((a, b) => a + b, 0);
    let x = r() * sum;
    for (let i = 0; i < arr.length; i++) { x -= ws[i]; if (x <= 0) return arr[i]; }
    return arr[arr.length - 1];
  }

  // Réglages (plus tard dans le back-office)
  const RULES = {
    size: 30, voted: 24, days: 7, stars: 3,
    firstHour: 8, lastFight: 18, duelHour: 18, voteHour: 19, finaleHour: 20,
    aliveAfter: [26, 22, 17, 12, 7, 3, 1], // repères de fin de journée
    cageUntil: 5, // la Cage du sursis existe du jour 1 au jour 5
    closeOn: { 2: 0, 4: 1, 6: 2 }, // une zone se ferme ces jours-là
  };
  const SECTORS = 6;
  const WEAPONS = ["foam", "paint", "net", "banana", "potion"];

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

  function create(castList, seed = 7) {
    const r = rng(seed);
    const C = castList.map((c, i) => ({
      id: c.id, name: c.name, c,
      stars: RULES.stars, state: "in", // in | cage | out
      sector: i % SECTORS, item: null, shield: 0, map: false, ally: null,
      stats: { hits: 0, kos: 0, taken: 0, saved: 0 }, outDay: 0, outRank: 0,
    }));
    const byId = Object.fromEntries(C.map((x) => [x.id, x]));
    const tr = (x, k) => x.c.traits?.[k] ?? 50;
    const S = { day: 1, hour: RULES.firstHour, closed: [], alliances: [], over: false, winner: null, log: [], pending: null, drops: {}, duelPick: null };
    const inArena = () => C.filter((x) => x.state === "in");
    const alive = () => C.filter((x) => x.state !== "out");
    const caged = () => C.filter((x) => x.state === "cage");
    const rivalsOf = (x) => (x.c.career?.rivals || []).map((rv) => rv.id).filter((id) => byId[id] && byId[id].state === "in");
    let rank = C.length;

    const ev = (type, data) => ({ type, day: S.day, hour: S.hour, ...data });

    // ---------- coups ----------
    function weaponFor(a) {
      if (a.item && a.item !== "shield" && a.item !== "map") return a.item;
      const cun = tr(a, "cunning"), cou = tr(a, "courage");
      return weighted(r, WEAPONS, (w) => ({ foam: 10 + cou / 4, paint: 14, net: 6 + cun / 6, banana: 6 + cun / 8, potion: 4 + cun / 5 })[w]);
    }
    function knockOut(v, by, out) {
      v.stars = 0;
      if (by) by.stats.kos++;
      if (v.ally) breakAlliance(v.ally, null);
      const toCage = S.day <= RULES.cageUntil;
      if (toCage) { v.state = "cage"; out.push(ev("ko", { v: v.id, by: by?.id, to: "cage", text: t("{v} est hors jeu ! Le drone l'emporte dans la Cage du sursis.", { v: v.name }) })); }
      else evacuate(v, out, by);
    }
    function evacuate(v, out, by) {
      v.state = "out"; v.outDay = S.day; v.outRank = rank--;
      out.push(ev("out", { v: v.id, by: by?.id, rank: v.outRank, text: t("{v} est évacué·e par drone. {n}e place.", { v: v.name, n: v.outRank }) }));
    }
    function hit(a, v, kind, out, dmg = 1) {
      if (v.state !== "in") return;
      if (kind !== "betray" && kind !== "duel" && v.shield > 0) {
        v.shield--;
        out.push(ev("block", { a: a.id, v: v.id, kind, text: t("Le bouclier en mousse de {v} renvoie l'attaque de {a} !", { a: a.name, v: v.name }) }));
        return;
      }
      if ((kind === "net" || kind === "banana") && v.map) {
        out.push(ev("dodge", { a: a.id, v: v.id, kind, text: t("{v} avait la carte des pièges : le piège de {a} reste vide.", { a: a.name, v: v.name }) }));
        return;
      }
      v.stars = Math.max(0, v.stars - dmg);
      a.stats.hits++; v.stats.taken++;
      out.push(ev("hit", { a: a.id, v: v.id, kind, stars: v.stars, text: hitLine(kind, a, v) }));
      if (v.stars === 0) knockOut(v, a, out);
    }
    function hitLine(kind, a, v) {
      const L = {
        foam: [t("BOING ! {a} assomme {v} d'un coup de masse en mousse.", { a: a.name, v: v.name }), t("{a} fait tournoyer son épée en mousse : {v} voit des étoiles.", { a: a.name, v: v.name })],
        paint: [t("SPLAT ! {a} repeint {v} en rose fluo.", { a: a.name, v: v.name }), t("{v} se fait arroser de peinture par {a}. Impossible de se cacher maintenant.", { a: a.name, v: v.name })],
        net: [t("{v} marche sur le filet de {a} et se retrouve suspendu·e la tête en bas.", { a: a.name, v: v.name })],
        banana: [t("{v} glisse sur la peau de banane posée par {a}. Atterrissage en douceur… ou presque.", { a: a.name, v: v.name })],
        potion: [t("{a} offre une boisson à {v}. Potion du fou rire : {v} ne tient plus debout.", { a: a.name, v: v.name }), t("Hic ! La potion de {a} donne un hoquet géant à {v}.", { a: a.name, v: v.name })],
        betray: [t("TRAHISON ! {a} frappe son allié·e {v} dans le dos.", { a: a.name, v: v.name })],
        duel: [t("{a} remporte le duel du soir contre {v} !", { a: a.name, v: v.name })],
        self: [t("{a} tombe dans son propre piège. Le public adore.", { a: a.name, v: v.name })],
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
      const b = weighted(r, others, (x) => 10 + tr(x, "loyalty") + (x.sector === a.sector ? 40 : 0));
      const id = "al" + S.alliances.length;
      S.alliances.push({ id, members: [a.id, b.id], since: S.day });
      a.ally = b.ally = id;
      b.sector = a.sector;
      out.push(ev("ally", { a: a.id, v: b.id, text: t("{a} et {v} topent là : alliance !", { a: a.name, v: b.name }) }));
    }
    function breakAlliance(id) {
      const al = S.alliances.find((x) => x.id === id);
      if (!al) return;
      for (const m of al.members) if (byId[m].ally === id) byId[m].ally = null;
      al.broken = S.day;
    }
    const partner = (x) => { const al = S.alliances.find((a) => a.id === x.ally); return al ? byId[al.members.find((m) => m !== x.id)] : null; };

    // ---------- une heure de jeu ----------
    function targetCage() {
      // combien de candidats doivent finir la journée dans la Cage (ou évacués) pour suivre le rythme
      const goal = RULES.aliveAfter[S.day - 1];
      const extra = S.day <= RULES.cageUntil ? 1 : 0; // un candidat de la Cage sera sauvé
      return Math.max(0, alive().length - goal + extra);
    }
    function koNeeded() {
      if (S.day <= RULES.cageUntil) return Math.max(0, targetCage() - caged().length);
      return Math.max(0, alive().length - RULES.aliveAfter[S.day - 1]);
    }
    function fightHour(out) {
      const arena = inArena();
      if (arena.length < 2) return;
      const need = koNeeded();
      const hoursLeft = RULES.lastFight - S.hour + 1;
      const weakest = [...arena].sort((a, b) => a.stars - b.stars).slice(0, need);
      const starsNeeded = weakest.reduce((s, x) => s + x.stars + x.shield, 0);
      let n = Math.round(starsNeeded / hoursLeft + (r() - 0.35) * 1.2);
      if (S.day === RULES.days) n = 0; // le dernier jour, on garde les forces pour la finale
      n = Math.max(0, Math.min(5, n));
      for (let i = 0; i < n; i++) {
        const pool = inArena();
        if (pool.length < 2) break;
        const v = weighted(r, pool, (x) => (4 - x.stars) * 3 + 1 + (x.c.career?.rivals?.length ? 0.5 : 0));
        const p = partner(v);
        // trahison : à partir du jour 3, un allié peu loyal peut frapper
        if (p && p.state === "in" && S.day >= 3 && r() < 0.12 + (100 - tr(p, "loyalty")) / 400) {
          breakAlliance(v.ally);
          hit(p, v, "betray", out, 2);
          continue;
        }
        const attackers = pool.filter((x) => x !== v && x !== p);
        if (!attackers.length) break;
        const a = weighted(r, attackers, (x) => 6 + tr(x, "courage") / 10 + tr(x, "cunning") / 12 + (rivalsOf(v).includes(x.id) ? 10 : 0) + x.stars);
        if (r() < 0.06) { // le gag : on tombe dans son propre piège
          a.stars = Math.max(0, a.stars - 1);
          out.push(ev("hit", { a: a.id, v: a.id, kind: "self", stars: a.stars, text: hitLine("self", a, a) }));
          if (a.stars === 0) knockOut(a, null, out);
          continue;
        }
        hit(a, v, weaponFor(a), out);
      }
    }
    function lootHour(out) {
      // les caisses du cœur de l'arène
      const n = S.day === 1 && S.hour === RULES.firstHour ? 6 : r() < 0.35 ? 1 : 0;
      for (let i = 0; i < n; i++) {
        const pool = inArena().filter((x) => !x.item);
        if (!pool.length) break;
        const x = weighted(r, pool, (y) => 5 + tr(y, "courage") / 8);
        const item = pickOne(r, ["foam", "paint", "net", "potion", "shield", "shield", "map"]);
        x.item = item;
        if (item === "shield") x.shield = Math.min(2, x.shield + 1);
        if (item === "map") x.map = true;
        out.push(ev("loot", { a: x.id, item, text: t("{a} ramasse {item} dans une caisse du cœur.", { a: x.name, item: itemName(item) }) }));
      }
    }
    const itemName = (it) => ({ foam: t("une masse en mousse"), paint: t("un lance-peinture"), net: t("un filet piégé"), potion: t("une potion douteuse"), shield: t("un bouclier en mousse"), map: t("la carte des pièges"), star: t("une étoile de Garde") })[it];

    function closeZone(out) {
      const k = RULES.closeOn[S.day];
      if (k === undefined || S.hour !== 12) return;
      const open = [...Array(SECTORS).keys()].filter((s) => !S.closed.includes(s));
      const s = pickOne(r, open);
      S.closed.push(s);
      const free = open.filter((x) => x !== s);
      for (const x of C) if (x.sector === s) x.sector = pickOne(r, free);
      out.push(ev("zone", { sector: s, text: t("Alerte ! Le brouillard qui fait éternuer envahit la zone {z}. Tout le monde dehors !", { z: zoneName(s) }) }));
    }
    const zoneName = (s) => [t("des Forges"), t("des Colonnes"), t("du Labyrinthe"), t("des Rampes"), t("des Tonneaux"), t("du Pont")][s];

    function wander() {
      const open = [...Array(SECTORS).keys()].filter((s) => !S.closed.includes(s));
      for (const x of inArena()) if (r() < 0.25) x.sector = pickOne(r, open);
      for (const al of S.alliances) if (!al.broken) { const [a, b] = al.members.map((m) => byId[m]); if (a.state === "in" && b.state === "in") b.sector = a.sector; }
    }

    function duelOptions() {
      const pool = inArena();
      if (pool.length < 2) return [];
      const opts = [], used = new Set();
      // d'abord des rivaux qui ont un compte à régler (carrière commune)
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
      const pa = tr(a, "courage") + tr(a, "composure") + a.stars * 25 + r() * 120;
      const pb = tr(b, "courage") + tr(b, "composure") + b.stars * 25 + r() * 120;
      const [w, l] = pa >= pb ? [a, b] : [b, a];
      out.push(ev("duelStart", { a: a.id, v: b.id, text: t("Duel du soir au centre de l'arène : {a} contre {v} !", { a: a.name, v: b.name }) }));
      hit(w, l, "duel", out);
    }

    function forceKos(out) {
      // rattrapage de fin de journée : le moteur garde le rythme d'une saison de 7 jours
      let guard = 40;
      while (koNeeded() > 0 && inArena().length > 1 && guard--) {
        const pool = inArena();
        const v = [...pool].sort((a, b) => a.stars - b.stars || r() - 0.5)[0];
        const a = weighted(r, pool.filter((x) => x !== v), (x) => 5 + x.stars);
        v.shield = 0;
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
      out.push(ev("finale", { ids: inArena().map((x) => x.id), text: t("C'est l'heure de la grande finale ! Plus de Cage, plus de sursis : le dernier debout gagne The Last - Arena Battle.") }));
      for (const x of inArena()) { x.shield = 0; x.stars = Math.max(1, x.stars); }
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
      out.push(ev("win", { a: w.id, text: t("{a} est le dernier debout ! Vainqueur de The Last - Arena Battle.", { a: w.name }) }));
    }

    // ---------- API ----------
    // next() renvoie l'heure suivante : { day, hour, events, ask? }. Si ask existe, appeler answer(valeur).
    function next() {
      if (S.over) return null;
      if (S.pending) throw new Error("answer() attendu");
      const out = [];
      const { day, hour } = S;
      if (day === 1 && hour === RULES.firstHour) out.push(ev("enter", { text: t("Les 30 candidats entrent dans le Colisée d'acier. Les caisses du cœur s'ouvrent : c'est parti !") }));
      if (hour === RULES.firstHour && day > 1) {
        // le matin : les rescapés de la Cage reviennent, les caisses du public tombent
        for (const x of C) x.map = false; // la carte des pièges ne vaut que pour une journée
      }
      // caisse parachutée par le spectateur
      for (const [id, item] of Object.entries(S.drops)) {
        const x = byId[id];
        if (x && x.state === "in") {
          if (item === "star") x.stars = Math.min(RULES.stars, x.stars + 1);
          if (item === "shield") x.shield = Math.min(2, x.shield + 1);
          if (item === "map") x.map = true;
          out.push(ev("drop", { a: x.id, item, stars: x.stars, text: t("Une caisse tombe du ciel pour {a} : {item} !", { a: x.name, item: itemName(item) }) }));
        }
      }
      S.drops = {};

      if (hour <= RULES.lastFight) {
        wander();
        if (S.day <= 2 && r() < 0.5) formAlliance(out);
        closeZone(out);
        lootHour(out);
        if (hour < RULES.duelHour) fightHour(out);
      }
      let ask = null;
      if (hour === RULES.duelHour && inArena().length > 2 && day < RULES.days) {
        const options = duelOptions();
        if (options.length) { ask = { kind: "duel", options }; }
        else forceKos(out);
      } else if (hour === RULES.voteHour) {
        if (day <= RULES.cageUntil && caged().length) {
          if (caged().length === 1) { out.push(ev("note", { text: t("Un seul candidat dans la Cage ce soir : le public le sauve d'office.") })); const x = caged()[0]; x.state = "in"; x.stars = 1; x.stats.saved++; }
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
        saved.state = "in"; saved.stars = 1; saved.stats.saved++;
        for (const x of caged()) evacuate(x, out);
      }
      advance(out);
      S.log.push(...out);
      return out;
    }
    function advance(out) {
      if (S.over) return;
      if (inArena().length <= 1 && caged().length === 0 && !S.over) { crown(out); return; }
      S.hour++;
      if (S.hour > (S.day === RULES.days ? RULES.finaleHour : RULES.voteHour)) {
        out.push(ev("night", { text: t("La nuit tombe sur l'arène. {n} candidats encore en lice.", { n: alive().length }) }));
        S.day++; S.hour = RULES.firstHour;
        if (S.day > RULES.days && !S.over) crown(out);
      }
    }
    function drop(id, item) { S.drops[id] = item; }
    function snapshot() {
      return {
        day: S.day, hour: S.hour, over: S.over, winner: S.winner, closed: [...S.closed],
        cast: C.map((x) => ({ id: x.id, name: x.name, stars: x.stars, state: x.state, sector: x.sector, shield: x.shield, ally: x.ally ? partner(x)?.id : null, rank: x.outRank, stats: { ...x.stats } })),
      };
    }
    return { next, answer, drop, snapshot, state: S, cast: C, byId, rules: RULES, sectors: SECTORS, zoneName, itemName, popularity, autoAnswer: (ask) => (ask.kind === "duel" ? ask.options[0] : null) };
  }

  const api = { cast, create, RULES };
  root.ArenaEngine = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
