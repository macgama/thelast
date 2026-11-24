// The Last - Chasse au trésor « La Carte déchirée » : le moteur de la saison, heure par heure, dans le navigateur.
// 24 candidats en solo, 7 jours dans la vallée d'Itzaluna. Chaque jour : une zone, une énigme, un morceau de carte,
// des médaillons de jade (sans médaillon à 19h = menacé à l'Heure du gardien, le vote du public en sauve un).
// Le prime du jour 7 : le coffre à 7 serrures au sommet du temple du Soleil.
// Tout est déterministe à partir de la graine, sauf les choix du spectateur (souffle, vote).
// Expose window.TresorEngine = { cast(pool, seed), create(cast, seed), riddle(day, seed), RULES }. Fonctionne aussi dans Node (tests).
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
  function shuffle(r, arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // Réglages (plus tard dans le back-office)
  const RULES = {
    size: 24, voted: 20, days: 7,
    firstHour: 8, lastHour: 18, voteHour: 19, finaleHour: 20,
    hintHours: [12, 15],
    aliveAfter: { 2: 20, 3: 16, 4: 12, 5: 8, 6: 5 }, // repères de fin de journée (le jour 1 est un soir de grâce)
    cursedPiece: 3,
  };
  // les 7 zones, une par jour, et la compétence qui y aide
  const ZONES = [
    { key: "beach", skill: "foraging" },
    { key: "canopy", skill: "climbing" },
    { key: "jaguar", skill: "tracking" },
    { key: "falls", skill: "swimming" },
    { key: "swamp", skill: "orientation" },
    { key: "cenote", skill: "swimming" },
    { key: "sun", skill: "endurance" },
  ];
  const zoneName = (i) => [t("la plage du fleuve"), t("la canopée"), t("le temple du Jaguar"), t("les cascades"), t("le marais des brumes"), t("le cénote"), t("le temple du Soleil")][i];

  // ---------- les énigmes (visuelles : elles marchent pareil en français et en anglais) ----------
  const G = ["🐆", "🐍", "🦅", "🐒", "🦜", "🐸", "🌞", "🌙", "💎", "🔥"];
  function riddle(day, seed) {
    const r = rng(seed * 131 + day * 7919);
    const kind = ["sequence", "count", "balance", "mirror", "path", "odd", "code"][day - 1];
    const R = { day, kind };
    if (kind === "sequence") {
      const [a, b, c] = shuffle(r, G).slice(0, 3);
      const pat = pickOne(r, [[a, b], [a, b, c], [a, a, b], [a, b, b, c]]);
      const seq = Array.from({ length: pat.length * 2 + 1 }, (_, i) => pat[i % pat.length]);
      const ans = seq.pop();
      R.seq = seq;
      R.options = shuffle(r, [ans, ...shuffle(r, G.filter((g) => g !== ans)).slice(0, 3)]);
      R.answer = R.options.indexOf(ans);
    } else if (kind === "count") {
      const target = "🐒", decoys = ["🦜", "🍌", "🌿", "🐸"];
      const n = 7 + Math.floor(r() * 6);
      const cells = shuffle(r, [...Array(n).fill(target), ...Array.from({ length: 36 - n }, () => pickOne(r, decoys))]);
      R.grid = cells; R.target = target;
      R.options = shuffle(r, [n, n - 1, n + 1, n + 2]);
      R.answer = R.options.indexOf(n);
    } else if (kind === "balance") {
      const [A, B, C] = shuffle(r, ["🐆", "🐍", "🦅", "🐸"]).slice(0, 3);
      const a = 2 + Math.floor(r() * 5), c = 1 + Math.floor(r() * 6), b = a * 2;
      R.lines = [[A, "+", A, "=", B], [B, "+", C, "=", String(b + c)], [C, "=", String(c)]];
      R.ask = A;
      R.options = shuffle(r, [a, a + 1, a - 1, b]).map(String);
      R.answer = R.options.indexOf(String(a));
    } else if (kind === "mirror") {
      const ARR = ["←", "→", "↑", "↓", "↖", "↗"];
      const FLIP = { "←": "→", "→": "←", "↑": "↑", "↓": "↓", "↖": "↗", "↗": "↖" };
      let src;
      let mirror;
      do {
        src = Array.from({ length: 4 }, () => pickOne(r, ARR));
        mirror = [...src].reverse().map((x) => FLIP[x]);
      } while (new Set(src).size < 3 || mirror.join() === src.join() || mirror.join() === [...src].reverse().join() || mirror.join() === src.map((x) => FLIP[x]).join());
      const M = mirror.join(" ");
      const uniq = [M];
      for (const c of [[...src].reverse(), src.map((x) => FLIP[x]), [...mirror.slice(1), mirror[0]], [mirror[1], mirror[0], ...mirror.slice(2)]]) {
        const s2 = c.join(" ");
        if (!uniq.includes(s2) && uniq.length < 4) uniq.push(s2);
      }
      while (uniq.length < 4) { const s2 = shuffle(r, mirror).join(" "); if (!uniq.includes(s2)) uniq.push(s2); }
      R.src = src.join(" ");
      R.options = shuffle(r, uniq);
      R.answer = R.options.indexOf(M);
    } else if (kind === "path") {
      const N = 5, glyphs = ["🐸", "🌿", "💎", "🔥", "🦜", "🌙"];
      const grid = Array.from({ length: N * N }, () => pickOne(r, glyphs));
      let pos = [2, 2];
      const moves = [];
      const D = { "↑": [-1, 0], "↓": [1, 0], "←": [0, -1], "→": [0, 1] };
      while (moves.length < 6) {
        const m = pickOne(r, Object.keys(D));
        const np = [pos[0] + D[m][0], pos[1] + D[m][1]];
        if (np[0] < 0 || np[1] < 0 || np[0] >= N || np[1] >= N) continue;
        if (np[0] === 2 && np[1] === 2) continue;
        moves.push(m); pos = np;
      }
      grid[2 * N + 2] = "⭐";
      const ans = grid[pos[0] * N + pos[1]];
      R.grid = grid; R.size = N; R.moves = moves;
      R.options = shuffle(r, [ans, ...shuffle(r, glyphs.filter((g) => g !== ans)).slice(0, 3)]);
      R.answer = R.options.indexOf(ans);
    } else if (kind === "odd") {
      const tri = shuffle(r, ["🐆", "🐍", "🦅", "🐸"]).slice(0, 3);
      const rot = (k) => [tri[k % 3], tri[(k + 1) % 3], tri[(k + 2) % 3]].join("");
      const odd = [tri[0], tri[2], tri[1]].join("");
      R.options = shuffle(r, [rot(0), rot(1), rot(2), rot(0), rot(1), odd]);
      R.answer = R.options.indexOf(odd);
    } else {
      const key = shuffle(r, ["🐆", "🐍", "🦅", "🌞", "🌙"]).slice(0, 4).map((g, i) => [g, ((i * 3 + Math.floor(r() * 3)) % 9) + 1]);
      const order = shuffle(r, [0, 1, 2, 3]);
      R.key = key; R.lock = order.map((i) => key[i][0]);
      const code = order.map((i) => key[i][1]).join("");
      const swap = (s, i, j) => { const a = s.split(""); [a[i], a[j]] = [a[j], a[i]]; return a.join(""); };
      const cands = [...new Set([code, swap(code, 0, 1), swap(code, 2, 3), [...code].reverse().join(""), swap(code, 1, 2)])].filter((x, i, a) => a.indexOf(x) === i);
      R.options = shuffle(r, cands.slice(0, 4));
      R.answer = R.options.indexOf(code);
    }
    R.hints = HINTS[kind];
    return R;
  }
  const HINTS = {
    sequence: ["Les symboles se répètent toujours dans le même ordre.", "Repère le motif du début, puis continue-le."],
    count: ["Compte ligne par ligne, de gauche à droite.", "Il y a entre 7 et 12 singes."],
    balance: ["Commence par la dernière ligne : elle donne directement une valeur.", "Deux fois le premier symbole valent le deuxième."],
    mirror: ["Dans un miroir, la gauche devient la droite.", "L'ordre s'inverse ET chaque flèche gauche/droite se retourne."],
    path: ["Pars de l'étoile, au centre de la grille.", "Une flèche = une case. Suis-les dans l'ordre."],
    odd: ["Cinq dalles portent les mêmes animaux, dans le même ordre, en tournant.", "Lis chaque dalle comme un cercle : une seule tourne dans l'autre sens."],
    code: ["Chaque symbole de la serrure vaut le chiffre gravé à côté de lui.", "Lis la serrure de gauche à droite."],
  };

  // Casting : 20 personnages choisis par le public (simulé), 4 repêchés par la production parmi les moins vus
  function cast(pool, seed = 7) {
    const r = rng(seed * 977 + 29);
    const scored = pool.map((c) => ({ c, s: (c.career?.xp || 0) + (c.career?.wins || 0) * 120 + r() * 240 }));
    scored.sort((a, b) => b.s - a.s);
    const voted = scored.slice(0, RULES.voted).map((x) => ({ ...x.c, pick: "public", votes: Math.round(700 + x.s * 9) }));
    const rest = scored.slice(RULES.voted).map((x) => x.c);
    const fewest = Math.min(...rest.map((c) => c.career?.played?.length || 0));
    const shy = rest.filter((c) => (c.career?.played?.length || 0) <= fewest + 1);
    const prod = [];
    while (prod.length < RULES.size - RULES.voted && shy.length) prod.push({ ...shy.splice(Math.floor(r() * shy.length), 1)[0], pick: "prod" });
    return [...voted, ...prod].sort((a, b) => a.id.localeCompare(b.id));
  }

  function create(castList, seed = 7) {
    const r = rng(seed);
    const C = castList.map((c) => ({
      id: c.id, name: c.name, c, state: "in",
      medal: false, pieces: [], copies: [], pact: null,
      stats: { medals: 0, pieces: 0, steals: 0, traps: 0, saved: 0 }, outDay: 0, outRank: 0,
    }));
    const byId = Object.fromEntries(C.map((x) => [x.id, x]));
    const tr = (x, k) => x.c.traits?.[k] ?? 50;
    const has = (x, sk) => (x.c.skills || []).includes(sk);
    const S = {
      day: 1, hour: RULES.firstHour, over: false, winner: null, log: [], pending: null,
      riddle: null, solved: false, solvedBy: null, whisper: null, medalsLeft: 0, accidentToday: false,
      pieces: Array.from({ length: 8 }, () => null), // pieces[1..7] = id du porteur
      threatened: [], finalists: [],
    };
    const inGame = () => C.filter((x) => x.state === "in");
    const zone = () => ZONES[S.day - 1];
    const zoneBonus = (x) => (has(x, zone().skill) ? 30 : 0);
    let rank = C.length;
    const ev = (type, data) => ({ type, day: S.day, hour: S.hour, ...data });
    const holderOf = (n) => (S.pieces[n] ? byId[S.pieces[n]] : null);
    const cursed = (x) => x.pieces.includes(RULES.cursedPiece);
    const needTonight = () => (RULES.aliveAfter[S.day] ? Math.max(0, inGame().length - RULES.aliveAfter[S.day]) : 0);

    // ---------- morceaux de carte ----------
    function givePiece(n, x, out, how) {
      const prev = holderOf(n);
      if (prev) prev.pieces = prev.pieces.filter((p) => p !== n);
      S.pieces[n] = x.id;
      x.pieces.push(n); x.stats.pieces++;
      x.copies = x.copies.filter((cp) => cp.n !== n);
      const L = {
        solve: t("{a} déchiffre l'énigme et trouve le morceau de carte n°{n} !", { a: x.name, n }),
        toucan: t("Grâce au souffle du public, {a} file droit vers la cachette : morceau de carte n°{n} !", { a: x.name, n }),
        orphan: t("{a} récupère le morceau n°{n}, abandonné près du feu de camp.", { a: x.name, n }),
        steal: "",
      };
      if (how !== "steal") out.push(ev("piece", { a: x.id, n, how, text: L[how] }));
      if (n === RULES.cursedPiece && how !== "steal") out.push(ev("curse", { a: x.id, kind: "start", text: t("Un grondement sort du temple : ce morceau est maudit. {a} va attirer les ennuis…", { a: x.name }) }));
    }
    function dropPieces(x, out) {
      for (const n of [...x.pieces]) {
        const pool = inGame().filter((y) => y !== x);
        if (!pool.length) { S.pieces[n] = null; continue; }
        const y = weighted(r, pool, (z) => 10 + tr(z, "cunning") / 5 + (has(z, "stealth") ? 10 : 0));
        givePiece(n, y, out, "orphan");
      }
      x.pieces = [];
    }

    // ---------- évacuation ----------
    function evacuate(x, out, cause) {
      x.state = "out"; x.outDay = S.day; x.outRank = rank--; x.medal = false;
      if (x.pact) { const p = byId[x.pact]; if (p) p.pact = null; x.pact = null; }
      out.push(ev("out", { v: x.id, rank: x.outRank, cause, text: cause === "accident" ? t("{v} est hors jeu : le drone l'évacue vers l'infirmerie. {n}e place.", { v: x.name, n: x.outRank }) : t("{v} est évacué·e par drone. {n}e place.", { v: x.name, n: x.outRank }) }));
      dropPieces(x, out);
    }

    // ---------- pièges (version cartoon) ----------
    const TRAPS = ["mud", "liana", "smoke", "ants", "caiman", "bats", "rain", "door"];
    function trapLine(k, x) {
      return {
        mud: t("Une dalle bascule sous les pieds de {a}. SPLOUCH ! Bain de boue.", { a: x.name }),
        liana: t("{a} tire sur une liane… et se fait catapulter dans la rivière.", { a: x.name }),
        smoke: t("Une statue crache une fumée violette au nez de {a}. Une heure d'éternuements.", { a: x.name }),
        ants: t("{a} s'assoit sur une fourmilière. Les fourmis rouges l'obligent à danser.", { a: x.name }),
        caiman: t("Un caïman paresseux attrape la sacoche de {a} et plonge avec.", { a: x.name }),
        bats: t("Une nuée de chauves-souris décoiffe {a} dans un couloir du temple.", { a: x.name }),
        rain: t("Une averse tropicale trempe {a} jusqu'aux os.", { a: x.name }),
        door: t("{a} prend une fausse porte et tourne en rond dans le labyrinthe.", { a: x.name }),
      }[k];
    }
    function trapHour(out) {
      if (r() > 0.5) return;
      const pool = inGame();
      if (!pool.length) return;
      const x = weighted(r, pool, (y) => 12 - (has(y, "tracking") ? 4 : 0) + (cursed(y) ? 14 : 0) + (100 - tr(y, "composure")) / 20);
      const k = pickOne(r, S.day === 3 ? ["mud", "smoke", "bats", "door", "mud"] : S.day === 5 ? ["mud", "caiman", "rain", "ants"] : TRAPS);
      x.stats.traps++;
      const e = ev("trap", { a: x.id, kind: k, text: trapLine(k, x) });
      out.push(e);
      if (k === "caiman" && x.medal) { x.medal = false; S.medalsLeft++; e.lost = "medal"; e.text += " " + t("Le médaillon de jade est au fond de l'eau !"); }
      if (k === "rain" && x.copies.length) { x.copies.pop(); e.lost = "copy"; e.text += " " + t("Sa copie de carte n'est plus qu'une tache d'encre."); }
      // un accident au plus par jour, jamais le jour du prime
      if (!S.accidentToday && S.day < RULES.days && S.day > 1 && r() < 0.18 && inGame().length > (RULES.aliveAfter[S.day] || 1) + 1) {
        S.accidentToday = true;
        out.push(ev("note", { a: x.id, text: t("{a} se tord la cheville en tombant. Le médecin de l'émission arrête les frais.", { a: x.name }) }));
        evacuate(x, out, "accident");
      }
    }

    // ---------- médaillons de jade ----------
    function medalHour(out) {
      const hoursLeft = RULES.lastHour - S.hour; // la dernière heure est réservée aux « in extremis »
      if (S.medalsLeft <= 0 || hoursLeft <= 0) return;
      let k = Math.round(S.medalsLeft / hoursLeft + (r() - 0.4) * 1.4);
      k = Math.max(0, Math.min(S.medalsLeft, k, 4));
      const found = [];
      for (let i = 0; i < k; i++) {
        const pool = inGame().filter((x) => !x.medal);
        if (!pool.length) break;
        const x = weighted(r, pool, (y) => 10 + (has(y, "tracking") ? 12 : 0) + zoneBonus(y) / 2 + tr(y, "courage") / 12);
        x.medal = true; x.stats.medals++; S.medalsLeft--;
        found.push(x);
      }
      if (!found.length) return;
      const names = found.map((x) => x.name).join(", ");
      out.push(ev("medal", { a: found[0].id, ids: found.map((x) => x.id), text: found.length === 1
        ? pickOne(r, [t("{a} trouve un médaillon de jade sous une racine.", { a: names }), t("{a} déniche un médaillon de jade dans un vieux pot de terre.", { a: names }), t("Un éclat vert entre deux pierres : {a} empoche un médaillon de jade.", { a: names })])
        : t("Médaillons de jade trouvés par {list}. Encore {n} cachés dans la zone.", { list: names, n: S.medalsLeft }) }));
    }

    // ---------- pactes, malédiction ----------
    function pactHour(out) {
      if (S.day > 3 || r() > 0.3) return;
      const free = inGame().filter((x) => !x.pact);
      if (free.length < 2) return;
      const a = weighted(r, free, (x) => 10 + tr(x, "empathy") / 5 + (has(x, "negotiation") ? 10 : 0));
      const rivals = (a.c.career?.rivals || []).map((x) => x.id);
      const others = free.filter((x) => x !== a && !rivals.includes(x.id));
      if (!others.length) return;
      const b = weighted(r, others, (x) => 10 + tr(x, "loyalty") / 4);
      a.pact = b.id; b.pact = a.id;
      out.push(ev("pact", { a: a.id, v: b.id, text: t("{a} et {v} concluent un pacte : on partage tout ce qu'on trouve. En théorie.", { a: a.name, v: b.name }) }));
    }
    function curseHour(out) {
      const x = holderOf(RULES.cursedPiece);
      if (!x || x.state !== "in" || r() > 0.35) return;
      const k = pickOne(r, ["monkeys", "parrot", "storm"]);
      const e = ev("curse", { a: x.id, kind: k, text: {
        monkeys: t("La malédiction frappe : une bande de singes suit {a} partout et lui vole son chapeau.", { a: x.name }),
        parrot: t("La malédiction frappe : un perroquet crie « {a} est là ! » à toute la vallée.", { a: x.name }),
        storm: t("La malédiction frappe : un petit nuage d'orage ne lâche plus {a}.", { a: x.name }),
      }[k] });
      out.push(e);
      if (k === "monkeys" && x.medal && r() < 0.5) { x.medal = false; S.medalsLeft++; e.text += " " + t("Et son médaillon de jade avec."); e.lost = "medal"; }
    }

    // ---------- l'énigme du jour ----------
    function solveHour(out) {
      if (S.solved) return;
      if (S.whisper) {
        const x = byId[S.whisper];
        S.whisper = null;
        if (x && x.state === "in") {
          out.push(ev("toucan", { a: x.id, text: t("Un toucan se pose sur l'épaule de {a} et lui glisse un message : la réponse du public !", { a: x.name }) }));
          S.solved = true; S.solvedBy = x.id;
          givePiece(S.day, x, out, "toucan");
          return;
        }
      }
      if (S.hour < S.riddle.solveHour) return;
      const pool = inGame();
      if (!pool.length) return;
      const x = weighted(r, pool, (y) => 8 + tr(y, "cunning") / 6 + zoneBonus(y) + (y.pieces.length ? 4 : 0));
      S.solved = true; S.solvedBy = x.id;
      givePiece(S.day, x, out, "solve");
    }

    // ---------- 18h : les derniers médaillons, et qui sera menacé ----------
    function settle(out) {
      if (!RULES.aliveAfter[S.day]) return;
      const need = needTonight();
      const want = need > 0 ? need + 1 : 0;
      const safeToday = S.pieces[S.day];
      const threatened = () => inGame().filter((x) => !x.medal && x.id !== safeToday);
      let guard = 40;
      while (threatened().length > want && guard--) {
        const x = weighted(r, threatened(), (y) => 10 + tr(y, "composure") / 6);
        x.medal = true; x.stats.medals++;
        out.push(ev("medal", { a: x.id, ids: [x.id], late: true, text: t("In extremis ! {a} trouve un médaillon de jade à la dernière minute.", { a: x.name }) }));
      }
      while (threatened().length < want && guard--) {
        const pool = inGame().filter((x) => x.medal && x.id !== safeToday);
        if (!pool.length) break;
        const x = weighted(r, pool, (y) => 10 + (cursed(y) ? 20 : 0) + (100 - tr(y, "composure")) / 8);
        const thieves = inGame().filter((y) => y !== x && !y.medal && y.id !== x.pact);
        x.medal = false;
        if (thieves.length && r() < 0.6) {
          const th = weighted(r, thieves, (y) => 8 + (has(y, "stealth") ? 14 : 0) + tr(y, "cunning") / 8);
          th.medal = true; th.stats.steals++;
          out.push(ev("steal", { a: th.id, v: x.id, what: "medal", text: t("Coup de théâtre : {a} subtilise le médaillon de {v} sans se faire voir.", { a: th.name, v: x.name }) }));
        } else {
          out.push(ev("trap", { a: x.id, kind: "monkey", text: t("Un singe chapardeur arrache le médaillon de jade de {a} et disparaît dans les arbres !", { a: x.name }) }));
        }
      }
    }

    // ---------- 19h : l'Heure du gardien ----------
    function guardianHour(out) {
      if (S.day === 1) {
        out.push(ev("note", { text: t("Premier soir dans la vallée : le gardien est clément, personne n'est menacé ce soir.") }));
        return null;
      }
      if (!RULES.aliveAfter[S.day]) return null;
      const safeToday = S.pieces[S.day];
      const th = needTonight() > 0 ? inGame().filter((x) => !x.medal && x.id !== safeToday) : [];
      S.threatened = th.map((x) => x.id);
      if (!th.length) { out.push(ev("note", { text: t("Ce soir, tout le monde a son médaillon : personne n'est menacé.") })); return null; }
      out.push(ev("guardian", { ids: S.threatened, text: t("L'Heure du gardien : {list} n'ont pas de médaillon de jade. Le public va en sauver un.", { list: th.map((x) => x.name).join(", ") }) }));
      if (th.length === 1) { const x = th[0]; out.push(ev("note", { text: t("Un seul menacé : le public le sauve d'office.") })); x.stats.saved++; return null; }
      return { kind: "vote", ids: [...S.threatened] };
    }
    function popularity(x) {
      return 1 + (x.c.career?.xp || 0) / 150 + x.stats.pieces * 0.6 + x.stats.medals * 0.1 + (x.c.pick === "public" ? 0.5 : 0);
    }
    function voteResult(choice, ids) {
      const xs = ids.map((id) => byId[id]);
      const raw = xs.map((x) => popularity(x) * (0.7 + r() * 0.6) + (x.id === choice ? 3 : 0));
      const sum = raw.reduce((a, b) => a + b, 0);
      const pct = xs.map((x, i) => ({ id: x.id, pct: Math.round((raw[i] / sum) * 100) }));
      pct.sort((a, b) => b.pct - a.pct);
      return pct;
    }

    // ---------- la nuit : vols et copies de carte ----------
    function night(out) {
      for (const x of inGame()) x.medal = false; // les médaillons ne servent qu'une fois
      const holders = inGame().filter((x) => x.pieces.length);
      for (const h of holders) {
        if (r() > 0.3) continue;
        const thieves = inGame().filter((y) => y !== h && y.id !== h.pact);
        if (!thieves.length) continue;
        const th = weighted(r, thieves, (y) => 6 + (has(y, "stealth") ? 16 : 0) + tr(y, "cunning") / 6 - tr(y, "loyalty") / 20);
        const n = pickOne(r, h.pieces);
        if (r() < 0.45 + (has(th, "stealth") ? 0.2 : 0) - (has(h, "tracking") ? 0.15 : 0)) {
          givePiece(n, th, out, "steal");
          th.stats.steals++;
          out.push(ev("steal", { a: th.id, v: h.id, what: "piece", n, text: t("Dans la nuit, {a} vole le morceau de carte n°{n} de {v} !", { a: th.name, v: h.name, n }) }));
        } else {
          out.push(ev("caught", { a: th.id, v: h.id, text: t("{v} se réveille juste à temps : {a} avait la main dans son sac.", { a: th.name, v: h.name }) }));
        }
      }
      // copies : les pactes partagent, les négociateurs achètent… et certains mentent
      for (const h of inGame().filter((x) => x.pieces.length)) {
        const n = pickOne(r, h.pieces);
        let buyer = h.pact ? byId[h.pact] : null;
        if (!buyer || buyer.state !== "in" || buyer.copies.some((c) => c.n === n) || buyer.pieces.includes(n)) {
          if (r() > 0.25) continue;
          const pool = inGame().filter((y) => y !== h && !y.pieces.includes(n) && !y.copies.some((c) => c.n === n));
          if (!pool.length) continue;
          buyer = weighted(r, pool, (y) => 6 + (has(y, "negotiation") ? 14 : 0));
        }
        const liar = (h.pact === buyer.id ? tr(h, "loyalty") < 35 : tr(h, "cunning") > 65) && r() < 0.6;
        buyer.copies.push({ n, ok: !liar });
        out.push(ev("copy", { a: buyer.id, v: h.id, n, fake: liar, text: h.pact === buyer.id ? t("Au coin du feu, {v} laisse son allié·e {a} recopier le morceau n°{n}.", { a: buyer.name, v: h.name, n }) : t("{a} négocie avec {v} : une copie du morceau n°{n} contre la promesse d'un médaillon.", { a: buyer.name, v: h.name, n }) }));
      }
      out.push(ev("night", { text: t("La nuit tombe sur Itzaluna. {n} candidats encore en lice.", { n: inGame().length }) }));
    }

    // ---------- le prime ----------
    function finaleDay(out) {
      if (S.hour < 10 || S.hour > RULES.lastHour) return;
      if (r() < 0.45) {
        const pool = inGame();
        if (pool.length >= 2) {
          const a = weighted(r, pool, (x) => 6 + (has(x, "negotiation") ? 12 : 0));
          const b = pickOne(r, pool.filter((x) => x !== a));
          const n = b.pieces.find((p) => !a.pieces.includes(p) && !a.copies.some((c) => c.n === p));
          if (n) {
            const liar = tr(b, "cunning") > 60 && r() < 0.5;
            a.copies.push({ n, ok: !liar });
            out.push(ev("copy", { a: a.id, v: b.id, n, fake: liar, text: t("Sur les marches du temple, {a} obtient de {v} une copie du morceau n°{n}.", { a: a.name, v: b.name, n }) }));
          }
        }
      }
    }
    function finale(out) {
      const F = inGame();
      S.finalists = F.map((x) => x.id);
      out.push(ev("finale", { ids: S.finalists, text: t("Le prime commence ! Les finalistes s'élancent vers le coffre au sommet du temple du Soleil. Sept serrures, une par morceau de carte.") }));
      const score = {};
      for (const x of F) {
        const good = x.copies.filter((c) => c.ok).length, fake = x.copies.filter((c) => !c.ok).length;
        score[x.id] = x.pieces.length * 3 + (x.pieces.includes(7) ? 3 : 0) + good * 2 - fake + (has(x, "endurance") ? 1.5 : 0) + (has(x, "climbing") ? 1 : 0) + tr(x, "composure") / 50 + r() * 3;
        const locks = Math.min(7, x.pieces.length + good);
        out.push(ev("lock", { a: x.id, locks, text: t("{a} arrive au coffre avec {p} morceau(x) et {c} copie(s) : {l} serrure(s) sur 7.", { a: x.name, p: x.pieces.length, c: x.copies.length, l: locks }) }));
        if (fake) out.push(ev("fake", { a: x.id, text: t("Catastrophe pour {a} : une de ses copies était fausse ! La serrure refuse de tourner.", { a: x.name }) }));
      }
      const order = [...F].sort((a, b) => score[b.id] - score[a.id]);
      for (let i = order.length - 1; i >= 1; i--) {
        const x = order[i];
        x.state = "out"; x.outRank = i + 1; x.outDay = S.day;
        out.push(ev("out", { v: x.id, rank: x.outRank, cause: "finale", text: t("{v} n'ouvre pas le coffre à temps. {n}e place.", { v: x.name, n: x.outRank }) }));
      }
      crown(order[0], out);
    }
    function crown(w, out) {
      S.over = true; S.winner = w.id; w.outRank = 1;
      out.push(ev("win", { a: w.id, text: t("{a} tourne la dernière serrure : le coffre s'ouvre ! Vainqueur de The Last - Chasse au trésor.", { a: w.name }) }));
    }

    // ---------- API ----------
    // next() renvoie l'heure suivante : { day, hour, events, ask? }. Si ask existe, appeler answer(valeur).
    function next() {
      if (S.over) return null;
      if (S.pending) throw new Error("answer() attendu");
      const out = [];
      const { day, hour } = S;
      if (hour === RULES.firstHour) {
        if (day === 1) out.push(ev("enter", { text: t("Les 24 candidats débarquent en pirogue sur la plage d'Itzaluna. Quelque part dans la vallée, une carte déchirée en 7 morceaux mène au trésor.") }));
        S.riddle = riddle(day, seed);
        S.riddle.solveHour = day === 1 ? 10 + Math.floor(r() * 3) : 11 + Math.floor(r() * 7);
        S.solved = false; S.solvedBy = null; S.whisper = null; S.accidentToday = false; S.threatened = [];
        const need = needTonight();
        S.medalsLeft = day === RULES.days ? 0 : day === 1 ? inGame().length - 4 : Math.max(0, inGame().length - (need > 0 ? need + 1 : 0));
        out.push(ev("zone", { zone: day - 1, text: day === RULES.days ? t("Jour du prime : le temple du Soleil s'ouvre. La dernière énigme donne le 7e morceau, la clé du coffre.") : t("Jour {d} : {z} s'ouvre. L'énigme du jour mène au morceau de carte n°{d}.", { d: day, z: zoneName(day - 1) }) }));
        out.push(ev("riddle", { kind: S.riddle.kind, text: t("L'énigme du jour est publiée. Les spectateurs peuvent la résoudre en même temps que les candidats.") }));
      } else if (hour <= RULES.lastHour) {
        if (RULES.hintHours.includes(hour) && !S.solved) out.push(ev("hint", { i: RULES.hintHours.indexOf(hour), text: t("Indice n°{i} : {h}", { i: RULES.hintHours.indexOf(hour) + 1, h: t(S.riddle.hints[RULES.hintHours.indexOf(hour)]) }) }));
        solveHour(out);
        if (hour < RULES.lastHour) {
          if (day < RULES.days) { medalHour(out); trapHour(out); pactHour(out); }
          else finaleDay(out);
          curseHour(out);
        } else settle(out);
      }
      let ask = null;
      if (hour === RULES.voteHour && day < RULES.days) ask = guardianHour(out);
      if (hour === RULES.finaleHour && day === RULES.days) finale(out);
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
      const res = voteResult(value, ask.ids);
      const saved = byId[res[0].id];
      saved.stats.saved++;
      out.push(ev("vote", { result: res, saved: saved.id, text: t("Le public a parlé : {a} est sauvé·e avec {p} % des votes et reste dans la vallée.", { a: saved.name, p: res[0].pct }) }));
      for (const id of ask.ids) if (id !== saved.id) evacuate(byId[id], out, "vote");
      advance(out);
      S.log.push(...out);
      return out;
    }
    function advance(out) {
      if (S.over) return;
      S.hour++;
      const last = S.day === RULES.days ? RULES.finaleHour : RULES.voteHour;
      if (S.hour > last) {
        if (S.day < RULES.days) night(out);
        S.day++; S.hour = RULES.firstHour;
      }
    }
    // Le souffle du public : la communauté a trouvé la réponse avant les candidats et choisit à qui la souffler.
    function whisper(id) {
      if (S.over || S.solved || S.hour > RULES.lastHour || !byId[id] || byId[id].state !== "in") return false;
      S.whisper = id;
      return true;
    }
    function snapshot() {
      return {
        day: S.day, hour: S.hour, over: S.over, winner: S.winner, solved: S.solved, solvedBy: S.solvedBy, whisper: S.whisper,
        pieces: S.pieces.slice(1), threatened: [...S.threatened],
        cast: C.map((x) => ({ id: x.id, name: x.name, state: x.state, medal: x.medal, pieces: [...x.pieces], copies: x.copies.length, pact: x.pact, rank: x.outRank, stats: { ...x.stats } })),
      };
    }
    return { next, answer, whisper, snapshot, state: S, cast: C, byId, rules: RULES, zones: ZONES, zoneName, popularity, riddle: () => S.riddle };
  }

  const api = { cast, create, riddle, RULES, ZONES };
  root.TresorEngine = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
