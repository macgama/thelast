// The Last : la mise en scène. Chaque événement de la simulation devient une petite scène animée sur l'île,
// avec des bulles de dialogue, une caméra « réalisateur » et de la vie entre deux scènes.
// Style cartoon : on voit le choc et la panique, jamais de sang. Les dialogues sont écrits à la main ici ;
// plus tard, une IA les écrira à partir des mêmes événements.
(function () {
  "use strict";
  const T = window.THREE;

  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hash = (s) => [...s].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7);
  const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const UP = (y) => new T.Vector3(0, y, 0);
  const lerpAngle = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; };

  const ICON = { flask: "💧", medkit: "🩹", map: "🗺️", rope: "🪢", rations: "🍌", torch: "🔦" };
  const CHALLENGE = { raft: "le radeau", chest: "le coffre immergé", puzzle: "le grand puzzle", pole: "les poteaux", coconut: "la noix de coco", relay: "le relais en binôme" };
  const TRIAL = { endurance: "d'endurance", orientation: "d'orientation", trust: "de confiance" };

  // Répliques écrites à la main (variantes tirées au sort, de façon reproductible)
  const SAY = {
    allyAsk: ["On fait équipe ?", "Toi et moi, jusqu'au bout ?", "J'ai besoin de quelqu'un de fiable.", "On s'allie ? Personne ne saura."],
    allyYes: ["Marché conclu !", "Tope là.", "Ok. Mais pas de coup bas.", "Je te couvre, tu me couvres."],
    disA: ["C'est à moi, ça !", "Tu te crois où ?", "Recule !", "Tu me cherches depuis ce matin."],
    disB: ["Rêve pas !", "J'étais là avant !", "Calme-toi !", "Lâche ça !"],
    disA2: ["Tu vas voir…", "Dernier avertissement !", "Je ne lâcherai pas !"],
    disEnd: ["Ça va, garde-le…", "Ok, ok… t'as gagné.", "On en reparlera."],
    sneak: ["Personne ne regarde…", "Juste un petit peu…", "Chut…"],
    caughtB: ["Hé ! Lâche ça !", "Hé ! Qu'est-ce que tu fais ?!", "Je t'ai vu !"],
    caughtA: ["Euh… je cherchais ma gourde !", "C'est pas ce que tu crois !", "J'ai… trébuché ?"],
    betray: ["Désolé, partenaire…", "Rien de personnel.", "C'est le jeu…"],
    sabWake: ["Mon abri !", "Qui a fait ça ?!", "Non, non, non…"],
    help: ["Au secours !", "À l'aide !", "Je n'ai plus pied !"],
    wasps: ["Aïe aïe aïe !", "Des guêpes !!", "Courez !"],
    snake: ["Un serpent !", "Aïe, ma cheville !", "Ne bouge plus…"],
    fall: ["Ouh là…", "Ça glisse…", "Je ne regarde pas en bas…"],
    fever: ["J'ai froid…", "Ma tête…", "Tout tourne…"],
    rock: ["Attention !!", "Ça descend !"],
    rescue: ["Je te tiens !", "Accroche-toi !", "Respire, ça va aller."],
    thanks: ["Merci… vraiment.", "Je te dois une fière chandelle.", "Je n'oublierai pas."],
    share: ["Tiens, prends.", "J'en ai assez, c'est pour toi.", "Pour toi."],
    gift: ["Merci le public !", "Vous êtes les meilleurs !", "Je n'y crois pas !"],
    lost: ["Noooon !", "Mon colis !", "Pas dans les arbres…"],
    interB: ["Merci du cadeau !", "Trouvé, gardé !"],
    interA: ["C'était pour moi !", "Rends-le !"],
    quit: ["J'arrête là.", "C'est fini pour moi.", "Je rentre."],
    weak: ["Je n'en peux plus…", "Je vois flou…"],
    win: ["Ouiii !", "Immunité !", "Personne ne me touche ce soir !"],
    saved: ["Merci !!", "Encore une nuit !", "Je vous aime !"],
    outVote: ["C'était un honneur.", "Merci pour tout.", "Gagnez pour moi."],
    clanHi: ["Bienvenue chez nous !", "Un de plus, on est plus forts.", "Ici, on partage tout."],
    clanYes: ["Merci, je ne vous lâcherai pas.", "Comptez sur moi.", "Enfin une famille."],
    meal: ["On met tout en commun.", "Ce soir, personne n'a soif.", "À nous !", "Un clan, ça partage."],
    mealThanks: ["Merci, vraiment.", "Ça fait du bien…", "On tient ensemble."],
    defend: ["Pas touche à mon clan !", "Recule. Maintenant.", "Il faudra passer par moi.", "Pas touche aux nôtres !"],
    backOff: ["Ok, ok…", "Ça va, j'ai compris.", "Tu ne seras pas toujours là…"],
    suspect: ["Je ne lui fais plus confiance…", "Il se passe quelque chose…", "Et si c'était le moment ?", "Je le sens mal…"],
    plot1: ["Psst… on peut parler ?", "Viens, à l'écart."],
    plot2: ["Tu as l'air surpris…", "Tu crois vraiment ?", "Tu es sûr de toi ?"],
    plot3: ["Fais-moi confiance.", "Je te dis ce que je vois.", "Garde ça pour toi."],
    neckGift: ["Prends-le. Tu en as plus besoin que moi.", "Pour toi. C'est ça, un clan.", "Tu restes. Je te le dois."],
    giftRx: ["Tu… tu es sérieux ?", "Je ne sais pas quoi dire…", "Merci… merci !"],
    plead: ["Sauvez {n}, s'il vous plaît !", "Votez pour {n} !", "Ne laissez pas partir {n} !", "Gardez {n}, c'est des nôtres !"],
    chat: [
      ["Tu as trouvé de l'eau ?", "Près de la cascade, peut-être."], ["Tu me surveilles ?", "Moi ? Jamais."],
      ["J'ai trop faim…", "Pareil. Je rêve de pâtes."], ["Tu dors où ce soir ?", "Loin de toi, sans vexer."],
      ["On se méfie de qui ?", "De tout le monde."], ["Il fait une chaleur…", "Ne m'en parle pas."],
      ["Tu crois au vote ?", "Je crois au public."], ["Ton abri tiendra ?", "Il a intérêt."],
    ],
  };

  // Les intrigues : qui s'oppose à qui, épisode après épisode (partagé avec la page)
  const CONFLICT = {
    dispute: (e) => [[e.a[0], e.a[1], 2, "la dispute"]],
    steal: (e) => [[e.a[0], e.a[1], e.d?.betrayal ? 4 : e.d?.caught ? 2 : 1.5, e.d?.betrayal ? "la trahison" : "le vol"]],
    sabotage: (e) => [[e.a[0], e.a[1], 3, "l'abri démoli"]],
    defend: (e) => [[e.a[1], e.a[2], 1.5, e.d?.theft ? "le sac fouillé" : "l'altercation"], [e.a[0], e.a[1], 1, "l'intervention"]],
    conspire: (e) => [[e.a[0], e.a[2], 2, "le complot"]],
    suspicion: (e) => [[e.a[0], e.a[1], 1, "la méfiance"]],
    gift_lost: (e) => (e.d?.intercepted && e.a[1] ? [[e.a[1], e.a[0], 1, "le colis volé"]] : []),
  };
  function rivalries(D, t) {
    const map = new Map();
    for (const e of D.events) {
      if (e.t > t) break;
      const f = CONFLICT[e.type];
      if (!f) continue;
      for (const [a, b, w, what] of f(e)) {
        if (!a || !b || a === b) continue;
        const key = a < b ? a + "|" + b : b + "|" + a;
        const r = map.get(key) || { key, a, b, heat: 0, n: 0, first: e.t, last: null, lastWhat: "", lastBy: a };
        r.heat += w; r.n++; r.last = e.t; r.lastWhat = what; r.lastBy = a;
        map.set(key, r);
      }
    }
    return [...map.values()];
  }
  window.TheLastRivals = rivalries;

  function create(ctx) {
    const { scene, camera, canvas, host, D, people, ZONES, height, riverDist, mat, box, makeDrone } = ctx;
    const C = Object.fromEntries(D.cast.map((c) => [c.id, c]));
    const nm = (id) => C[id]?.name ?? "?";
    const zoneName = (z) => D.arena.zones.find((x) => x.id === z)?.name ?? "";
    const atZone = (z) => { const n = zoneName(z); return n.startsWith("le ") ? "au " + n.slice(3) : n.startsWith("les ") ? "aux " + n.slice(4) : z === "jungle" || z === "mangrove" ? "dans " + n : "à " + n; };
    const deN = (id) => (/^[aeiouyhâéèêîôûAEIOUYHÉÈÂÎÔ]/.test(nm(id)) ? "d'" : "de ") + nm(id);
    const list = (ids) => { const n = ids.map(nm); return n.length < 2 ? n.join("") : n.slice(0, -1).join(", ") + " et " + n[n.length - 1]; };
    const live = (text, kind = "live") => ctx.live(text, kind);
    const isNight = (t) => { const h = t % 24; return h >= 22 || h < 6; };
    let now = 0;

    // Axes de l'écran : la caméra regarde depuis le sud-est, donc SIDE est l'horizontale de l'image
    const SIDE = new T.Vector3(1, 0, -1).normalize(), DEPTH = new T.Vector3(1, 0, 1).normalize();
    const ground = (x, z) => Math.max(height(x, z), -0.6);
    const V = (x, z) => new T.Vector3(x, ground(x, z), z);
    const off = (base, s, d = 0) => { const v = base.clone().addScaledVector(SIDE, s).addScaledVector(DEPTH, d); v.y = ground(v.x, v.z); return v; };
    const vis = (id) => !!id && !!people[id] && people[id].visible && !people[id].userData.evac;
    const S = ctx.S || 1; // agrandissement de l'île
    const FIRE = V(4.5 * S, 21 * S);
    const BEACH_C = V(ZONES.beach[0] + DEPTH.x * 2.5, ZONES.beach[1] + DEPTH.z * 2.5); // l'aire des épreuves

    function safe(v, zone = "beach") {
      const [cx, cz] = ZONES[zone];
      const p = v.clone();
      for (let i = 0; i < 12 && height(p.x, p.z) < 0.35; i++) { p.x = lerp(p.x, cx, 0.2); p.z = lerp(p.z, cz, 0.2); }
      p.y = ground(p.x, p.z);
      return p;
    }
    const STAGE = { ruins: [-3, 3] }; // [côté, profondeur] : aux ruines, on s'écarte du temple
    let stageT = 0;
    // La scène se joue devant le groupe de la zone, côté caméra, pour que personne ne la cache
    function stageOf(zone) {
      const snap = ctx.snapAt(stageT), n = Object.values(snap).filter((p) => p[0] === zone).length;
      const [cx, cz] = ZONES[zone] || ZONES.beach, [s0, dd] = STAGE[zone] || [0, 1.5];
      const d0 = Math.max(dd, Math.min(9, 1.1 + 0.95 * Math.sqrt(n) + 2.2));
      for (const k of [1, 0.75, 0.5, 0.25, 0]) for (const rot of [0, 0.5, -0.5, 1, -1]) {
        const c = Math.cos(rot), sn = Math.sin(rot), ox = SIDE.x * s0 + DEPTH.x * d0, oz = SIDE.z * s0 + DEPTH.z * d0;
        const x = cx + (ox * c - oz * sn) * k, z = cz + (ox * sn + oz * c) * k;
        if (height(x, z) > 0.45 && height(x + DEPTH.x * 2, z + DEPTH.z * 2) > 0.2) return V(x, z);
      }
      return V(cx, cz);
    }
    const waterCache = {};
    function waterOf(zone) {
      if (zone in waterCache) return waterCache[zone];
      const p = stageOf(zone);
      let best = null;
      for (let a = 0; a < 32; a++) {
        const ang = (a / 32) * Math.PI * 2, dx = Math.cos(ang), dz = Math.sin(ang);
        for (let r = 1; r < 18; r += 0.5) {
          const x = p.x + dx * r, z = p.z + dz * r, h = height(x, z);
          const river = z > -21 && riverDist(x, z) < 1.0 && h > -0.5;
          if (h < -0.7 || river) { if (!best || r < best.r) best = { r, dx, dz, river }; break; }
        }
      }
      if (!best) return (waterCache[zone] = null);
      const { r, dx, dz, river } = best;
      const pt = (k) => new T.Vector3(p.x + dx * k, 0, p.z + dz * k);
      const surf = (v) => (river ? Math.max(height(v.x, v.z), -0.6) + 0.35 : 0.05);
      const edge = pt(Math.max(0.5, r - 1.3)); edge.y = ground(edge.x, edge.z);
      const deep = pt(r + (river ? 0.2 : 2.2)); deep.y = surf(deep) - 1.3;
      const far = river ? deep.clone().add(new T.Vector3(-dz * 2.5, 0, dx * 2.5)) : pt(r + 6);
      far.y = surf(far) - 1.3;
      return (waterCache[zone] = { edge, deep, far, dir: new T.Vector3(dx, 0, dz), river, surf: river ? deep.y + 1.3 : 0.05 });
    }
    function uphill(p, rad = 6) {
      let best = p.clone();
      for (let a = 0; a < 16; a++) for (const r of [rad * 0.5, rad]) {
        const x = p.x + Math.cos((a / 16) * 6.283) * r, z = p.z + Math.sin((a / 16) * 6.283) * r;
        if (height(x, z) > best.y) best = V(x, z);
      }
      return best;
    }

    // ---------- Particules (poussière, éclaboussures, confettis, feux d'artifice) ----------
    const PGEO = new T.IcosahedronGeometry(0.2, 0);
    const pool = [];
    for (let i = 0; i < 240; i++) {
      const m = new T.Mesh(PGEO, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }));
      m.visible = false;
      m.userData = { v: new T.Vector3(), life: 0, max: 1, g: 0, grow: 0, s0: 1, op: 1 };
      scene.add(m);
      pool.push(m);
    }
    function burst(pos, o = {}) {
      const n = o.n ?? 10, cols = o.colors || [o.color ?? 0xffffff];
      for (let i = 0; i < n; i++) {
        const m = pool.find((x) => !x.visible);
        if (!m) return;
        const u = m.userData, sp = (o.speed ?? 3) * (0.4 + Math.random() * 0.6);
        m.position.copy(pos).add(new T.Vector3((Math.random() - 0.5) * (o.spread ?? 0.4), Math.random() * 0.2, (Math.random() - 0.5) * (o.spread ?? 0.4)));
        if (o.sphere) u.v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(sp);
        else { const a = Math.random() * 6.283; u.v.set(Math.cos(a) * sp, (o.up ?? 3) * (0.5 + Math.random() * 0.5), Math.sin(a) * sp); }
        u.life = 0; u.max = (o.life ?? 1) * (0.7 + Math.random() * 0.6); u.g = o.gravity ?? -9; u.grow = o.grow ?? 0;
        u.s0 = (o.size ?? 1) * (0.6 + Math.random() * 0.8); u.op = o.opacity ?? 1;
        m.material.color.setHex(cols[i % cols.length]);
        m.material.opacity = u.op;
        m.scale.setScalar(u.s0);
        m.visible = true;
      }
    }
    function updateParticles(dt) {
      for (const m of pool) {
        if (!m.visible) continue;
        const u = m.userData;
        u.life += dt;
        if (u.life >= u.max) { m.visible = false; continue; }
        u.v.y += u.g * dt;
        m.position.addScaledVector(u.v, dt);
        const k = u.life / u.max;
        m.scale.setScalar(u.s0 * (1 + u.grow * k));
        m.material.opacity = u.op * (1 - k * k);
      }
    }
    const dust = (pos, n = 8) => burst(pos, { n, colors: [0xe8dcc0, 0xd8c8a0, 0xffffff], speed: 1.6, up: 1.2, gravity: -1, life: 1.2, size: 2.2, grow: 1.5, opacity: 0.85 });
    const splash = (pos, n = 8) => burst(pos, { n, colors: [0xffffff, 0xbfe6f0], speed: 1.5, up: 4, gravity: -12, life: 0.7, size: 0.8 });
    const sparkle = (pos) => burst(pos, { n: 14, colors: [0xffd23f, 0xfff08a, 0xff8a3d], speed: 2.4, up: 3, gravity: -4, life: 1, size: 0.6 });
    const confetti = (pos) => burst(pos, { n: 40, colors: [0xff8a3d, 0x62d6a0, 0x7fb0ff, 0xffd23f, 0xff5b6b, 0xc08bff], speed: 4, up: 7, gravity: -6, life: 2.2, size: 0.5 });
    const firework = (pos, col) => burst(pos, { n: 36, colors: [col, 0xffffff], speed: 7, sphere: true, gravity: -2.5, life: 1.6, size: 0.55 });

    // ---------- Bulles de dialogue, icônes et étiquettes (HTML au-dessus de la 3D) ----------
    const bubbles = [];
    const later = [];
    function say(id, text, dur = 2.8, kind = "") {
      if (!people[id]) return;
      const isIcon = kind.includes("icon");
      for (const b of bubbles) if (b.id === id && b.icon === isIcon) b.until = Math.min(b.until, now);
      const el = document.createElement("div");
      el.className = "w3-bubble " + kind;
      el.textContent = text;
      host.appendChild(el);
      bubbles.push({ el, id, until: now + dur, icon: isIcon });
      if (!isIcon && !kind.includes("small") && cur && cur.actors.includes(id)) ctx.sfx?.("blip");
    }
    const icon = (id, emo, dur = 1.8) => say(id, emo, dur, "icon");
    function iconAt(pos, emo, dur = 1.8) {
      const el = document.createElement("div");
      el.className = "w3-bubble icon";
      el.textContent = emo;
      host.appendChild(el);
      bubbles.push({ el, pos: pos.clone(), until: now + dur, icon: true });
    }
    const tags = new Map();
    function tag(id, on = true) {
      if (on && !tags.has(id) && id !== ctx.me()) { const el = document.createElement("div"); el.className = "w3-tag"; el.textContent = nm(id); host.appendChild(el); tags.set(id, el); }
      if (!on && tags.has(id)) { tags.get(id).remove(); tags.delete(id); }
    }
    const pv = new T.Vector3(), pw = new T.Vector3();
    function drawOverlays() {
      const rect = canvas.getBoundingClientRect();
      const put = (el, wp, tail) => {
        pv.copy(wp).project(camera);
        const out = pv.z > 1 || Math.abs(pv.x) > 1.1 || Math.abs(pv.y) > 1.1;
        el.style.display = out ? "none" : "";
        if (out) return;
        let x = ((pv.x + 1) / 2) * rect.width;
        if (tail.startsWith("translate(-50%")) { const hw = el.offsetWidth / 2 + 6; x = Math.max(hw, Math.min(rect.width - hw, x)); }
        el.style.transform = `translate(${x}px, ${((1 - pv.y) / 2) * rect.height}px) ${tail}`;
      };
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        if (now > b.until + 0.35 || (b.id && !people[b.id].visible)) { b.el.remove(); bubbles.splice(i, 1); continue; }
        b.el.classList.toggle("gone", now > b.until);
        if (b.pos) put(b.el, b.pos, "translate(-50%, -100%)");
        else put(b.el, pw.copy(people[b.id].position).add(UP(b.icon ? 3.0 : 3.5)), b.icon ? "translate(14px, -100%)" : "translate(-50%, -100%)");
      }
      for (const [id, el] of tags) {
        if (!people[id].visible) { el.style.display = "none"; continue; }
        put(el, people[id].position, "translate(-50%, 6px)");
      }
    }

    // ---------- Accessoires de scène ----------
    function makeBag() {
      const g = new T.Group();
      const b = box(0.55, 0.5, 0.35, 0x7a5634); b.position.y = 0.25; g.add(b);
      const flap = box(0.57, 0.12, 0.37, 0x5a3e24); flap.position.y = 0.48; g.add(flap);
      return g;
    }
    function makeCrate(chute = true) {
      const g = new T.Group();
      g.add(box(1.0, 1.0, 1.0, 0xc8963c));
      g.add(box(1.05, 0.18, 1.05, 0x8a5a24));
      const c = new T.Mesh(new T.SphereGeometry(1.8, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshLambertMaterial({ color: 0xff8a3d, side: T.DoubleSide, flatShading: true }));
      c.position.y = 3.2; c.visible = chute; g.add(c);
      for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const s = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, 3, 3), mat(0xffffff)); s.position.set(x * 0.8, 1.9, z * 0.8); s.rotation.set(z * 0.45, 0, -x * 0.45); c.add(s); s.position.sub(c.position); }
      g.userData.chute = c;
      return g;
    }
    function makeShelter() {
      const g = new T.Group();
      const parts = [];
      const add = (m, p1, r1) => { g.add(m); parts.push({ m, p0: m.position.clone(), r0: m.rotation.clone(), p1, r1 }); };
      const postL = box(0.14, 1.9, 0.14, 0x6b4a2e); postL.position.set(-1.05, 0.95, 0.5);
      add(postL, new T.Vector3(-1.4, 0.12, 0.9), new T.Euler(0, 0, 1.5));
      const postR = box(0.14, 1.9, 0.14, 0x6b4a2e); postR.position.set(1.05, 0.95, 0.5);
      add(postR, new T.Vector3(1.4, 0.12, 1.0), new T.Euler(0, 0, -1.5));
      const ridge = box(2.5, 0.12, 0.12, 0x5a3e24); ridge.position.set(0, 1.9, 0.5);
      add(ridge, new T.Vector3(0.2, 0.1, 1.3), new T.Euler(0, 0.3, 0));
      const roof = box(2.6, 0.1, 2.2, 0x5f8a3a); roof.position.set(0, 1.0, -0.25); roof.rotation.x = -0.95;
      add(roof, new T.Vector3(0, 0.12, -0.2), new T.Euler(0.05, 0.15, 0.08));
      const roof2 = box(2.2, 0.08, 1.7, 0x7aa84a); roof2.position.set(0.1, 1.08, -0.15); roof2.rotation.x = -0.95;
      add(roof2, new T.Vector3(0.6, 0.2, -0.8), new T.Euler(0.2, -0.4, 0));
      const bed = box(1.8, 0.06, 1.2, 0xc9ad76); bed.position.set(0, 0.04, 0); g.add(bed);
      g.userData.collapse = (k) => {
        k = ease(k);
        for (const q of parts) { q.m.position.lerpVectors(q.p0, q.p1, k); q.m.rotation.set(lerp(q.r0.x, q.r1.x, k), lerp(q.r0.y, q.r1.y, k), lerp(q.r0.z, q.r1.z, k)); }
      };
      return g;
    }
    function makeSwarm(n = 36, color = 0xffd23f) {
      const geo = new T.BufferGeometry();
      geo.setAttribute("position", new T.BufferAttribute(new Float32Array(n * 3), 3));
      const pts = new T.Points(geo, new T.PointsMaterial({ color, size: 5 * Math.min(window.devicePixelRatio || 1, 2), sizeAttenuation: false }));
      pts.frustumCulled = false;
      pts.userData.seed = [...Array(n)].map(() => [Math.random() * 6.3, Math.random() * 6.3, 0.4 + Math.random() * 0.8]);
      return pts;
    }
    function moveSwarm(sw, c, spread = 1.3) {
      const p = sw.geometry.attributes.position;
      sw.userData.seed.forEach(([a1, a2, rr], i) => {
        p.array[i * 3] = c.x + Math.cos(now * 5 * rr + a1) * spread * rr;
        p.array[i * 3 + 1] = c.y + Math.sin(now * 7 + a2) * 0.6 * rr;
        p.array[i * 3 + 2] = c.z + Math.sin(now * 4.4 * rr + a2) * spread * rr;
      });
      p.needsUpdate = true;
    }
    // Serpent par défaut ; avec une couleur et une taille, toute bestiole du catalogue (scorpion, sanglier, crabe…)
    function makeSnake(color = null, size = 1) {
      const g = new T.Group();
      const segs = [];
      const n = size >= 1.5 ? 3 : 10;
      const c = color ? new T.Color(color) : null;
      for (let i = 0; i < n; i++) {
        const col = c ? c.clone().multiplyScalar(i === 0 ? 0.8 : i % 2 ? 1 : 0.9).getHex() : i === 0 ? 0x2f6a2a : i % 2 ? 0x4a9a3a : 0x3a7a2e;
        const m = new T.Mesh(new T.SphereGeometry((i === 0 ? 0.17 : 0.13 - i * 0.007) * size, 6, 4), mat(col)); m.castShadow = true; g.add(m); segs.push(m);
      }
      g.userData.size = size;
      g.userData.segs = segs;
      return g;
    }
    function slither(sn, head, dir) {
      const side = new T.Vector3(-dir.z, 0, dir.x);
      sn.userData.segs.forEach((m, i) => {
        const k = sn.userData.size || 1;
        const b = head.clone().addScaledVector(dir, -i * 0.22 * k).addScaledVector(side, Math.sin(now * 8 - i * 0.8) * 0.15 / k);
        b.y = ground(b.x, b.z) + 0.12 * k;
        m.position.copy(b);
      });
    }
    function makePole() { const g = new T.Group(); const p = new T.Mesh(new T.CylinderGeometry(0.16, 0.2, 2, 6), mat(0x8a6a44)); p.position.y = 1; p.castShadow = true; g.add(p); const top = new T.Mesh(new T.CylinderGeometry(0.34, 0.34, 0.1, 8), mat(0x6b4a2e)); top.position.y = 2.02; g.add(top); return g; }
    function makePalm() {
      const g = new T.Group();
      const tr = new T.Mesh(new T.CylinderGeometry(0.14, 0.24, 4.6, 6), mat(0x8a6a44)); tr.position.y = 2.3; tr.castShadow = true; g.add(tr);
      const lf = new T.Mesh(new T.ConeGeometry(1.6, 0.8, 6), mat(0x3f9a45)); lf.position.y = 4.7; g.add(lf);
      const nut = new T.Mesh(new T.SphereGeometry(0.2, 6, 4), mat(0x6b4a2e)); nut.position.set(0.25, 4.35, 0.1); g.add(nut);
      g.userData.nut = nut;
      return g;
    }
    function makeRaft() { const g = new T.Group(); for (let i = 0; i < 4; i++) { const l = new T.Mesh(new T.CylinderGeometry(0.14, 0.14, 1.5, 6), mat(i % 2 ? 0x9a7650 : 0x8a6a44)); l.rotation.z = Math.PI / 2; l.position.z = (i - 1.5) * 0.28; g.add(l); } return g; }
    function makeFinish() { const g = new T.Group(); const p = new T.Mesh(new T.CylinderGeometry(0.09, 0.09, 3, 5), mat(0xdddddd)); p.position.y = 1.5; g.add(p); const f = box(1.1, 0.6, 0.05, 0xff8a3d); f.position.set(0.55, 2.7, 0); g.add(f); return g; }
    function makeBuoy() { const m = new T.Mesh(new T.SphereGeometry(0.45, 8, 6), mat(0xff5b6b)); return m; }
    function makeRing(color = 0xffd23f) { const m = new T.Mesh(new T.TorusGeometry(0.75, 0.08, 4, 24), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })); m.rotation.x = Math.PI / 2; return m; }
    function makeCampfire() {
      const g = new T.Group();
      for (let i = 0; i < 4; i++) { const l = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 0.9, 5), mat(0x6b4a2e)); l.rotation.set(Math.PI / 2, (i / 4) * Math.PI, 0); l.position.y = 0.08; g.add(l); }
      const fl = new T.Mesh(new T.ConeGeometry(0.28, 0.75, 6), new T.MeshBasicMaterial({ color: 0xff8a3d, transparent: true, opacity: 0.9 }));
      fl.position.y = 0.45; g.add(fl);
      const fl2 = new T.Mesh(new T.ConeGeometry(0.16, 0.5, 6), new T.MeshBasicMaterial({ color: 0xffe08a }));
      fl2.position.y = 0.38; g.add(fl2);
      g.userData.flick = (t) => { fl.scale.set(1 + Math.sin(t * 13) * 0.12, 1 + Math.sin(t * 9) * 0.25, 1); fl2.scale.y = 1 + Math.sin(t * 17) * 0.3; };
      return g;
    }
    function miniCrate() { const g = new T.Group(); g.add(box(0.6, 0.45, 0.45, 0xc8963c)); return g; }

    // Cabanes décoratives autour du camp
    for (let i = 0; i < 4; i++) {
      const a = 2.4 + i * 0.55, sh = makeShelter();
      const x = FIRE.x + Math.cos(a) * 7, z = FIRE.z + Math.sin(a) * 6;
      if (height(x, z) < 0.4) continue;
      sh.position.set(x, ground(x, z), z);
      sh.rotation.y = Math.atan2(FIRE.x - x, FIRE.z - z);
      scene.add(sh);
    }

    // ---------- Les drones de secours ----------
    const drones = [];
    function evacuate(id, delay = 0, carried = "lie") {
      const p = people[id];
      if (!p || !p.visible || p.userData.evac) return;
      let d = drones.find((x) => !x.visible && !x.userData.busy);
      if (!d) {
        d = makeDrone(0xffffff);
        const beam = new T.Mesh(new T.CylinderGeometry(0.35, 0.9, 1, 8, 1, true), new T.MeshBasicMaterial({ color: 0xbfe6f0, transparent: true, opacity: 0.25, side: T.DoubleSide, depthWrite: false }));
        d.add(beam);
        d.userData.beam = beam;
        scene.add(d);
        drones.push(d);
      }
      d.visible = false;
      d.userData.busy = true;
      if (!cur || cur.actors.includes(id)) later.push({ at: now + delay, fn: () => ctx.sfx?.("drone") });
      p.userData.evac = { t0: now + delay, d, pose: carried, base: null };
    }
    function updateEvac(p, u, dt) {
      const e = u.evac, k = now - e.t0, d = e.d;
      if (!e.base) { e.base = u.pos.clone(); u.ctl = null; }
      const b = e.base;
      d.visible = true;
      d.children.forEach((ch, i) => { if (ch.geometry?.type === "CylinderGeometry" && ch !== d.userData.beam) ch.rotation.y += 0.6 + i * 0.1; });
      let dy = 0;
      if (k < 1.2) d.position.set(b.x, b.y + 14 - (k / 1.2) * 10.8, b.z);
      else if (k < 1.8) d.position.set(b.x, b.y + 3.2, b.z);
      else { dy = (k - 1.8) * 8; d.position.set(b.x, b.y + 3.2 + dy, b.z); }
      const beam = d.userData.beam, L = Math.max(0.1, d.position.y - (b.y + dy));
      beam.visible = k > 1.0;
      beam.scale.y = L; beam.position.y = -L / 2;
      p.position.set(b.x, b.y + dy * 0.98 + (k > 1.8 ? 0.2 : 0), b.z);
      if (k > 1.8) p.rotation.y += dt * 2;
      applyPose(p, u, e.pose === "lie" ? (k > 1.8 ? "dizzy" : "lie") : k > 1.8 ? "wave" : e.pose);
      if (k > 3.8) { d.visible = false; d.userData.busy = false; p.visible = false; u.evac = null; u.keep = false; }
    }

    // ---------- Pilotage des personnages ----------
    function ctl(id) {
      const u = people[id]?.userData;
      if (!u) return null;
      if (!u.ctl) u.ctl = { target: u.pos.clone(), speed: 3, move: "walk", pose: "idle", face: null, faceId: null, fly: false };
      return u.ctl;
    }
    function go(id, pos, speed = 3, move = "walk") { const c = ctl(id); if (!c) return; c.target.copy(pos); c.speed = speed; c.move = move; c.fly = false; }
    function swim(id, pos, speed = 1.5, move = "swim") { const c = ctl(id); if (!c) return; c.target.copy(pos); c.speed = speed; c.move = move; c.fly = true; }
    function place(id, pos, fly = false) { const c = ctl(id); if (!c) return; c.target.copy(pos); c.fly = fly; people[id].userData.pos.copy(pos); }
    function stop(id) { const c = ctl(id); if (c) c.target.copy(people[id].userData.pos); }
    function pose(id, ps, forSec) { const c = ctl(id); if (!c) return; c.pose = ps; c.poseUntil = forSec ? now + forSec : 0; }
    function face(id, target) { const c = ctl(id); if (!c) return; if (typeof target === "string") { c.faceId = target; c.face = null; } else { c.face = target.clone(); c.faceId = null; } }
    function release(id) { const u = people[id]?.userData; if (u) u.ctl = null; }

    // Postures cartoon, calculées à chaque image
    function applyPose(p, u, ps) {
      const L = u.armL.rotation, R = u.armR.rotation, t = now, ph = t * 9 + u.phase;
      L.set(0, 0, 0); R.set(0, 0, 0);
      let tilt = 0, dy = 0, sq = 1, roll = 0, jx = 0;
      switch (ps) {
        case "walk": { const s = Math.sin(ph) * 0.6; L.x = s; R.x = -s; dy = Math.abs(Math.sin(ph)) * 0.08; break; }
        case "run": { const s = Math.sin(t * 16 + u.phase) * 1.1; L.x = s; R.x = -s; dy = Math.abs(Math.sin(t * 16 + u.phase)) * 0.18; tilt = 0.25; break; }
        case "sneak": { const s = Math.sin(t * 5) * 0.3; L.x = -0.6 + s; R.x = -0.6 - s; sq = 0.78; tilt = 0.35; break; }
        case "panic": L.z = -2.7 + Math.sin(t * 20) * 0.5; R.z = 2.7 - Math.sin(t * 20 + 1) * 0.5; dy = Math.abs(Math.sin(t * 14)) * 0.35; jx = Math.sin(t * 31) * 0.05; break;
        case "cheer": L.z = -2.6; R.z = 2.6; L.x = R.x = -0.3; dy = Math.abs(Math.sin(t * 8 + u.phase)) * 0.6; break;
        case "hold": L.x = R.x = -2.9; L.z = -0.15; R.z = 0.15; break;
        case "argue": R.x = -1.6 + Math.sin(t * 12) * 0.35; L.z = -0.5; L.x = -0.2; dy = Math.abs(Math.sin(t * 6)) * 0.1; break;
        case "push": L.x = R.x = -1.5; tilt = 0.3; break;
        case "tug": L.x = R.x = -1.3; tilt = -0.35; jx = Math.sin(t * 9) * 0.04; break;
        case "shake": R.x = -1.3 + Math.sin(t * 14) * 0.2; break;
        case "grab": R.x = -1.0; L.x = -0.6; tilt = 0.6; sq = 0.85; break;
        case "wave": R.z = 2.4 + Math.sin(t * 10) * 0.4; break;
        case "point": R.x = -1.55; L.z = -0.4; break;
        case "lie": tilt = -Math.PI / 2; dy = 0.3; L.z = -0.4; R.z = 0.4; break;
        case "sleep": tilt = -Math.PI / 2; dy = 0.3; L.x = R.x = 0.2; break;
        case "dizzy": tilt = -Math.PI / 2; dy = 0.3; L.z = -1.2 + Math.sin(t * 6) * 0.2; R.z = 1.2; break;
        case "tumble": tilt = t * 14; dy = 0.6; L.z = -2; R.z = 2; break;
        case "sit": dy = -0.45; sq = 0.85; L.x = R.x = -0.5; tilt = -0.15; break;
        case "shiver": jx = Math.sin(t * 40) * 0.04; L.x = R.x = -0.9; L.z = 0.7; R.z = -0.7; sq = 0.92; break;
        case "swim": L.x = -2.6 + Math.sin(t * 7) * 1.0; R.x = -2.6 - Math.sin(t * 7) * 1.0; break;
        case "flail": L.z = -2.6 + Math.sin(t * 18) * 0.6; R.z = 2.6 + Math.sin(t * 18) * 0.6; jx = Math.sin(t * 25) * 0.06; break;
        case "climb": L.x = -2.8 + Math.sin(t * 8) * 0.4; R.x = -2.8 - Math.sin(t * 8) * 0.4; break;
        case "paddle": dy = -0.25; sq = 0.85; L.x = -1.2 + Math.sin(t * 6) * 0.7; R.x = -1.2 - Math.sin(t * 6) * 0.7; break;
        case "balance": L.z = -1.5 + Math.sin(t * 3 + u.phase) * 0.4; R.z = 1.5 + Math.sin(t * 3.4 + u.phase) * 0.4; roll = Math.sin(t * 2.6 + u.phase) * 0.14; break;
        case "fish": R.x = -1.1; L.x = -0.9; L.z = 0.3; break;
        case "gather": tilt = 0.75; L.x = R.x = -0.9 + Math.sin(t * 3 + u.phase) * 0.2; break;
        case "fan": R.x = -2.3 + Math.sin(t * 15) * 0.3; break;
        default: L.x = Math.sin(t * 1.3 + u.phase) * 0.05; R.x = -L.x;
      }
      p.rotation.x = tilt;
      p.rotation.z = roll;
      p.scale.set(1.25, 1.25 * sq, 1.25);
      p.position.y += dy;
      p.position.x += jx;
      u.rod.visible = ps === "fish";
    }

    // ---------- La vie entre deux scènes ----------
    const WATERY = new Set(["beach", "lagoon", "river", "mangrove", "cove"]);
    const FORAGE = new Set(["jungle", "mangrove", "waterfall", "river", "ruins"]);
    function assignAmbient(t) {
      const hour = t % 24, night = isNight(t), eve = hour >= 20 && hour < 22;
      const snap = ctx.snapAt(t);
      const ids = Object.keys(snap);
      for (const id of ids) {
        const u = people[id].userData, [zone, health] = snap[id];
        const r = hash(id + ":" + t) % 100;
        let a = null;
        if (night) a = { kind: "sleep", pose: "sleep" };
        else if (health < 30) a = { kind: "rest", pose: "sit" };
        else if (eve && zone === "beach") a = { kind: "fire", pose: "sit", face: FIRE };
        else if (WATERY.has(zone) && r < 30 && waterOf(zone)) {
          const w = waterOf(zone), k = (hash(id) % 7) - 3;
          const tgt = w.edge.clone().addScaledVector(new T.Vector3(-w.dir.z, 0, w.dir.x), k * 1.1);
          if (height(tgt.x, tgt.z) > 0.15) { tgt.y = ground(tgt.x, tgt.z); a = { kind: "fish", pose: "fish", target: tgt, face: tgt.clone().addScaledVector(w.dir, 5) }; }
        }
        if (!a) {
          if (FORAGE.has(zone) && r < 55) a = { kind: "gather", pose: "gather", target: u.target.clone().add(new T.Vector3(((r % 7) - 3) * 0.3, 0, ((r % 5) - 2) * 0.3)) };
          else if ((zone === "summit" || zone === "cliffs") && r < 45) { const [cx, cz] = ZONES[zone]; a = { kind: "lookout", pose: "idle", face: new T.Vector3(cx * 3, 0, cz * 3) }; }
          else if (r < 80) a = { kind: "wander", pose: "idle" };
          else {
            let best = null, bd = 1e9;
            for (const o of ids) if (o !== id && snap[o][0] === zone) { const dd = people[o].userData.target.distanceTo(u.target); if (dd < bd) { bd = dd; best = o; } }
            a = { kind: "wary", pose: "idle", faceId: best };
          }
        }
        if (a.target) a.target.y = ground(a.target.x, a.target.z);
        u.amb = a;
      }
    }
    function ambientText(id) {
      const u = people[id].userData, a = u.amb || { kind: "wander" }, z = ctx.snapAt(ctx.tick())[id]?.[0] || "beach", at = atZone(z);
      switch (a.kind) {
        case "sleep": return `${nm(id)} dort ${at}. Enfin.`;
        case "rest": return `${nm(id)} reprend des forces ${at}.`;
        case "fire": return `${nm(id)} se réchauffe près du feu de camp.`;
        case "fish": return `${nm(id)} pêche ${at}.`;
        case "gather": return `${nm(id)} cherche de quoi manger ${at}.`;
        case "lookout": return `${nm(id)} scrute l'horizon ${at}.`;
        case "wary": return a.faceId ? `${nm(id)} garde un œil sur ${nm(a.faceId)}.` : `${nm(id)} se méfie de tout le monde.`;
        default: return `${nm(id)} explore ${at}.`;
      }
    }
    let chatT = 2, fishT = 3, zzzT = 1;
    function ambientTick(dt, night) {
      chatT -= dt; fishT -= dt; zzzT -= dt;
      if (cur) return;
      const camT = ctx.camTarget();
      const near = Object.keys(people).filter((id) => vis(id) && !people[id].userData.ctl && people[id].userData.amb && people[id].position.distanceTo(camT) < 13);
      const awake = near.filter((id) => people[id].userData.amb.kind !== "sleep");
      if (chatT < 0) {
        chatT = 3.5 + Math.random() * 3;
        if (!night && awake.length > 1) {
          const a = awake[Math.floor(Math.random() * awake.length)];
          const b = awake.filter((x) => x !== a).sort((x, y) => people[x].position.distanceTo(people[a].position) - people[y].position.distanceTo(people[a].position))[0];
          if (b && people[b].position.distanceTo(people[a].position) < 4) {
            const [q, rep] = SAY.chat[Math.floor(Math.random() * SAY.chat.length)];
            people[a].userData.amb.faceId = b; people[b].userData.amb.faceId = a;
            say(a, q, 2.4, "small");
            later.push({ at: now + 1.6, fn: () => vis(b) && say(b, rep, 2.4, "small") });
          } else icon(a, "👀", 1.6);
        }
      }
      if (fishT < 0) {
        fishT = 4 + Math.random() * 4;
        const f = near.filter((id) => people[id].userData.amb.kind === "fish");
        if (f.length) { const id = f[Math.floor(Math.random() * f.length)]; icon(id, "🐟", 1.6); people[id].userData.amb.cheerUntil = now + 1.1; }
      }
      if (zzzT < 0) {
        zzzT = 1.4;
        const s = near.filter((id) => people[id].userData.amb.kind === "sleep");
        if (s.length) icon(s[Math.floor(Math.random() * s.length)], "💤", 1.6);
      }
    }

    // ---------- Scènes ----------
    class Sc {
      constructor(ev, dur, focus, zoom = 3.1) { Object.assign(this, { ev, dur, focus, zoom, s: 0, steps: [], props: [], actors: [], named: [], ticks: [], i: 0, hidden: new Set() }); }
      at(t, fn) { this.steps.push([t, fn]); return this; }
      on(fn) { this.ticks.push(fn); return this; }
      prop(o) { scene.add(o); this.props.push(o); return o; }
      cast(...ids) { for (const id of ids) if (id && vis(id) && !this.actors.includes(id)) { this.actors.push(id); this.named.push(id); } return this; }
    }
    let queue = [], cur = null, minis = [], timeScale = 1;
    // Réplique d'une scène : celle écrite par l'IA pour cet événement s'il y en a une, sinon une réplique écrite à la main.
    const ev = null; // repli pour les rares répliques hors scène
    function L(e, r, k) { const v = e?.say?.[k]; return v ? (ctx.lang === "en" && v[1] ? v[1] : v[0]) : pick(r, SAY[k]); }
    const R = (ev) => rng(ev.t * 977 + hash(ev.type + ev.a.join("")));
    const zoneOf = (ev) => ev.z || ctx.snapAt(ev.t)[ev.a[0]]?.[0] || ctx.snapAt(ev.t - 1)[ev.a[0]]?.[0] || "beach";
    const focusOn = (id, y = 1.2) => () => (people[id] ? people[id].position.clone().add(UP(y)) : new T.Vector3());

    const B = {};
    B.alliance = (ev) => {
      const [a, b] = ev.a;
      if (!vis(a) || !vis(b)) return null;
      const r = R(ev), st = stageOf(zoneOf(ev));
      return new Sc(ev, 7, st.clone().add(UP(1.2)), 3.3).cast(a, b)
        .at(0, () => { live(`${nm(a)} s'approche ${deN(b)}…`); go(a, off(st, -2.2), 3); go(b, off(st, 1), 3); face(b, a); })
        .at(1.8, () => { face(a, b); go(a, off(st, -0.15), 1.6); say(a, L(ev, r, "allyAsk")); })
        .at(3.4, () => { face(b, a); say(b, L(ev, r, "allyYes")); })
        .at(4.6, () => { pose(a, "shake"); pose(b, "shake"); iconAt(off(st, 0.45).add(UP(3)), "🤝", 2); sparkle(off(st, 0.45).add(UP(2))); live(ev.fr, "result"); ctx.sfx?.("chime"); })
        .at(6.2, () => { pose(a, "cheer", 1.2); pose(b, "cheer", 1.2); if (ev.d?.clan) say(a, `Les ${ev.d.clan} !`, 1.6, "shout"); });
    };

    // Les clans : on rejoint, on partage, on se défend
    const clanOf = (t, id) => ctx.snapAt(t)[id]?.[4] || null;
    const clanMates = (t, clan, not = []) => Object.keys(ctx.snapAt(t)).filter((id) => clanOf(t, id) === clan && vis(id) && !not.includes(id));

    B.clan_join = (ev) => {
      const [g, h] = ev.a, clan = ev.d?.clan;
      if (!vis(g) || !vis(h)) return null;
      const r = R(ev), st = stageOf(zoneOf(ev));
      const others = clanMates(ev.t, clan, [g, h]).filter((id) => people[id].position.distanceTo(st) < 14).slice(0, 3);
      const sc = new Sc(ev, 7.5, st.clone().add(UP(1.2)), 3.2).cast(g, h, ...others);
      const ring = (i) => off(st, 0.9 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.9, -0.6 - Math.ceil(i / 2) * 0.4);
      sc.at(0, () => {
        live(`${nm(g)} vient frapper à la porte du clan des ${clan}…`);
        go(h, off(st, 0.9), 3); others.forEach((id, i) => { go(id, ring(i + 1), 3); face(id, off(st, -2)); });
        go(g, off(st, -2.4), 3); face(h, g);
      })
        .at(1.6, () => { face(g, h); go(g, off(st, -0.3), 1.6); say(g, L(ev, r, "allyAsk")); })
        .at(3.2, () => { say(h, L(ev, r, "clanHi")); pose(h, "wave", 1.2); })
        .at(4.6, () => { pose(g, "shake"); pose(h, "shake"); sparkle(off(st, 0.3).add(UP(2))); others.forEach((id) => pose(id, "cheer", 1.6)); live(ev.fr, "result"); ctx.sfx?.("chime"); })
        .at(6.0, () => { pose(g, "idle"); pose(h, "idle"); say(g, L(ev, r, "clanYes"), 1.8); });
      return sc;
    };

    B.clan_meal = (ev) => {
      const ids = ev.a.filter(vis).slice(0, 6), clan = ev.d?.clan, giver = ev.d?.giver;
      if (ids.length < 2) return null;
      const r = R(ev), st = stageOf(zoneOf(ev)), n = ids.length;
      // Chaque clan a son coin de veillée, dans le couloir sans arbres qui mène à la caméra
      const z = zoneOf(ev), [cx, cz] = ZONES[z] || ZONES.beach, sgn = hash(clan || "") % 2 ? 1 : -1;
      let fire = st.clone();
      search: for (const al of [5, 3.5, 6.5, 2]) for (const sd of [2.6 * sgn, -2.6 * sgn, 0]) {
        const p = V(cx + DEPTH.x * al + SIDE.x * sd, cz + DEPTH.z * al + SIDE.z * sd);
        if ([0, 1, 2, 3].every((k) => height(p.x + Math.cos(k * 1.57) * 1.7, p.z + Math.sin(k * 1.57) * 1.7) > 0.35)) { fire = p; break search; }
      }
      const seat = (i) => { const a = (i / n) * Math.PI * 2 + 0.4; return safe(fire.clone().add(new T.Vector3(Math.cos(a) * 1.5, 0, Math.sin(a) * 1.5)), z); };
      const sc = new Sc(ev, 8.5, fire.clone().add(UP(1)), 3.5).cast(...ids);
      sc.clear = 6;
      const cf = sc.prop(makeCampfire());
      cf.position.copy(fire);
      cf.scale.setScalar(2);
      sc.on((s) => { cf.userData.flick(now); if (Math.random() < 0.06) burst(fire.clone().add(UP(0.8)), { n: 1, colors: [0xffd23f, 0xff8a3d], speed: 0.3, up: 2, gravity: 0.5, life: 1.2, size: 0.25 }); });
      sc.at(0, () => { live(`Le clan des ${clan} se rassemble pour la veillée…`); ids.forEach((id, i) => { go(id, seat(i), 3); face(id, fire); }); })
        .at(2.0, () => ids.forEach((id) => { pose(id, "sit"); face(id, fire); }));
      const g = giver && ids.includes(giver) ? giver : null;
      if (g) {
        const what = ICON[ev.d?.item] || "💧";
        sc.at(2.6, () => { pose(g, "hold"); say(g, L(ev, r, "meal"), 2.2); icon(g, what, 1.6); });
        ids.filter((id) => id !== g).forEach((id, k) => sc.at(3.8 + k * 0.5, () => icon(id, what, 1.4)));
        sc.at(4.2, () => pose(g, "sit"));
      } else sc.at(2.6, () => { say(ids[0], L(ev, r, "meal"), 2.2); ids.forEach((id) => icon(id, "🍌", 1.4)); });
      sc.at(5.0, () => { live(ev.fr.replace(/^🔥 /, ""), "result"); say(ids[ids.length - 1], L(ev, r, "mealThanks"), 2.2); })
        .at(6.4, () => ids.forEach((id) => pose(id, "cheer", 0.9)))
        .at(7.4, () => ids.forEach((id) => pose(id, "sit")));
      return sc;
    };

    B.defend = (ev) => {
      const [g, a, v] = ev.a, clan = ev.d?.clan;
      if (!vis(g) || !vis(a) || !vis(v)) return null;
      const r = R(ev), st = stageOf(zoneOf(ev)), mid = off(st, 0);
      const sc = new Sc(ev, 9, mid.clone().add(UP(1.2)), 3.2).cast(a, v, g);
      sc.at(0, () => { live(ev.d?.theft ? `${nm(a)} rôde autour du sac ${deN(v)}…` : `${nm(a)} s'en prend à ${nm(v)}…`); go(a, off(st, -1.0), 3); go(v, off(st, 1.0), 3); face(a, v); face(v, a); const far = off(st, 1.5, -4.5); if (people[g].userData.pos.distanceTo(far) > 7) place(g, far); else go(g, far, 3); face(g, v); })
      if (ev.d?.theft) {
        const bag = sc.prop(makeBag()); bag.position.copy(off(st, 0.1, -0.5));
        sc.at(0.1, () => { pose(v, "gather"); face(v, off(st, 6)); })
          .at(1.2, () => { go(a, off(st, -0.5, -0.5), 1.1, "sneak"); say(a, L(ev, r, "sneak"), 2.0, "think"); })
          .at(2.6, () => { face(a, bag.position); pose(a, "grab"); });
      } else {
        sc.at(1.2, () => { pose(a, "argue"); say(a, L(ev, r, "disA"), 2.0, "shout"); iconAt(mid.clone().add(UP(3.1)), "💢", 1.4); })
          .at(2.5, () => { pose(v, "shiver"); icon(v, "😰", 1.6); go(a, off(st, 0.2), 1.2); });
      }
      sc
        .at(3.2, () => { icon(g, "❗", 1.2); go(g, off(st, 0.15, 0.2), 7, "run"); live(`${nm(g)} accourt !`); })
        .at(4.1, () => { face(g, a); pose(g, "push"); say(g, L(ev, r, "defend"), 2.4, "shout"); iconAt(off(st, 0.15).add(UP(3.2)), "🛡️", 2); dust(off(st, -0.3).add(UP(0.3)), 4); go(a, off(st, -2.0), 3); ctx.sfx?.("bonk"); })
        .at(5.8, () => { pose(g, "idle"); pose(a, "idle"); say(a, L(ev, r, "backOff"), 2.0); pose(v, "idle"); face(v, g); })
        .at(6.9, () => { live(ev.fr.replace(/^🛡️ /, ""), "result"); say(v, L(ev, r, "thanks"), 2); go(a, off(st, -5.5), 3); })
        .at(7.8, () => { if (clan) say(g, `Les ${clan}, on se serre les coudes.`, 1.6, "small"); });
      return sc;
    };

    // Une trahison qu'on voit venir : un regard, puis un complot à voix basse
    B.suspicion = (ev) => {
      const [a, b] = ev.a;
      if (!vis(a) || !vis(b)) return null;
      const r = R(ev), st = stageOf(zoneOf(ev));
      const sc = new Sc(ev, 7, () => people[a].position.clone().lerp(people[b].position, 0.35).add(UP(1.2)), 2.9).cast(a, b);
      sc.hidden.add(a);
      sc.at(0, () => { live(`${nm(a)} s'éloigne un peu du clan…`); go(b, off(st, 2.2), 3); pose(b, "gather"); const p = off(st, -2.6, -1.0); if (people[a].userData.pos.distanceTo(p) > 7) place(a, p); else go(a, p, 2.5); })
        .at(1.6, () => { face(a, b); pose(a, "idle"); icon(a, "👀", 2.4); ctx.sfx?.("tension"); })
        .at(2.8, () => say(a, L(ev, r, "suspect"), 2.6, "think"))
        .at(4.6, () => { tag(a); live(ev.fr, "result"); })
        .at(5.4, () => { face(b, a); pose(b, "idle"); icon(b, "❓", 1.4); face(a, off(st, -6)); });
      return sc;
    };

    B.conspire = (ev) => {
      const [a, acc, t] = ev.a;
      if (!vis(a) || !vis(acc)) return null;
      const r = R(ev), st = stageOf(zoneOf(ev));
      const pa = off(st, -0.4), pb = off(st, 0.4), tp = off(st, 3.6, -2.6);
      const sc = new Sc(ev, 8.5, off(st, 0.4, -0.4).add(UP(1.2)), 2.9).cast(a, acc);
      if (vis(t)) { sc.cast(t); sc.hidden.add(t); }
      sc.at(0, () => { live(`${nm(a)} entraîne ${nm(acc)} à l'écart…`); go(a, pa, 2); go(acc, pb, 2); face(a, acc); face(acc, a); if (vis(t)) { const far = people[t].userData.pos.distanceTo(tp) > 7; if (far) place(t, tp); else go(t, tp, 2); pose(t, "gather"); } })
        .at(1.4, () => { pose(a, "sneak"); say(a, L(ev, r, "plot1"), 2.0, "think"); icon(a, "🤫", 1.6); })
        .at(3.0, () => { say(a, `${nm(t)}… il faut s'en méfier.`, 2.4, "think"); if (vis(t)) { pose(a, "point"); iconAt(people[t].position.clone().add(UP(3)), "🎯", 2.0); } ctx.sfx?.("tension"); })
        .at(4.8, () => { pose(a, "idle"); say(acc, L(ev, r, "plot2"), 2.0, "think"); })
        .at(6.2, () => { say(a, L(ev, r, "plot3"), 2.0, "think"); live(ev.fr, "result"); if (vis(t)) { face(t, a); icon(t, "❓", 1.4); } });
      return sc;
    };

    // Coup de théâtre avant le vote : le collier passe d'un cou à l'autre
    B.necklace_gift = (ev) => {
      const [h, m] = ev.a;
      if (!vis(h) || !vis(m)) return null;
      const r = R(ev), c0 = FIRE.clone().addScaledVector(DEPTH, 2.2);
      const sc = new Sc(ev, 8.5, c0.clone().add(UP(1.2)), 3.4).cast(h, m);
      let pend = null, k0 = 0;
      sc.at(0, () => { live(`Juste avant le vote, ${nm(h)} se lève…`); place(m, safe(off(c0, 1.0))); face(m, FIRE); place(h, safe(off(c0, -2.4))); face(h, m); people[h].userData.necklace.visible = true; people[m].userData.necklace.visible = false; })
        .at(1.0, () => { go(h, safe(off(c0, -0.4)), 1.4); say(h, L(ev, r, "neckGift"), 2.6); })
        .at(3.4, () => { pose(h, "hold"); people[h].userData.necklace.visible = false; pend = sc.prop(makeRing(0xe6b84a)); pend.scale.setScalar(0.45); k0 = sc.s; ctx.sfx?.("gasp"); })
        .on((s) => { if (pend) { const k = clamp01((s - k0) / 1.2), a = people[h].position.clone().add(UP(2.6)), b = people[m].position.clone().add(UP(2.0)); pend.position.lerpVectors(a, b, k); pend.position.y += Math.sin(k * Math.PI) * 0.6; if (k >= 1 && pend.visible) { pend.visible = false; people[m].userData.necklace.visible = true; sparkle(b); } } })
        .at(4.8, () => { face(m, h); icon(m, "😮", 1.6); live(ev.fr, "result"); })
        .at(5.8, () => { say(m, L(ev, r, "giftRx"), 2.2); pose(h, "idle"); })
        .at(7.2, () => { pose(m, "shake"); pose(h, "shake"); });
      return sc;
    };

    B.dispute = (ev) => {
      const [a, b] = ev.a;
      if (!vis(a) || !vis(b)) return null;
      const r = R(ev), z = zoneOf(ev), st = stageOf(z), mid = off(st, 0), item = ev.d?.item;
      const sc = new Sc(ev, item ? 12 : 10.5, mid.clone().add(UP(1.2)), 3.3).cast(a, b);
      let crate = null, holder = null;
      sc.at(0, () => { live(`Ça chauffe ${atZone(z)} entre ${nm(a)} et ${nm(b)}…`); go(a, off(st, -0.9), 3); go(b, off(st, 0.9), 3); face(a, b); face(b, a); })
        .at(1.4, () => { pose(a, "argue"); say(a, L(ev, r, "disA"), 2.2, "shout"); })
        .at(2.7, () => { pose(b, "argue"); say(b, L(ev, r, "disB"), 2.2, "shout"); iconAt(mid.clone().add(UP(3.2)), "💢", 1.5); })
        .at(4.0, () => { say(a, L(ev, r, "disA2"), 2, "shout"); });
      if (item) {
        sc.at(4.8, () => { crate = sc.prop(miniCrate()); pose(a, "tug"); pose(b, "tug"); go(a, off(st, -0.7), 1); go(b, off(st, 0.7), 1); live(`Les deux veulent ${ICON[item] || "le colis"}… personne ne lâche !`); });
        sc.on((s) => { if (crate && !holder && s < 6.8) crate.position.copy(off(st, Math.sin(s * 7) * 0.25)).add(UP(1.6)); });
      }
      const T1 = item ? 6.8 : 5.2;
      let puff = 0;
      sc.at(T1, () => { ctx.sfx?.("bonk"); later.push({ at: now + 0.6, fn: () => ctx.sfx?.("bonk") }); pose(a, "panic"); pose(b, "panic"); go(a, off(st, -0.25), 3); go(b, off(st, 0.25), 3); if (crate) crate.visible = false; })
        .on((s, dt) => {
          if (s > T1 && s < T1 + 1.9 && (puff -= dt) < 0) {
            puff = 0.12;
            dust(mid.clone().add(UP(1 + Math.random())), 2);
            if (Math.random() < 0.3) iconAt(mid.clone().add(UP(2 + Math.random())).addScaledVector(SIDE, (Math.random() - 0.5) * 2), ["💥", "💫", "⭐"][Math.floor(Math.random() * 3)], 0.6);
          }
          if (holder && crate) crate.position.copy(people[holder].position).add(UP(3.1));
        })
        .at(T1 + 1.9, () => { go(b, off(st, 1.9), 5, "sit"); pose(b, "sit"); face(b, a); pose(a, item ? "hold" : "cheer"); if (crate) { crate.visible = true; holder = a; } say(b, L(ev, r, "disEnd"), 2.4); live(ev.fr, "result"); })
        .at(T1 + 3.6, () => pose(a, item ? "hold" : "idle"));
      return sc;
    };

    B.steal = (ev) => {
      const [a, b] = ev.a;
      if (!vis(a) || !vis(b)) return null;
      const r = R(ev), d = ev.d || {}, night = isNight(ev.t), st = stageOf(zoneOf(ev));
      const bagP = off(st, 0.2, -0.5);
      const sc = new Sc(ev, d.caught ? 10 : 8.8, off(st, -0.6).add(UP(1.2)), 3.3).cast(a, b);
      const bag = sc.prop(makeBag());
      bag.position.copy(bagP);
      let shake = false;
      sc.on((s) => { bag.rotation.z = shake ? Math.sin(s * 30) * 0.12 : 0; })
        .at(0, () => {
          live(night ? `En pleine nuit, ${nm(a)} rôde près du sac ${deN(b)}…` : `${nm(a)} rôde autour du sac ${deN(b)}…`);
          go(b, off(st, 1.2), 3); pose(b, night ? "sleep" : "gather"); face(b, off(st, 6));
          const start = off(st, -4.6);
          if (people[a].userData.pos.distanceTo(start) > 7) place(a, start); else go(a, start, 3);
        })
        .at(1.2, () => { go(a, off(st, -0.5, -0.5), 1.05, "sneak"); say(a, L(ev, r, "sneak"), 2.4, "think"); })
        .at(5.2, () => { face(a, bagP); pose(a, "grab"); shake = true; if (d.betrayal) { say(a, L(ev, r, "betray"), 2.2, "think"); live(d.clan ? `Trahison en direct : ${nm(a)} vole son propre clan, les ${d.clan}…` : "Trahison en direct : c'est son allié qu'on vole…"); ctx.sfx?.("tension"); } });
      if (d.caught) {
        sc.at(6.0, () => { shake = false; pose(b, "point"); face(b, a); say(b, L(ev, r, "caughtB"), 2.2, "shout"); icon(b, "❗"); })
          .at(7.4, () => { pose(a, "wave"); face(a, b); say(a, L(ev, r, "caughtA"), 2.2); live(ev.fr, "result"); })
          .at(8.8, () => go(a, off(st, -5), 4, "run"));
      } else {
        sc.at(6.0, () => { shake = false; icon(a, ICON[d.item] || "🎒", 2); go(a, off(st, -4.6), 1.8, "sneak"); live(ev.fr, "result"); })
          .at(7.4, () => icon(a, "🤫", 1.5));
      }
      return sc;
    };

    B.sabotage = (ev) => {
      const [a, b] = ev.a;
      if (!vis(a) || !vis(b)) return null;
      const r = R(ev), st = stageOf(zoneOf(ev)), sp = off(st, 1.0, -0.3);
      const sc = new Sc(ev, 10.5, off(st, 0).add(UP(1.2)), 3.2).cast(a, b);
      sc.hidden.add(a);
      const sh = sc.prop(makeShelter());
      sh.position.copy(sp);
      sh.rotation.y = Math.atan2(DEPTH.x, DEPTH.z);
      let k0 = null;
      sc.on((s) => { if (k0 !== null) sh.userData.collapse((s - k0) / 0.7); })
        .at(0, () => { live(`En pleine nuit, une ombre s'approche de l'abri ${deN(b)}…`); place(b, sp.clone().addScaledVector(DEPTH, 0.1)); pose(b, "sleep"); face(b, sp.clone().addScaledVector(SIDE, 3)); place(a, off(st, -5)); icon(b, "💤", 2.4); })
        .at(0.6, () => go(a, sp.clone().addScaledVector(SIDE, -1.5), 1.15, "sneak"))
        .at(3.0, () => icon(b, "💤", 2))
        .at(4.7, () => { face(a, sp); pose(a, "push"); })
        .at(5.2, () => { k0 = 5.2; ctx.sfx?.("crash"); dust(sp.clone().add(UP(0.8)), 10); iconAt(sp.clone().add(UP(2.6)), "💥", 1.2); })
        .at(5.6, () => go(a, off(st, -7), 5, "run"))
        .at(6.4, () => { pose(b, "sit"); icon(b, "❗"); say(b, L(ev, r, "sabWake"), 2.4, "shout"); })
        .at(7.6, () => { tag(a); live(ev.fr, "result"); pose(b, "argue"); face(b, off(st, -7)); });
      return sc;
    };

    // Les accidents de la nature
    // Le catalogue des catastrophes (config/catastrophes.json) : icône, couleur, phrase d'intro, cris
    const CAT = (ev) => D.catastrophes?.[ev.d?.variant] || {};
    const hex = (c, dflt) => (c ? parseInt(c.slice(1), 16) : dflt);
    const intro = (ev, a, dflt) => { const c = CAT(ev); return c.intro ? c.intro.replace("{a}", nm(a)) : dflt; };
    const cry = (ev, r, dflt) => pick(r, CAT(ev).cry || dflt);
    const ico = (ev, dflt) => CAT(ev).icon || dflt;
    const HZ = {};
    HZ.wasps = (ev, a, Rs, r, st) => {
      const sc = new Sc(ev, 8.8, st.clone().add(UP(1.2)), 3.0).cast(a, Rs);
      const v = ev.d?.variant, low = v === "fire_ants";
      const sw = sc.prop(makeSwarm(v === "hornet" ? 6 : 36, hex(CAT(ev).color, 0xffd23f)));
      if (v === "hornet") sw.material.size *= 2.4;
      sc.at(1.0, () => ctx.sfx?.("wasps"));
      const nest = low ? off(st, 1.6, -0.6).add(UP(0.2)) : off(st, 2.5, -1.5).add(UP(2.5));
      const c = nest.clone();
      let flee = false, away = false;
      sc.on((s, dt) => {
        const goal = away ? nest.clone().add(UP(low ? 0 : 4)) : s > 1.4 ? people[a].position.clone().add(UP(low ? 0.6 : 2.3)) : nest;
        c.lerp(goal, 1 - Math.exp(-dt * 4));
        moveSwarm(sw, c, s > 1.4 && !away ? 1.0 : 1.5);
        if (flee) { const ang = s * 2.2; go(a, st.clone().add(new T.Vector3(Math.cos(ang) * 2.2, 0, Math.sin(ang) * 2.2)), 5.5, "panic"); }
      })
        .at(0, () => { live(intro(ev, a, `${nm(a)} s'approche d'un nid de guêpes… mauvaise idée.`)); go(a, st, 3); pose(a, low ? "sit" : "gather"); })
        .at(1.8, () => { icon(a, "❗"); pose(a, "idle"); })
        .at(2.3, () => { say(a, cry(ev, r, SAY.wasps), 2.4, "shout"); flee = true; icon(a, ico(ev, "🐝"), 2); });
      if (Rs) sc.at(4.6, () => { go(Rs, off(st, -1.2), 5, "run"); say(Rs, "Par ici, vite !", 1.8, "shout"); });
      sc.at(6.0, () => { flee = false; away = true; go(a, off(st, 0.3), 3); pose(a, "sit"); icon(a, "😵", 1.6); live(ev.fr, "result"); if (Rs) { face(Rs, a); pose(Rs, "gather"); say(Rs, L(ev, r, "rescue")); } });
      return sc;
    };
    HZ.drowning = (ev, a, Rs, r, st, z) => {
      const w = waterOf(z);
      if (!w) return HZ.fall(ev, a, Rs, r, st);
      const sc = new Sc(ev, Rs ? 12 : 11, focusOn(a, 0.6), 3.0).cast(a, Rs);
      let splashing = false;
      sc.on(() => { if (splashing && Math.random() < 0.25) splash(people[a].position.clone().setY(w.surf + 0.1), 3); })
        .at(0, () => { live(intro(ev, a, `${nm(a)} part se rafraîchir dans l'eau…`)); go(a, w.edge, 3); })
        .at(1.6, () => { swim(a, w.deep, 1.6); splash(w.deep.clone().setY(w.surf + 0.1)); ctx.sfx?.("splash"); })
        .at(3.4, () => {
          const v = ev.d?.variant;
          icon(a, ico(ev, "🌊"));
          live(v === "jellyfish" ? `Une méduse frôle ${nm(a)} !` : v === "rogue_wave" ? `Une vague énorme renverse ${nm(a)} !` : v === "rising_tide" ? `La marée encercle ${nm(a)} !` : v === "flash_flood" ? `L'eau monte d'un coup autour de ${nm(a)} !` : v === "whirlpool" ? `Un tourbillon aspire ${nm(a)} !` : `Le courant emporte ${nm(a)} !`);
          if (v === "rogue_wave") { for (let i = 0; i < 4; i++) splash(people[a].position.clone().setY(w.surf + 0.2 + i * 0.3), 10); ctx.sfx?.("splash"); }
          if (v === "jellyfish") { const j = sc.prop(new T.Mesh(new T.SphereGeometry(0.35, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshLambertMaterial({ color: hex(CAT(ev).color, 0xff9ad5), transparent: true, opacity: 0.8 }))); sc.on(() => j.position.copy(people[a].position).addScaledVector(SIDE, 0.8).setY(w.surf + 0.05 + Math.sin(now * 3) * 0.05)); }
          swim(a, w.far, 0.9, "flail"); pose(a, "flail"); say(a, cry(ev, r, SAY.help), 2.6, "shout"); splashing = true;
        });
      if (Rs) {
        sc.at(5.4, () => { go(Rs, w.edge.clone().addScaledVector(SIDE, 0.8), 6, "run"); say(Rs, "J'arrive !", 1.6, "shout"); })
          .at(6.4, () => { swim(Rs, w.far, 4); })
          .at(8.0, () => { splashing = false; say(Rs, L(ev, r, "rescue"), 2); swim(a, w.edge, 3.2); swim(Rs, w.edge.clone().addScaledVector(SIDE, 0.9), 3.2); })
          .at(10.2, () => { go(a, w.edge, 2); pose(a, "lie"); go(Rs, w.edge.clone().addScaledVector(SIDE, 0.9), 2); face(Rs, a); pose(Rs, "gather"); live(ev.fr, "result"); })
          .at(11.0, () => say(a, L(ev, r, "thanks"), 1.8));
      } else {
        sc.at(6.6, () => { splashing = false; swim(a, w.edge, 2.6); })
          .at(9.4, () => { go(a, w.edge, 2); pose(a, "lie"); icon(a, "😮‍💨", 1.6); live(ev.fr, "result"); });
      }
      return sc;
    };
    HZ.fall = (ev, a, Rs, r, st) => {
      const top = uphill(st, 6), bot = st.clone();
      const steep = top.y - bot.y > 1.2;
      const sc = new Sc(ev, Rs ? 9.6 : 8.8, focusOn(a, 1), 2.8).cast(a, Rs);
      let from = null;
      sc.at(0, () => { live(intro(ev, a, `${nm(a)} s'aventure sur les rochers…`)); if (steep) { place(a, new T.Vector3().lerpVectors(bot, top, 0.35)); go(a, top, 1.6, "climb"); } else go(a, off(st, 1.5), 2); say(a, cry(ev, r, SAY.fall), 2.4, "think"); })
        .at(3.4, () => { icon(a, ico(ev, "❗")); stop(a); pose(a, "panic"); })
        .at(4.0, () => { from = people[a].userData.pos.clone(); })
        .on((s) => { if (from && s < 5.2) { const k = clamp01((s - 4.0) / 1.2); const p = new T.Vector3().lerpVectors(from, bot, k); p.y = lerp(from.y, bot.y, k) + Math.sin(k * Math.PI) * 1.6; place(a, p, true); pose(a, "tumble"); } })
        .at(5.2, () => { from = null; place(a, bot); pose(a, "dizzy"); dust(bot.clone().add(UP(0.3)), 8); icon(a, "💫", 2.2); })
        .at(5.7, () => live(ev.fr, "result"));
      if (Rs) sc.at(6.0, () => { go(Rs, off(bot, 1.1), 5, "run"); say(Rs, "Ne bouge pas !", 1.8, "shout"); })
        .at(7.4, () => { face(Rs, a); pose(Rs, "gather"); say(Rs, L(ev, r, "rescue")); pose(a, "sit"); })
        .at(8.6, () => { pose(a, "idle"); say(a, L(ev, r, "thanks"), 1.6); });
      else sc.at(7.0, () => { pose(a, "sit"); say(a, "Ça va… ça va.", 1.8); });
      return sc;
    };
    HZ.snake = (ev, a, Rs, r, st) => {
      const sc = new Sc(ev, Rs ? 8.6 : 7.6, st.clone().add(UP(1)), 3.4).cast(a, Rs);
      const sn = sc.prop(makeSnake(CAT(ev).color || null, CAT(ev).size || 1));
      const s0 = off(st, 3, 1.2), s1 = off(st, 0.5, 0.2), dir = new T.Vector3().subVectors(s1, s0).setY(0).normalize();
      sc.on((s) => { const k = s < 4.2 ? ease(s / 3.2) : 1 - ease((s - 4.2) / 2); slither(sn, new T.Vector3().lerpVectors(s0, s1, k), s < 4.2 ? dir : dir.clone().negate()); })
        .at(0, () => { live(intro(ev, a, `Quelque chose bouge dans les herbes près de ${nm(a)}…`)); go(a, st, 3); pose(a, "gather"); face(a, off(st, -3)); })
        .at(3.2, () => { icon(a, "❗"); pose(a, "panic"); face(a, s1); say(a, cry(ev, r, SAY.snake), 2.2, "shout"); if ((CAT(ev).size || 1) > 1.4) ctx.sfx?.("bonk"); })
        .at(4.4, () => { pose(a, "sit"); icon(a, ico(ev, "🐍"), 1.6); live(ev.fr, "result"); });
      if (Rs) sc.at(5.0, () => go(Rs, off(st, -1.0), 5, "run")).at(6.3, () => { pose(Rs, "gather"); face(Rs, a); icon(Rs, "🩹"); say(Rs, L(ev, r, "rescue")); });
      return sc;
    };
    HZ.rockslide = (ev, a, Rs, r, st) => {
      const top = uphill(st, 8);
      const sc = new Sc(ev, 8, st.clone().add(UP(1.5)), 2.6).cast(a, Rs);
      const v = ev.d?.variant, nR = v === "statue" || v === "boulder" ? 1 : v === "coconuts" ? 7 : 5;
      const rocks = [...Array(nR)].map((_, i) => { const m = sc.prop(new T.Mesh(v === "coconuts" ? new T.SphereGeometry(0.25, 7, 5) : new T.DodecahedronGeometry(nR === 1 ? 0.9 : 0.35 + (i % 3) * 0.15, 0), mat(hex(CAT(ev).color, 0x8f877d)))); m.castShadow = true; m.userData.j = new T.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2); m.userData.d = i * 0.15; return m; });
      const beyond = st.clone().add(new T.Vector3().subVectors(st, top).setY(0).normalize().multiplyScalar(3));
      sc.on((s) => { for (const m of rocks) { const k = clamp01((s - 0.8 - m.userData.d) / 2.2); const p = new T.Vector3().lerpVectors(top, beyond, k).add(m.userData.j); p.y = ground(p.x, p.z) + 0.3 + Math.abs(Math.sin(k * 10)) * 0.8; m.position.copy(p); m.rotation.x += 0.2; m.rotation.z += 0.15; if (Math.abs(Math.sin(k * 10)) < 0.08 && k > 0 && k < 1) dust(p, 1); } })
        .at(0, () => { live(intro(ev, a, `Un grondement au-dessus de ${nm(a)}…`)); go(a, st, 3); pose(a, "gather"); })
        .at(1.5, () => { icon(a, ico(ev, "❗")); pose(a, "idle"); face(a, top); say(a, cry(ev, r, SAY.rock), 1.6, "shout"); ctx.sfx?.("crash"); })
        .at(2.3, () => go(a, off(st, 2.6), 7, "run"))
        .at(3.0, () => { pose(a, "lie"); dust(off(st, 2.6).add(UP(0.3)), 6); })
        .at(4.2, () => { pose(a, "sit"); icon(a, "😵", 1.6); live(ev.fr, "result"); });
      if (Rs) sc.at(4.8, () => go(Rs, off(st, 3.6), 5, "run")).at(6.0, () => { face(Rs, a); pose(Rs, "gather"); say(Rs, L(ev, r, "rescue")); });
      return sc;
    };
    HZ.fever = (ev, a, Rs, r, st) => {
      const sc = new Sc(ev, Rs ? 7.6 : 6.4, st.clone().add(UP(1)), 3.4).cast(a, Rs);
      sc.at(0, () => { live(intro(ev, a, `${nm(a)} ne se sent pas bien…`)); go(a, st, 2); pose(a, ev.d?.variant === "sunstroke" ? "fan" : "shiver"); icon(a, ico(ev, "🤒"), 2); })
        .at(1.6, () => say(a, cry(ev, r, SAY.fever), 2.4, "think"))
        .at(3.2, () => { pose(a, "lie"); live(ev.fr, "result"); });
      if (Rs) sc.at(3.8, () => go(Rs, off(st, 1.1), 4)).at(5.2, () => { face(Rs, a); pose(Rs, "gather"); icon(Rs, "💧"); say(Rs, "Bois, doucement."); });
      return sc;
    };
    B.hazard = (ev) => {
      const a = ev.a[0], Rs = vis(ev.d?.rescuedBy) ? ev.d.rescuedBy : null;
      if (!vis(a)) return null;
      const z = zoneOf(ev);
      return (HZ[ev.d?.hazard] || HZ.fall)(ev, a, Rs, R(ev), stageOf(z), z);
    };

    B.evacuated = (ev) => {
      const a = ev.a[0], cause = ev.d?.cause;
      if (!vis(a)) return null;
      const r = R(ev);
      const sc = new Sc(ev, 6.2, focusOn(a, 2), 2.8).cast(a);
      if (cause === "withdrawal") {
        sc.at(0, () => { live(`${nm(a)} demande à parler à la production…`); pose(a, "idle"); })
          .at(0.6, () => say(a, L(ev, r, "quit"), 2.4))
          .at(2.0, () => { pose(a, "wave"); evacuate(a, 0.3, "idle"); });
      } else {
        sc.at(0, () => { live(`Le drone de secours décolle pour ${nm(a)}…`); stop(a); pose(a, "lie"); if (["thirst", "hunger", "exhaustion"].includes(cause)) say(a, L(ev, r, "weak"), 2, "think"); })
          .at(1.2, () => evacuate(a, 0, "lie"));
      }
      sc.at(3.2, () => live(ev.fr, "out"));
      return sc;
    };

    // Le colis du spectateur, envoyé depuis la carte : il joue juste après la scène en cours
    function viewerGift(id, item, label) {
      if (!vis(id)) return false;
      const ev = { t: ctx.tick(), type: "gift_delivered", a: [id], d: { item }, w: 2, fr: `Ton colis est arrivé : ${nm(id)} reçoit ${label} !`, viewer: true };
      const sc = giftScene(ev, false, "ok");
      if (!sc) return false;
      sc.at(0, () => { live(`Ton colis survole l'île en direction ${deN(id)}…`, "result"); ctx.sfx?.("whoosh"); })
        .at(4.4, () => { confetti(people[id].position.clone().add(UP(2.5))); ctx.sfx?.("chime"); })
        .at(5.4, () => say(id, "Merci à toi, qui que tu sois !", 2.2));
      sc.dur = 8;
      queue.unshift(sc);
      return true;
    }

    function giftScene(ev, mini, mode) {
      const [a, b] = ev.a;
      if (!vis(a)) return null;
      const r = R(ev), it = ev.d?.item, home = people[a].userData.target.clone();
      const land = mode === "lost" ? off(home, 6, -2) : mode === "inter" && vis(b) ? off(people[b].userData.target, 1.4, 0.5) : off(home, 1.6, 0.6);
      const sc = new Sc(ev, mini ? 4.6 : mode === "inter" ? 8 : 7, land.clone().add(UP(1.5)), 2.9);
      if (!mini) sc.cast(a, mode === "inter" ? b : null);
      const cr = sc.prop(makeCrate());
      const sky = (mode === "lost" ? home.clone() : land.clone()).add(UP(16));
      let opened = null;
      sc.on((s) => {
        const k = clamp01(s / 3);
        cr.position.lerpVectors(sky, land.clone().add(UP(mode === "lost" ? 2.5 : 0.5)), k);
        cr.rotation.z = Math.sin(s * 2) * 0.15 * (1 - k);
        cr.userData.chute.visible = k < 1;
        if (mode === "lost" && k >= 1) cr.visible = false;
        if (opened !== null) cr.scale.setScalar(Math.max(0.01, 1 - (s - opened) * 2));
      });
      sc.at(0, () => { if (!mini) live(`Un colis tombe du ciel pour ${nm(a)}…`); })
        .at(0.8, () => { icon(a, "❗"); if (!mini) face(a, land); });
      if (mode === "lost") {
        sc.at(3.0, () => { if (!mini) { go(a, off(home, 3), 4, "run"); say(a, L(ev, r, "lost"), 2, "shout"); live(ev.fr, "result"); } else icon(a, "😩"); })
          .at(4.6, () => { if (!mini) pose(a, "sit"); });
      } else if (mode === "inter" && vis(b)) {
        sc.at(2.6, () => { if (!mini) go(b, off(land, 0.8), 4, "run"); })
          .at(3.1, () => { dust(land, 6); ctx.sfx?.("thud"); })
          .at(4.2, () => { opened = sc.s; if (!mini) { pose(b, "hold"); face(b, a); say(b, L(ev, r, "interB"), 2.2); live(ev.fr, "result"); go(a, off(land, -1.6), 5, "run"); } icon(b, ICON[it] || "🎁", 2.2); })
          .at(5.8, () => { if (!mini) { pose(a, "argue"); face(a, b); say(a, L(ev, r, "interA"), 2, "shout"); } });
      } else {
        sc.at(3.0, () => { dust(land, 6); if (!mini) ctx.sfx?.("thud"); if (!mini) go(a, off(land, -0.9), 4, "run"); })
          .at(4.3, () => { opened = sc.s; icon(a, ICON[it] || "🎁", mini ? 1.8 : 2.4); if (!mini) { pose(a, "hold"); face(a, off(land, 0, 4)); say(a, L(ev, r, "gift"), 2.2); live(ev.fr, "result"); } });
      }
      return sc;
    }
    B.gift_delivered = (ev, mini) => giftScene(ev, mini, "ok");
    B.gift_lost = (ev, mini) => giftScene(ev, mini, ev.d?.intercepted ? "inter" : "lost");

    B.share = (ev) => {
      const [a, b] = ev.a;
      if (!vis(a) || !vis(b)) return null;
      const r = R(ev), st = stageOf(zoneOf(ev)), what = ev.d?.what === "water" ? "💧" : "🍌";
      return new Sc(ev, 5.8, st.clone().add(UP(1.2)), 3.4).cast(a, b)
        .at(0, () => { live(`${nm(a)} rejoint ${nm(b)}…`); go(a, off(st, -0.6), 3); go(b, off(st, 0.6), 3); face(a, b); face(b, a); })
        .at(1.8, () => { pose(a, "point"); say(a, L(ev, r, "share"), 2.2); icon(a, what); })
        .at(3.2, () => { icon(b, what); pose(a, "idle"); say(b, L(ev, r, "thanks"), 2.2); live(ev.fr, "result"); sparkle(off(st, 0).add(UP(2))); });
    };

    // Épreuves : course, poteaux, grimper, radeau, nage. Le public fait la haie sur la plage.
    function contest(ev, o) {
      const racers = o.racers.filter((id, i, arr) => vis(id) && arr.indexOf(id) === i);
      if (racers.length < 2) return null;
      const n = racers.length, dur = o.dur, snap = ctx.snapAt(ev.t);
      const water = o.mode === "raft" || o.mode === "swim" ? waterOf("beach") : null;
      const m = water ? o.mode : o.mode === "raft" || o.mode === "swim" ? "race" : o.mode;
      const C0 = BEACH_C.clone(), gap = n > 6 ? 1.15 : 1.5;
      const lane = (i) => (i - (n - 1) / 2) * gap;
      let start, end, center;
      if (water) {
        const perp = new T.Vector3(-water.dir.z, 0, water.dir.x);
        start = (i) => water.edge.clone().addScaledVector(perp, lane(i));
        end = (i) => start(i).addScaledVector(water.dir, 9);
        center = water.edge.clone().addScaledVector(water.dir, 4).setY(0.4);
      } else if (m === "race") {
        start = (i) => safe(off(C0, -6, lane(i)));
        end = (i) => safe(off(C0, 6, lane(i)));
        center = C0.clone();
      } else {
        start = end = (i) => safe(off(C0, lane(i) * 1.2, 0));
        center = C0.clone();
      }
      const sc = new Sc(ev, dur, center.clone().add(UP(1.6)), o.zoom || (n > 6 ? 1.9 : 2.3)).cast(...racers);
      // Le public
      const crowd = Object.keys(people).filter((id) => vis(id) && !racers.includes(id) && (snap[id]?.[0] || "beach") === "beach");
      const base = water ? water.edge.clone().addScaledVector(water.dir, -3.2) : C0.clone().addScaledVector(DEPTH, -(n * gap) / 2 - 2.6);
      crowd.forEach((id, k) => {
        const row = Math.floor(k / 12), cols = Math.min(12, crowd.length - row * 12), col = k % 12;
        const p = safe(base.clone().addScaledVector(SIDE, (col - (cols - 1) / 2) * 0.95).addScaledVector(DEPTH, -row * 1.0));
        sc.actors.push(id);
        sc.at(0, () => { go(id, p, 8); face(id, center); });
      });
      sc.on(() => { if (crowd.length && Math.random() < 0.08) pose(crowd[Math.floor(Math.random() * crowd.length)], "cheer", 0.9); });
      // Décor de l'épreuve
      const t0 = 2.4, tWin = dur - 5;
      const ft = racers.map((_, r) => (r === 0 ? tWin : tWin + 0.7 + r * 0.6));
      const prog = (r, s) => { const x = clamp01((s - t0) / (ft[r] - t0)); return r === 0 ? Math.pow(x, 1.4) : r === 1 ? 1 - Math.pow(1 - x, 1.35) : x; };
      const props = racers.map((_, i) => {
        if (m === "pole") { const p = sc.prop(makePole()); p.position.copy(start(i)); return p; }
        if (m === "climb") { const p = sc.prop(makePalm()); p.position.copy(start(i)).addScaledVector(DEPTH, -0.45); return p; }
        if (m === "raft") { const p = sc.prop(makeRaft()); p.position.copy(start(i)); return p; }
        return null;
      });
      if (m === "race") { const f = sc.prop(makeFinish()); f.position.copy(safe(off(C0, 6.6, lane(n - 1) + 0.8))); }
      if (water) { const b = sc.prop(makeBuoy()); b.position.copy(end(Math.floor(n / 2))).addScaledVector(water.dir, 0.8).setY(0.2); }
      sc.at(0, () => {
        live(o.title);
        racers.forEach((id, i) => { place(id, start(i)); face(id, m === "pole" || m === "climb" ? start(i).clone().addScaledVector(DEPTH, 5) : end(i)); pose(id, "idle"); });
      });
      const falls = {};
      if (m === "pole") {
        racers.forEach((id, r) => { if (r > 0) falls[id] = t0 + 1.2 + ((n - 1 - r) / Math.max(1, n - 1)) * (tWin - t0 - 1.6); });
        sc.at(0.9, () => racers.forEach((id, i) => { place(id, start(i).clone().add(UP(2.08)), true); pose(id, "balance"); }));
        racers.forEach((id, r) => { if (r === 0) return; const i = r, t = falls[id]; sc.at(t, () => { icon(id, "❗", 1); if (r <= 2 || n <= 5) live(`${nm(id)} tombe !`); }); });
      }
      sc.on((s) => {
        if (s >= dur - 1.6) return;
        racers.forEach((id, r) => {
          const i = r;
          if (m === "race" || water) {
            if (s < t0) return;
            const k = prog(r, s), p = new T.Vector3().lerpVectors(start(i), end(i), k);
            if (water) { const h = height(p.x, p.z); p.y = m === "raft" ? Math.max(h, 0) + 0.3 : Math.max(h, -1.3); place(id, p, true); pose(id, k >= 1 ? (r === 0 ? "cheer" : "idle") : m === "raft" ? "paddle" : h < -0.4 ? "swim" : "run"); if (props[i]) props[i].position.set(p.x, p.y - 0.15, p.z); if (Math.random() < 0.05 && h < -0.3 && k < 1) splash(p.clone().setY(0.1), 2); }
            else { p.y = ground(p.x, p.z); place(id, p); pose(id, k >= 1 ? (r === 0 ? "cheer" : "idle") : "run"); }
          } else if (m === "climb") {
            if (s < t0) return;
            const k = r === 0 ? prog(0, s) : Math.min(prog(r, s), 0.92 - r * 0.08);
            place(id, start(i).clone().add(UP(k * 3.3)), true);
            pose(id, k >= 1 && r === 0 ? "cheer" : "climb");
          } else if (m === "pole" && falls[id] !== undefined && s >= falls[id] && s < falls[id] + 0.7) {
            const k = (s - falls[id]) / 0.7, top = start(i).clone().add(UP(2.08)), down = off(start(i), 0, 1.1);
            const p = new T.Vector3().lerpVectors(top, down, k); p.y = lerp(top.y, down.y, k) + Math.sin(k * Math.PI) * 0.6;
            place(id, p, true); pose(id, "tumble");
          } else if (m === "pole" && falls[id] !== undefined && s >= falls[id] + 0.7 && !people[id].userData.fallen) {
            people[id].userData.fallen = true; place(id, off(start(i), 0, 1.1)); pose(id, "sit"); dust(off(start(i), 0, 1.1).add(UP(0.3)), 4);
          }
        });
      });
      if (m === "race" || water) sc.at((t0 + tWin) / 2, () => live(`${nm(racers[1])} mène… mais ${nm(racers[0])} revient !`));
      if (m === "climb") sc.at((t0 + tWin) / 2, () => live(`${nm(racers[0])} grimpe comme jamais !`));
      sc.at(tWin + 0.1, () => {
        const w = racers[0];
        if (m === "pole") pose(w, "cheer");
        if (o.necklace) people[w].userData.necklace.visible = true;
        confetti(people[w].position.clone().add(UP(2.5)));
        ctx.sfx?.("fanfare");
        say(w, pick(R(ev), o.winLines || SAY.win), 2.4, "shout");
        live(o.result || ev.fr, "result");
        crowd.forEach((id) => pose(id, "cheer", 2));
      });
      sc.at(dur - 1.6, () => racers.forEach((id, i) => { people[id].userData.fallen = false; if (m === "pole" || m === "climb" || water) place(id, safe(off(start(i), 0, water ? -1.2 : 1.1))); pose(id, id === racers[0] ? "hold" : "idle"); }));
      sc.onEnd = () => racers.forEach((id) => { people[id].userData.fallen = false; });
      o.extra?.(sc, racers, tWin);
      return sc;
    }

    B.challenge = (ev) => {
      const [w, b, c] = ev.a, kind = ev.d?.kind;
      const snap = ctx.snapAt(ev.t);
      const extra = Object.keys(snap).filter((id) => vis(id) && ![w, b, c, ev.d?.last].includes(id)).sort((x, y) => hash(x + ev.t) - hash(y + ev.t))[0];
      const mode = kind === "pole" ? "pole" : kind === "coconut" ? "climb" : kind === "raft" ? "raft" : kind === "chest" ? "swim" : "race";
      return contest(ev, { racers: [w, b, c, extra, ev.d?.last], mode, dur: 16, necklace: true, title: `Épreuve d'immunité : ${CHALLENGE[kind] || kind}. Qui sera protégé ce soir ?` });
    };

    B.trial = (ev) => {
      const w = ev.a[0], kind = ev.d?.kind;
      const losers = D.events.filter((e) => e.t === ev.t && e.type === "evacuated" && e.d?.cause === "trial").map((e) => e.a[0]);
      const before = Object.keys(ctx.snapAt(ev.t - 1)).filter(vis);
      const order = [w, ...before.filter((id) => id !== w && !losers.includes(id)), ...losers];
      const n = losers.length;
      return contest(ev, {
        racers: order, mode: kind === "endurance" ? "pole" : "race", dur: 16,
        title: `Épreuve ${TRIAL[kind] || ""} : ${n} candidat${n > 1 ? "s" : ""} va${n > 1 ? "nt" : ""} devoir partir…`,
        extra: (sc, racers, tWin) => sc.at(tWin + 1.6, () => losers.forEach((id, k) => { if (vis(id)) { evacuate(id, k * 0.6, "idle"); } live(`${list(losers)} quitte${n > 1 ? "nt" : ""} l'île.`, "out"); })),
      });
    };

    B.finale = (ev) => {
      const fin = ev.a, w = D.winner;
      const losers = D.events.filter((e) => e.t === ev.t && e.type === "evacuated" && e.d?.cause === "finale").map((e) => e.a[0]);
      const order = [w, ...fin.filter((id) => id !== w && !losers.includes(id)), ...losers.reverse()];
      const winEv = D.events.find((e) => e.type === "winner");
      return contest(ev, {
        racers: order, mode: "pole", dur: 18, zoom: 2.6,
        title: `Grande finale aux poteaux : ${list(fin)}. Un seul deviendra The Last.`,
        result: winEv ? winEv.fr.replace(/^🏆 /, "") : ev.fr, winLines: ["JE SUIS THE LAST !", "C'est pas de la chance !"],
        extra: (sc, racers, tWin) => sc.on((s) => { if (s > tWin && Math.random() < 0.12) (Math.random() < 0.4 && ctx.sfx?.("pop"), firework(BEACH_C.clone().add(new T.Vector3((Math.random() - 0.5) * 14, 9 + Math.random() * 4, (Math.random() - 0.5) * 10)), [0xff8a3d, 0x62d6a0, 0x7fb0ff, 0xffd23f, 0xff5b6b][Math.floor(Math.random() * 5)])); }),
      });
    };

    B.vote_threat = (ev) => {
      const thr = ev.a.filter(vis);
      if (!thr.length) return null;
      const r = R(ev);
      const savedEv = D.events.find((e) => e.t === ev.t && e.type === "vote_saved");
      const saved = (savedEv?.a || []).filter(vis);
      const outEv = D.events.find((e) => e.t === ev.t && e.type === "evacuated" && e.d?.cause === "vote");
      const out = outEv && vis(outEv.a[0]) ? outEv.a[0] : null;
      const spot = (i) => safe(FIRE.clone().addScaledVector(DEPTH, 2.4).addScaledVector(SIDE, (i - (thr.length - 1) / 2) * 1.8));
      // Les clans plaident pour leurs membres menacés avant le verdict
      const camp = D.events.filter((e) => e.t === ev.t && e.type === "campaign" && vis(e.a[0]) && thr.includes(e.a[1]));
      const K = camp.length * 2.6;
      const sc = new Sc(ev, (out ? 13 : 9.5) + K, FIRE.clone().addScaledVector(DEPTH, 1.6).add(UP(1.2)), 3.0).cast(...thr, ...camp.map((e) => e.a[0]));
      const rings = thr.map((id, i) => { const g = sc.prop(makeRing()); g.position.copy(spot(i)).add(UP(0.08)); return g; });
      sc.at(0, () => { live(`19h, le feu de camp. ${list(thr)} sont menacés…`); thr.forEach((id, i) => { place(id, spot(i)); face(id, spot(i).clone().addScaledVector(DEPTH, 6)); pose(id, "idle"); }); camp.forEach((e) => { const i = thr.indexOf(e.a[1]); place(e.a[0], safe(spot(i).clone().addScaledVector(DEPTH, -1.6))); face(e.a[0], spot(i).clone().addScaledVector(DEPTH, 6)); }); });
      camp.forEach((e, k) => {
        const [v, who] = e.a, i = thr.indexOf(who);
        sc.at(1.4 + k * 2.6, () => { go(v, safe(spot(i).clone().addScaledVector(DEPTH, 0.2).addScaledVector(SIDE, 0.9)), 2.5); live(`${nm(v)} prend la parole pour ${nm(who)}…`); })
          .at(2.4 + k * 2.6, () => { pose(v, "wave", 1.4); say(v, L(ev, r, "plead").replace("{n}", nm(who)), 2.2, "shout"); iconAt(spot(i).clone().add(UP(3.4)), "📣", 1.6); live(e.fr, "result"); });
      });
      sc.at(1.6 + K, () => { live("Le public a voté. Le suspense est total…"); ctx.sfx?.("drum"); })
        .on((s) => { if (s > 1.6 + K && s < 5.4 + K) rings.forEach((g, i) => { g.material.opacity = Math.floor(s * 3) % rings.length === i ? 1 : 0.25; }); });
      saved.forEach((id, k) => sc.at(5.6 + K + k * 1.4, () => {
        const i = thr.indexOf(id);
        rings[i].material.color.setHex(0x62d6a0); rings[i].material.opacity = 1;
        pose(id, "cheer"); say(id, L(ev, r, "saved"), 1.8); sparkle(people[id].position.clone().add(UP(2)));
        if (k === 0 && savedEv) live(savedEv.fr, "result");
        ctx.sfx?.("cheer");
      }));
      if (out) {
        sc.at(8.6 + K, () => { const i = thr.indexOf(out); rings[i].material.color.setHex(0xff5b6b); rings[i].material.opacity = 1; pose(out, "wave"); face(out, FIRE); say(out, L(ev, r, "outVote"), 2.4); live(outEv.fr, "out"); ctx.sfx?.("sad"); })
          .at(10.4 + K, () => evacuate(out, 0, "idle"));
      }
      return sc;
    };

    B.showrunner = (ev) => {
      const kind = ev.d?.kind, z = ev.z || (kind === "drought" ? "waterfall" : "beach"), st = stageOf(z);
      const wide = kind === "storm" || kind === "heatwave";
      const sc = new Sc(ev, 6.5, wide ? new T.Vector3(2, 2, 0) : st.clone().add(UP(1.2)), wide ? 1.25 / S : 2.3);
      sc.at(0, () => live(ev.fr, "sr"));
      const inZone = Object.keys(ctx.snapAt(ev.t)).filter((id) => vis(id) && ctx.snapAt(ev.t)[id][0] === z).slice(0, 10);
      const sv = ev.d?.variant;
      sc.at(0.3, () => iconAt((wide ? new T.Vector3(2, 6, 0) : st.clone().add(UP(4))), ico(ev, "📢"), 3));
      if (kind === "storm" && sv !== "hail" && sv !== "gale") sc.on(() => { if (Math.random() < (sv === "thunderstorm" ? 0.08 : 0.035)) ctx.lightning(); });
      if (sv === "hail") sc.on(() => { if (Math.random() < 0.5) burst(new T.Vector3((Math.random() - 0.5) * 30 * S, 12, (Math.random() - 0.5) * 24 * S), { n: 3, colors: [0xffffff, 0xdff3ff], speed: 0.3, up: 0, gravity: -14, life: 1.2, size: 0.4 }); });
      if (sv === "gale") sc.on(() => { if (Math.random() < 0.2) burst(new T.Vector3((Math.random() - 0.5) * 30 * S, 7, (Math.random() - 0.5) * 24 * S), { n: 1, colors: [0x6b4a2e], speed: 0.5, up: 0, gravity: -12, life: 1, size: 1.2 }); });
      if (kind === "wasp_swarm" && D.catastrophes?.[sv]?.color) { const sw = sc.prop(makeSwarm(60, hex(D.catastrophes[sv].color))); sc.on(() => moveSwarm(sw, st.clone().add(UP(sv === "army_ants" ? 0.2 : 2)), 3.5)); }
      if (kind === "wasp_swarm") {
        inZone.forEach((id, k) => { sc.actors.push(id); sc.on((s) => { if (s > 1 && s < 5.5) { const ang = s * 2 + k; go(id, st.clone().add(new T.Vector3(Math.cos(ang) * (2 + k * 0.4), 0, Math.sin(ang) * (2 + k * 0.4))), 5, "panic"); } }); });
        sc.at(5.6, () => inZone.forEach((id) => { stop(id); pose(id, "sit"); }));
      }
      if (kind === "supply_drop") {
        const cr = sc.prop(makeCrate()), land = off(st, 2, 2);
        sc.on((s) => { const k = clamp01(s / 2.6); cr.position.copy(land).add(UP(0.5 + (1 - k) * 16)); cr.userData.chute.visible = k < 1; });
        sc.at(2.6, () => { dust(land, 8); ctx.sfx?.("thud"); });
        inZone.forEach((id, k) => { sc.actors.push(id); sc.at(1.2 + k * 0.1, () => go(id, off(land, Math.cos(k) * 1.2, Math.sin(k) * 1.2), 5, "run")).at(3.2, () => pose(id, k % 2 ? "tug" : "push")); });
        sc.on((s) => { if (s > 3.2 && s < 5.4 && Math.random() < 0.3) dust(land.clone().add(UP(1)), 1); });
      }
      if (kind === "heatwave") Object.keys(ctx.snapAt(ev.t)).filter(vis).forEach((id) => { sc.actors.push(id); sc.at(0.5, () => pose(id, "fan")); });
      return sc;
    }

    // Une version courte, sans caméra, pour ce qui se passe en même temps ailleurs
    function mini(ev) {
      const a = ev.a[0], b = ev.a[1];
      const sc = new Sc(ev, 3, null);
      switch (ev.type) {
        case "hazard": sc.at(0, () => vis(a) && icon(a, ico(ev, { wasps: "🐝", drowning: "🌊", fall: "💥", snake: "🐍", rockslide: "🪨", fever: "🤒" }[ev.d?.hazard] || "❗"), 2)); break;
        case "steal": sc.at(0, () => { if (ev.d?.caught) vis(b) && icon(b, "❗"); else vis(a) && icon(a, "🤫"); }); break;
        case "alliance": case "clan_join": sc.at(0, () => { vis(a) && icon(a, "🤝"); vis(b) && icon(b, "🤝"); }); break;
        case "clan_meal": sc.at(0, () => ev.a.forEach((id, k) => vis(id) && later.push({ at: now + k * 0.2, fn: () => icon(id, "🔥", 1.8) }))); break;
        case "defend": sc.at(0, () => vis(a) && icon(a, "🛡️", 2)); break;
        case "suspicion": sc.at(0, () => vis(a) && icon(a, "👀", 2)); break;
        case "conspire": sc.at(0, () => { vis(a) && icon(a, "🤫", 2); vis(b) && icon(b, "🤫", 2); }); break;
        case "necklace_gift": sc.at(0, () => { if (vis(a)) people[a].userData.necklace.visible = false; if (vis(b)) { people[b].userData.necklace.visible = true; icon(b, "📿", 2); } }); break;
        case "campaign": sc.at(0, () => vis(a) && icon(a, "📣", 2)); break;
        case "dispute": sc.at(0, () => { vis(a) && icon(a, "💢"); vis(b) && icon(b, "💢"); }); break;
        case "sabotage": sc.at(0, () => vis(b) && icon(b, "💥")); break;
        case "share": sc.at(0, () => vis(b) && icon(b, "💧")); break;
        case "challenge": sc.at(0, () => { if (vis(a)) { icon(a, "🏆", 2.4); people[a].userData.necklace.visible = true; } }); break;
        case "evacuated": sc.at(0.6, () => vis(a) && evacuate(a, 0, "lie")); break;
        case "gift_delivered": return giftScene(ev, true, "ok");
        case "gift_lost": return giftScene(ev, true, ev.d?.intercepted ? "inter" : "lost");
        default: return null;
      }
      return sc;
    }

    // ---------- Les intrigues suivies ----------
    const pairKey = (a, b) => (a < b ? a + "|" + b : b + "|" + a);
    function rivalOf(ev) {
      const f = CONFLICT[ev.type];
      if (!f) return null;
      const pairs = f(ev);
      if (!pairs.length) return null;
      const [a, b] = pairs[0];
      const before = rivalries(D, ev.t - 1).find((r) => r.key === pairKey(a, b));
      return before && before.heat >= 1.5 ? { ...before, a, b } : null;
    }
    const deArt = (w) => (w.startsWith("le ") ? "du " + w.slice(3) : w.startsWith("les ") ? "des " + w.slice(4) : "de " + w);
    const dayTxt = (t) => `jour ${Math.floor(t / 24) + 1}`;
    function recap(ev, rv) {
      const { a, b } = rv;
      if (!vis(a) || !vis(b)) return null;
      const mid = () => people[a].position.clone().lerp(people[b].position, 0.5).add(UP(1.2));
      const sc = new Sc({ ...ev, type: "recap" }, 3.4, mid, 2.6).cast(a, b);
      const ep = rv.n + 1;
      const when = Math.floor(rv.last / 24) === Math.floor(ev.t / 24) ? "plus tôt aujourd'hui" : `au ${dayTxt(rv.last)}`;
      sc.at(0, () => { live(`Épisode ${ep} entre ${nm(a)} et ${nm(b)}. Souvenez-vous ${deArt(rv.lastWhat)}, ${when}…`, "rival"); icon(a, "⚡", 2.6); icon(b, "⚡", 2.6); face(a, b); face(b, a); ctx.sfx?.("tension"); });
      return sc;
    }

    const me = () => ctx.me();
    const FEAT = new Set(D.cast.filter((c) => c.confessions).map((c) => c.id));
    function score(e) {
      const base = { finale: 100, trial: 90, challenge: 80, vote_threat: 75, sabotage: 60, dispute: 55, steal: e.d?.betrayal ? 62 : e.d?.caught ? 45 : 35, necklace_gift: 78, defend: 58, conspire: 50, suspicion: 44, clan_meal: 40, clan_join: 24, hazard: 35 + (e.d?.rescuedBy ? 8 : 0), evacuated: 30, showrunner: 32, alliance: 26, gift_delivered: 8, gift_lost: e.d?.intercepted ? 30 : 14, share: 22 }[e.type];
      if (!base) return 0;
      const rv = rivalOf(e);
      return base + (me() && e.a.includes(me()) ? 100 : 0) + (e.a.some((id) => FEAT.has(id)) ? 12 : 0) + (rv ? Math.min(30, 10 + rv.heat * 4) : 0);
    }

    // only : rediffusion de quelques événements choisis (résumé « ce que tu as raté »)
    function onTick(t, animate, speed = 1, only = null) {
      stageT = t;
      timeScale = speed >= 8 ? 3 : speed >= 3 ? 1.6 : 1;
      assignAmbient(t);
      vignUntil = 0;
      if (!animate) return 0;
      const all = D.events.filter((e) => e.t === t);
      const has = (type) => only && only.some((o) => o.type === type);
      const evs = !only ? all : all.filter((e) => only.includes(e)
        || (has("vote_threat") && ["vote_saved", "campaign", "necklace_gift"].includes(e.type))
        || (e.type === "evacuated" && (has("vote_threat") || has("trial") || has("finale") || only.some((o) => o.type === "hazard" && o.a[0] === e.a[0])))
        || (e.type === "winner" && has("finale")));
      const consumed = new Set();
      for (const e of evs) {
        if (e.type === "vote_threat") evs.forEach((x) => { if (x.type === "vote_saved" || x.type === "campaign" || (x.type === "evacuated" && x.d?.cause === "vote")) consumed.add(x); });
        if (e.type === "trial") evs.forEach((x) => { if (x.type === "evacuated" && x.d?.cause === "trial") consumed.add(x); });
        if (e.type === "finale") evs.forEach((x) => { if (x.type === "winner" || (x.type === "evacuated" && x.d?.cause === "finale")) consumed.add(x); });
      }
      const nMain = only ? 4 : speed >= 8 ? 0 : speed >= 3 ? 1 : 3;
      const cands = evs.filter((e) => !consumed.has(e) && B[e.type] && score(e) > 0 && (!only || only.includes(e) || e.type === "necklace_gift"));
      const chosen = new Set([...cands].sort((x, y) => score(y) - score(x)).slice(0, nMain));
      // Un accident grave enchaîne sur l'évacuation de la même personne
      for (const e of [...chosen]) if (e.type === "hazard") { const out = evs.find((x) => x.type === "evacuated" && x.a[0] === e.a[0]); if (out) chosen.add(out); }
      const built = [];
      for (const e of evs) {
        if (!chosen.has(e)) continue;
        const sc = B[e.type](e, false);
        if (!sc) { chosen.delete(e); continue; }
        const rv = speed < 3 && rivalOf(e);
        const rc = rv && recap(e, rv);
        if (rc) built.push(rc);
        built.push(sc);
      }
      queue = built;
      // Le reste se joue en petit, en même temps
      let k = 0;
      for (const e of evs) {
        if (chosen.has(e)) continue;
        if (consumed.has(e)) {
          if (!chosen.has(evs.find((x) => x.type === "vote_threat" || x.type === "trial" || x.type === "finale"))) { const sc = mini(e); if (sc) { sc.start = now + k++ * 0.4; minis.push(sc); } }
          continue;
        }
        const sc = mini(e);
        if (sc) { sc.start = now + Math.min(3, k++ * 0.45); minis.push(sc); }
      }
      // Personne ne reste sur l'île sans son drone
      later.push({ at: now + 0.1, fn: () => { for (const p of Object.values(people)) if (p.userData.keep && !p.userData.evac && !queue.concat(cur || []).some((sc) => sc.actors.includes(p.userData.id))) evacuate(p.userData.id, 1.5); } });
      return (built.reduce((s, sc) => s + sc.dur, 0) / timeScale) * 1000;
    }

    function endScene(sc, flushing) {
      sc.actors.forEach((id) => { release(id); tag(id, false); });
      sc.props.forEach((o) => scene.remove(o));
      sc.onEnd?.(flushing);
    }
    function flush() {
      if (cur) endScene(cur, true);
      queue.forEach((sc) => endScene(sc, true));
      minis.forEach((sc) => endScene(sc, true));
      cur = null; queue = []; minis = []; later.length = 0;
      for (const p of Object.values(people)) {
        const u = p.userData;
        if (u.evac) { u.evac.d.visible = false; u.evac.d.userData.busy = false; u.evac = null; }
        if (u.keep) { u.keep = false; p.visible = false; }
        u.ctl = null;
        u.fallen = false;
      }
      bubbles.forEach((b) => b.el.remove());
      bubbles.length = 0;
      for (const id of [...tags.keys()]) tag(id, false);
    }

    // ---------- Caméra « réalisateur » ----------
    let vign = null, vignUntil = 0, peekId = null, peekUntil = 0, shot = 0;
    const ZK = 1.22; // les scènes sont filmées un peu plus serré
    function pickVignette() {
      vignUntil = now + 7;
      shot++;
      const ids = Object.keys(people).filter(vis);
      const m = me();
      if (!ids.length) { vign = null; return; }
      if (shot % 4 === 0) {
        vign = null;
        const h = ctx.tick() % 24;
        live(h >= 22 || h < 6 ? `La nuit est tombée sur l'île. ${ids.length} candidats encore en jeu.` : `Vue du ciel : ${ids.length} candidats encore en jeu.`, "ambient");
        return;
      }
      const rv = shot % 4 === 2 ? rivalries(D, ctx.tick()).filter((r) => r.heat >= 3 && vis(r.a) && vis(r.b) && !people[r.a].userData.ctl).sort((x, y) => y.heat - x.heat || y.last - x.last)[0] : null;
      if (rv) {
        vign = rv.a;
        if (people[rv.a].userData.amb && people[rv.a].userData.amb.kind !== "sleep") people[rv.a].userData.amb.faceId = rv.b;
        live(`${nm(rv.a)} n'a pas oublié ${rv.lastWhat} avec ${nm(rv.b)}. ${rv.n} accrochage${rv.n > 1 ? "s" : ""} depuis le ${dayTxt(rv.first)}.`, "ambient");
        return;
      }
      if (m && vis(m) && shot % 2 === 1) vign = m;
      else {
        const busy = ids.filter((id) => ["fish", "gather", "wary", "fire", "lookout"].includes(people[id].userData.amb?.kind));
        const pool = busy.length ? busy : ids;
        vign = pool[(hash(String(shot) + ctx.tick()) % pool.length)];
      }
      live(ambientText(vign), "ambient");
    }
    function focus() {
      if (cur) { const f = typeof cur.focus === "function" ? cur.focus() : cur.focus; return { target: f, zoom: cur.zoom * ZK, drift: false, scene: true }; }
      if (peekId && now < peekUntil && vis(peekId)) return { target: people[peekId].position.clone().add(UP(1.2)), zoom: 3.4, drift: true };
      if (now > vignUntil || (vign && !vis(vign))) pickVignette();
      if (!vign) return { target: new T.Vector3(0, 0, 2), zoom: 1.05 / S, drift: true };
      return { target: people[vign].position.clone().add(UP(1.2)), zoom: 3.0, drift: true };
    }
    function peek(id) { peekId = id; peekUntil = now + 6; if (vis(id)) live(ambientText(id), "ambient"); }

    // ---------- La musique suit la scène ----------
    let moodNow = "calm";
    function moodOf(ev) {
      const m = ["challenge", "trial", "finale"].includes(ev.type) ? "challenge"
        : ["vote_threat", "sabotage", "suspicion", "conspire", "necklace_gift", "dispute", "defend"].includes(ev.type) || (ev.type === "steal" && ev.d?.betrayal) || ev.type === "hazard" ? "tension" : "calm";
      return (moodNow = m);
    }

    // ---------- Boucle ----------
    const tmp = new T.Vector3();
    function runSc(sc, dt) {
      if (!sc.sorted) { sc.steps.sort((a, b) => a[0] - b[0]); sc.sorted = true; }
      sc.s += dt * timeScale;
      while (sc.i < sc.steps.length && sc.steps[sc.i][0] <= sc.s) sc.steps[sc.i++][1]();
      sc.ticks.forEach((f) => f(sc.s, dt * timeScale));
      return sc.s >= sc.dur;
    }
    function update(dt, time, night) {
      now = time;
      for (let i = later.length - 1; i >= 0; i--) if (now >= later[i].at) { const f = later[i].fn; later.splice(i, 1); f(); }
      if (cur && runSc(cur, dt)) { endScene(cur); cur = null; vignUntil = 0; }
      if (!cur && queue.length) { cur = queue.shift(); cur.named.forEach((id) => { if (!cur.hidden.has(id)) tag(id); }); ctx.music?.(moodOf(cur.ev)); }
      else if (!cur && !queue.length && moodNow !== "calm") ctx.music?.((moodNow = "calm"));
      for (let i = minis.length - 1; i >= 0; i--) {
        const sc = minis[i];
        if (now < sc.start) continue;
        if (runSc(sc, dt)) { endScene(sc); minis.splice(i, 1); }
      }
      ambientTick(dt, night);
      updateParticles(dt);
      const fp = cur ? (typeof cur.focus === "function" ? cur.focus() : cur.focus) : null;
      for (const p of Object.values(people)) {
        if (!p.visible) continue;
        const u = p.userData;
        if (u.evac && now >= u.evac.t0) { updateEvac(p, u, dt); continue; }
        const c = u.ctl;
        let target, speed, movePose, restPose, fly = false, faceP = null;
        if (c) {
          if (c.poseUntil && now > c.poseUntil) { c.pose = "idle"; c.poseUntil = 0; }
          target = c.target; speed = c.speed; movePose = c.move; restPose = c.pose; fly = c.fly;
          faceP = c.faceId ? people[c.faceId]?.position : c.face;
        } else {
          const a = u.amb || { kind: "wander", pose: "idle" };
          if (a.kind === "wander" && (!a.next || now > a.next)) { a.next = now + 4 + Math.random() * 4; a.target = u.target.clone().add(new T.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3)); }
          target = a.target || u.target; movePose = "walk";
          restPose = a.cheerUntil > now ? "cheer" : a.pose;
          faceP = a.face || (a.faceId && people[a.faceId]?.visible ? people[a.faceId].position : null);
          const far = tmp.subVectors(target, u.pos).setY(0).length();
          speed = far > 4 ? 6 + far * 1.5 : 1.3;
          // Les curieux regardent l'action, à distance respectueuse
          if (fp) {
            const dd = Math.hypot(u.pos.x - fp.x, u.pos.z - fp.z);
            if (dd < 9 && a.kind !== "sleep") { faceP = fp; if (restPose === "gather" || restPose === "fish") restPose = "idle"; }
            const R0 = cur.clear || 3.8;
            if (dd < R0 && far < R0 + 1.2) { target = u.pos.clone().add(new T.Vector3(u.pos.x - fp.x || 0.1, 0, u.pos.z - fp.z).setLength(R0 + 0.2 - dd)); speed = 3; }
          }
        }
        const d = tmp.subVectors(target, u.pos);
        if (!fly) d.y = 0;
        const dist = d.length(), flat = Math.hypot(d.x, d.z);
        const moving = dist > 0.08;
        let yaw = null;
        if (moving) { if (flat > 0.05) yaw = Math.atan2(d.x, d.z); u.pos.addScaledVector(d.normalize(), Math.min(dist, dt * speed)); }
        if ((!moving || flat < 0.05) && faceP) yaw = Math.atan2(faceP.x - u.pos.x, faceP.z - u.pos.z);
        if (!fly) u.pos.y = ground(u.pos.x, u.pos.z);
        p.position.copy(u.pos);
        if (yaw !== null) p.rotation.y = lerpAngle(p.rotation.y, yaw, 1 - Math.exp(-dt * 10));
        applyPose(p, u, moving ? movePose : restPose);
        if (u.ring.visible) { u.ring.scale.setScalar(1 + Math.sin(time * 4) * 0.12); u.arrow.position.y = Math.sin(time * 3) * 0.15; }
      }
    }

    return { onTick, flush, update, drawOverlays, focus, peek, viewerGift, get busy() { return !!cur || queue.length > 0; } };
  }

  window.World3DScenes = { create };
})();
