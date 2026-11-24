// The Last - Arena Battle : les arènes en 3D low poly (Three.js r128, tout est généré ici).
// Cinq décors (arenas.js) avec leurs lieux, cachettes, dangers et pièges visibles du spectateur.
// Réutilise les personnages de Survivor (avatar.js). Chaque événement du moteur est joué comme un gag :
// BOING, SPLAT, collets, fosses de boue, avalanches de poudreuse, drones d'évacuation et Cage du sursis.
// Expose window.Arena3D = { init(canvas, cast, arena, opts) }.
(function () {
  "use strict";
  const T = window.THREE;
  const t = (s, v) => (window.t ? window.t(s, v) : s);

  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6d2b79f5) >>> 0; let x = s; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  }
  const hash = (s) => [...s].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7);
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const ease = (k) => k * k * (3 - 2 * k);
  const R = 27; // rayon de l'arène

  const matCache = {};
  const mat = (hex, opts = {}) => {
    const key = hex + JSON.stringify(opts);
    return (matCache[key] ??= new T.MeshLambertMaterial({ color: hex, flatShading: true, ...opts }));
  };
  const basic = (hex, opts = {}) => new T.MeshBasicMaterial({ color: hex, ...opts });
  function mesh(geo, hex, opts) { const m = new T.Mesh(geo, typeof hex === "number" ? mat(hex, opts) : hex); m.castShadow = true; m.receiveShadow = true; return m; }
  const box = (w, h, d, hex) => mesh(new T.BoxGeometry(w, h, d), hex);
  const cyl = (r0, r1, h, hex, seg = 8) => mesh(new T.CylinderGeometry(r0, r1, h, seg), hex);
  const ico = (rad, hex, det = 0) => mesh(new T.IcosahedronGeometry(rad, det), hex);
  const flatDisc = (rad, hex, seg = 24, opts) => { const m = new T.Mesh(new T.CircleGeometry(rad, seg).rotateX(-Math.PI / 2), typeof hex === "number" ? mat(hex, opts) : hex); m.receiveShadow = true; return m; };
  const put = (o, x, y, z, ry = 0) => { o.position.set(x, y, z); o.rotation.y = ry; return o; };
  const grp = (...kids) => { const g = new T.Group(); kids.forEach((k) => g.add(k)); return g; };

  // ---------- Décors : chaque accessoire est posé à y = 0 et mesure quelques mètres ----------
  // cover : l'accessoire peut cacher un candidat derrière lui
  const PROPS = {
    // Colisée
    column: () => grp(put(cyl(0.7, 0.8, 3.4, 0x8a93a6), 0, 1.7, 0), put(box(1.8, 0.4, 1.8, 0xa7aec0), 0, 3.5, 0)),
    furnace: () => grp(put(box(2.2, 2.4, 1.8, 0x4a5163), 0, 1.2, 0), put(box(1, 0.8, 0.1, 0xff7a2f), 0, 0.8, 0.91), put(cyl(0.3, 0.3, 1.6, 0x333a48), 0.6, 3, 0)),
    crate: () => grp(put(box(1.2, 1.2, 1.2, 0xb4772f), 0, 0.6, 0), put(box(1.25, 0.2, 1.25, 0x7a4f22), 0, 0.6, 0)),
    pipe: () => grp(put(cyl(0.35, 0.35, 4, 0x7a8396).rotateZ(Math.PI / 2), 0, 0.5, 0)),
    mazewall: () => grp(put(box(3.4, 2.4, 0.5, 0x5a6275), 0, 1.2, 0), put(box(0.5, 2.4, 2.2, 0x5a6275), 1.5, 1.2, 1)),
    ramp: () => { const m = box(3.2, 0.4, 2, 0xff8a3d); m.rotation.z = 0.35; m.position.y = 0.6; return grp(m); },
    foampit: () => grp(put(flatDisc(2.6, 0x2b2f3a), 0, 0.02, 0), ...Array.from({ length: 10 }, (_, i) => put(box(0.5, 0.5, 0.5, [0xff8a3d, 0x7fb0ff, 0xffd166, 0xc08bff][i % 4]), Math.cos(i) * 1.6, 0.25, Math.sin(i * 1.7) * 1.6, i))),
    barrel: () => grp(put(cyl(0.55, 0.55, 1.3, 0xc0392b, 10), 0, 0.65, 0), put(cyl(0.58, 0.58, 0.12, 0x333333, 10), 0, 0.9, 0)),
    bridge: () => grp(put(box(6, 0.25, 1.6, 0x8a6a44), 0, 1.2, 0), put(box(0.2, 1.4, 0.2, 0x5a4a3a), -3, 0.7, 0.8), put(box(0.2, 1.4, 0.2, 0x5a4a3a), 3, 0.7, -0.8), put(box(0.2, 1.4, 0.2, 0x5a4a3a), -3, 0.7, -0.8), put(box(0.2, 1.4, 0.2, 0x5a4a3a), 3, 0.7, 0.8)),
    // Forêt des géants
    rock: () => { const m = ico(1.1, 0x7d8078); m.scale.set(1.2, 0.8, 1); m.position.y = 0.6; return grp(m); },
    fern: () => grp(...[0, 1, 2, 3, 4].map((i) => { const l = box(0.25, 0.05, 1.3, 0x3c8c3a); l.position.set(Math.cos(i * 1.25) * 0.5, 0.45, Math.sin(i * 1.25) * 0.5); l.rotation.set(0.5, i * 1.25, 0); return l; })),
    reed: () => grp(...[0, 1, 2, 3].map((i) => put(cyl(0.04, 0.05, 1.6 + i * 0.2, 0x8aa04a, 4), Math.cos(i * 1.6) * 0.3, 0.8, Math.sin(i * 1.6) * 0.3))),
    flower: () => grp(put(cyl(0.04, 0.04, 0.6, 0x4c8a2f, 4), 0, 0.3, 0), put(ico(0.22, 0xff8ad8), 0, 0.65, 0)),
    stump: () => grp(put(cyl(0.6, 0.7, 0.6, 0x7a5232), 0, 0.3, 0)),
    mushroom: () => { const h = 2.6 + Math.random() * 2.2; return grp(put(cyl(0.35, 0.5, h, 0xf1e6d2), 0, h / 2, 0), put(mesh(new T.SphereGeometry(1.8, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), [0xff5b8a, 0xff6fd8, 0x7fd0ff][Math.floor(Math.random() * 3)]), 0, h - 0.1, 0), put(ico(0.25, 0xffffff), 0.8, h + 0.9, 0.3), put(ico(0.2, 0xffffff), -0.6, h + 1, -0.5)); },
    hollowtree: () => grp(put(cyl(2.2, 3, 6, 0x6b4a2e, 10), 0, 3, 0), put(box(1.6, 2.2, 0.4, 0x2b1d12), 0, 1.1, 2.4), put(ico(3.6, 0x5a3f7a), 0, 7.6, 0), put(ico(2.4, 0x6f4f8f), 2, 6.8, 1)),
    bramble: () => grp(...[0, 1, 2, 3, 4, 5].map((i) => put(mesh(new T.TorusGeometry(0.8, 0.08, 4, 8), 0x3f6b3a), Math.cos(i) * 0.6, 0.7 + (i % 2) * 0.3, Math.sin(i * 1.4) * 0.6, i)), put(ico(0.2, 0x8a1f4a), 0.4, 1.3, 0.2), put(ico(0.2, 0x8a1f4a), -0.5, 1.1, -0.3)),
    web: () => { const g = grp(put(cyl(0.12, 0.12, 4, 0x6b4a2e, 5), -1.6, 2, 0), put(cyl(0.12, 0.12, 4, 0x6b4a2e, 5), 1.6, 2, 0)); const w = new T.Mesh(new T.CircleGeometry(1.7, 8, 0, Math.PI * 2), basic(0xf4f4f4, { wireframe: true })); w.position.set(0, 2.2, 0); g.add(w); return g; },
    syrup: () => grp(put(flatDisc(3.6, 0xd9902f, 24, { transparent: true, opacity: 0.95 }), 0, 0.03, 0), ...[0, 1, 2].map((i) => put(ico(0.22, 0xf0b85a), Math.cos(i * 2) * 1.5, 0.1, Math.sin(i * 2) * 1.5))),
    burrow: () => grp(put(mesh(new T.SphereGeometry(1.4, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), 0x6b5a3e), 0, 0, 0), put(flatDisc(0.6, 0x1d150c, 12), 0, 0.05, 1.3)),
    bigstump: () => grp(put(cyl(1.4, 1.7, 1.8, 0x7a5232, 10), 0, 0.9, 0), put(cyl(1.3, 1.3, 0.05, 0xc49a6c, 10), 0, 1.82, 0), put(ico(0.4, 0xff6fd8), 0.6, 2, 0.4)),
    // Glacier
    igloo: () => grp(mesh(new T.SphereGeometry(3, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xf4fbff), put(box(1.4, 1.4, 1.6, 0xe6f2fa), 0, 0.7, 2.8)),
    icecave: () => grp(put(mesh(new T.SphereGeometry(2.8, 8, 5, 0, Math.PI * 1.3, 0, Math.PI / 2), 0xa9d8f0), 0, 0, 0, 2), put(ico(1, 0xc7ecff), 1.5, 2.6, 0)),
    icespike: () => { const m = mesh(new T.ConeGeometry(0.8, 3.4, 5), 0xbfe6ff); m.position.y = 1.7; return grp(m, put(mesh(new T.ConeGeometry(0.5, 2, 5), 0xd8f2ff), 0.8, 1, 0.3)); },
    pine: () => grp(put(cyl(0.2, 0.25, 1.2, 0x6b4a2e), 0, 0.6, 0), put(mesh(new T.ConeGeometry(1.4, 2.4, 7), 0x2f6b4a), 0, 2.2, 0), put(mesh(new T.ConeGeometry(1, 1.8, 7), 0x3a7d58), 0, 3.4, 0), put(mesh(new T.ConeGeometry(0.6, 0.6, 7), 0xffffff), 0, 4.1, 0)),
    crack: () => grp(put(box(5, 0.04, 0.25, 0x2a5a7a), 0, 0.04, 0, 0.4), put(box(2.4, 0.04, 0.2, 0x2a5a7a), 1.2, 0.04, 0.8, -0.6)),
    floe: () => grp(put(cyl(1.6, 1.7, 0.3, 0xeaf6ff, 7), 0, 0.15, 0)),
    rink: () => grp(put(flatDisc(4, 0x9fd7f5, 32, { transparent: true, opacity: 0.9 }), 0, 0.03, 0)),
    chasm: () => grp(put(box(6, 0.05, 1.6, 0x16324a), 0, 0.03, 0, 0.3), put(box(5.4, 0.6, 0.4, 0xdfeaf2), 0, 0.3, 1, 0.3), put(box(5.4, 0.6, 0.4, 0xdfeaf2), 0, 0.3, -1, 0.3)),
    // Cité
    fountain: () => grp(put(cyl(2.4, 2.6, 0.6, 0x9a948c, 12), 0, 0.3, 0), put(flatDisc(2.1, 0x6fb7d8), 0, 0.62, 0), put(cyl(0.3, 0.4, 1.8, 0x9a948c), 0, 1.2, 0)),
    building: () => { const h = 4 + Math.random() * 3; const g = grp(put(box(3, h, 3, 0x8a7f74), 0, h / 2, 0)); for (let i = 0; i < 3; i++) g.add(put(box(2.4, 0.4, 0.05, 0xffe2a0), 0, 1.2 + i * 1.2, 1.53)); return g; },
    antenna: () => grp(put(cyl(0.05, 0.05, 2.5, 0x444444, 4), 0, 1.25, 0), put(box(1.2, 0.05, 0.05, 0x444444), 0, 2.2, 0)),
    chimney: () => grp(put(box(0.6, 1.5, 0.6, 0xa0523d), 0, 0.75, 0)),
    stall: () => grp(put(box(2.2, 1, 1.2, 0x8a6a44), 0, 0.5, 0), put(box(2.6, 0.12, 1.6, 0xff5b6b), 0, 2, 0), put(box(0.08, 1, 0.08, 0x555555), -1.1, 1.5, 0.6), put(box(0.08, 1, 0.08, 0x555555), 1.1, 1.5, 0.6)),
    leaning: () => { const g = grp(put(box(2.6, 9, 2.6, 0xb0a497), 0, 4.5, 0)); for (let i = 0; i < 5; i++) g.add(put(box(2, 0.35, 0.05, 0xffe2a0), 0, 1.4 + i * 1.6, 1.33)); g.rotation.z = 0.18; return g; },
    manhole: () => grp(put(cyl(0.7, 0.7, 0.06, 0x3a3a3a, 12), 0, 0.03, 0)),
    dumpster: () => grp(put(box(2, 1.2, 1.1, 0x3f7d4f), 0, 0.6, 0), put(box(2.1, 0.12, 1.2, 0x2f5d3f), 0, 1.25, 0)),
    tree: () => grp(put(cyl(0.22, 0.3, 1.8, 0x6b4a2e), 0, 0.9, 0), put(ico(1.3, 0x4f8a3f), 0, 2.4, 0)),
    bench: () => grp(put(box(1.6, 0.12, 0.5, 0x8a6a44), 0, 0.5, 0), put(box(1.6, 0.5, 0.1, 0x8a6a44), 0, 0.8, -0.22)),
    crane: () => grp(put(box(0.5, 7, 0.5, 0xffb020), 0, 3.5, 0), put(box(6, 0.4, 0.4, 0xffb020), 2.5, 7, 0), put(box(0.6, 1, 0.6, 0x7a8396), 5, 5.8, 0)),
    scaffold: () => grp(...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => put(box(0.12, 4, 0.12, 0x9aa3ad), x, 2, z)), put(box(2.4, 0.12, 2.4, 0x8a6a44), 0, 2, 0), put(box(2.4, 0.12, 2.4, 0x8a6a44), 0, 4, 0)),
    // Volcan
    volcano: () => grp(put(cyl(1.4, 4.6, 4, 0x4a3a36, 10), 0, 2, 0), put(cyl(1.2, 1.2, 0.2, 0xff7a2f, 10), 0, 4.02, 0)),
    palm: () => { const g = grp(); for (let i = 0; i < 5; i++) { const s = cyl(0.2, 0.24, 0.9, 0x8a6a44, 5); s.position.set(i * 0.12, 0.45 + i * 0.85, 0); s.rotation.z = -0.08; g.add(s); } for (let i = 0; i < 6; i++) { const l = box(0.35, 0.06, 2, 0x3c9a4a); l.position.set(0.6, 4.4, 0); l.rotation.set(0.5, (i / 6) * Math.PI * 2, 0); g.add(l); } return g; },
    bush: () => grp(put(ico(0.9, 0x3c8c3a), 0, 0.6, 0), put(ico(0.7, 0x4f9e47), 0.7, 0.5, 0.3)),
    ropebridge: () => { const g = grp(); for (let i = -4; i <= 4; i++) g.add(put(box(0.5, 0.12, 1.6, 0x8a6a44), i * 0.6, 0.6 + Math.cos(i / 4) * 0.2 - 0.2, 0)); g.add(put(cyl(0.04, 0.04, 6, 0xc49a6c, 4).rotateZ(Math.PI / 2), 0, 1.4, 0.8), put(cyl(0.04, 0.04, 6, 0xc49a6c, 4).rotateZ(Math.PI / 2), 0, 1.4, -0.8)); return g; },
    lavacave: () => grp(put(mesh(new T.SphereGeometry(2.6, 8, 5, 0, Math.PI * 1.3, 0, Math.PI / 2), 0x4a3a36), 0, 0, 0, 2), put(flatDisc(1.2, basic(0xff7a2f)), 0.5, 0.05, 0.5)),
    geyser: () => grp(put(cyl(0.7, 1, 0.5, 0x6b5a54), 0, 0.25, 0), put(flatDisc(0.6, basic(0xffffff)), 0, 0.52, 0)),
    parasol: () => grp(put(cyl(0.05, 0.05, 2.4, 0xdddddd, 4), 0, 1.2, 0), put(mesh(new T.ConeGeometry(1.4, 0.6, 8), 0xff5b6b), 0, 2.5, 0)),
    hut: () => grp(put(box(2.6, 1.8, 2.2, 0x8a6a44), 0, 0.9, 0), put(mesh(new T.ConeGeometry(2.2, 1.4, 4), 0xc9a35c), 0, 2.5, 0, Math.PI / 4)),
  };
  const COVER = new Set(["column", "furnace", "crate", "mazewall", "barrel", "rock", "icecave", "icespike", "pine", "building", "stall", "dumpster", "palm", "bush", "lavacave", "hut", "reed", "fern", "mushroom", "hollowtree", "bramble", "burrow", "bigstump"]);

  // marqueurs de pièges : ce que le spectateur voit (les candidats non)
  const TRAP_LOOK = {
    net: [0xe9cf98, "net"], banana: [0xffe066, "peel"], spring: [0x9aa3ad, "coil"],
    snare: [0x5fae3b, "ring"], pit: [0x5a3c22, "hole"], acorn: [0x9a6a32, "ball"],
    ice: [0xbfe6ff, "plate"], snowball: [0xffffff, "ball"], hole: [0x16324a, "hole"],
    bucket: [0xff4fb8, "bucket"], manhole: [0x3a3a3a, "plate"], marbles: [0x7fb0ff, "beads"],
    jelly: [0xff7a2f, "hole"], crab: [0xff5b6b, "crab"], rope: [0xc49a6c, "ring"],
  };
  // ce qui arrive au candidat quand il tombe dedans
  const TRAP_ANIM = { net: "lift", snare: "lift", rope: "lift", spring: "launch", crab: "launch", banana: "slip", ice: "slip", marbles: "slip", pit: "sink", hole: "sink", manhole: "sink", jelly: "sink", acorn: "bonk", bucket: "bonk", snowball: "bonk" };
  function trapMarker(kind) {
    const [hex, shape] = TRAP_LOOK[kind] || [0xff5b6b, "plate"];
    const g = new T.Group();
    let o;
    if (shape === "net") o = new T.Mesh(new T.IcosahedronGeometry(0.6, 1), basic(hex, { wireframe: true }));
    else if (shape === "peel") o = mesh(new T.TorusGeometry(0.3, 0.1, 4, 8, Math.PI), hex), o.rotation.x = -Math.PI / 2;
    else if (shape === "coil") o = mesh(new T.TorusGeometry(0.35, 0.08, 4, 10), hex), o.rotation.x = -Math.PI / 2;
    else if (shape === "ring") o = mesh(new T.TorusGeometry(0.55, 0.06, 4, 12), hex), o.rotation.x = -Math.PI / 2;
    else if (shape === "hole") o = flatDisc(0.9, hex, 16);
    else if (shape === "ball") o = ico(0.45, hex), o.position.y = 3;
    else if (shape === "bucket") o = cyl(0.35, 0.28, 0.5, hex), o.position.y = 2.6;
    else if (shape === "beads") { o = new T.Group(); for (let i = 0; i < 8; i++) o.add(put(ico(0.1, hex), Math.cos(i) * 0.5, 0.1, Math.sin(i * 1.3) * 0.5)); }
    else if (shape === "crab") o = grp(put(box(0.5, 0.25, 0.4, hex), 0, 0.15, 0), put(box(0.2, 0.15, 0.15, hex), 0.35, 0.25, 0.2), put(box(0.2, 0.15, 0.15, hex), -0.35, 0.25, 0.2));
    else o = flatDisc(0.7, hex, 12);
    if (o.position.y === 0) o.position.y = Math.max(o.position.y, 0.06);
    g.add(o);
    // halo rouge qui pulse : « attention, piège » (pour le public seulement)
    const halo = new T.Mesh(new T.RingGeometry(0.9, 1.15, 24).rotateX(-Math.PI / 2), basic(0xff3b4e, { transparent: true, opacity: 0.85, depthWrite: false }));
    halo.position.y = 0.05; g.add(halo);
    g.userData.halo = halo;
    return g;
  }

  // ---------- Construction d'une arène ----------
  function buildWorld(scene, A, r) {
    const pal = A.palette;
    const W = { spots: {}, covers: {}, center: A.places[0] };
    // sol
    const base = A.walls === "sea" ? 0x2a6f8f : pal.ground;
    const ground = flatDisc(R + 3, base, 64); scene.add(ground);
    if (A.walls === "sea") {
      const sea = flatDisc(220, basic(0x1f5a78), 48); sea.position.y = -0.05; scene.add(sea);
    }
    // chemins entre les lieux
    const pathHex = A.walls === "sea" ? null : new T.Color(pal.ground2).offsetHSL(0, 0, 0.06).getHex();
    for (const p of A.places) for (const id of p.links) {
      if (id < p.id) continue;
      const q = A.places.find((x) => x.id === id);
      const dx = q.x - p.x, dz = q.z - p.z, len = Math.hypot(dx, dz);
      if (A.walls === "sea") { // ponts de planches entre les îlots
        const b = PROPS.ropebridge(); b.scale.set(len / 5.4, 1, 1); b.position.set((p.x + q.x) / 2, -0.3, (p.z + q.z) / 2); b.rotation.y = -Math.atan2(dz, dx); scene.add(b);
      } else {
        const m = new T.Mesh(new T.PlaneGeometry(len, 1.6).rotateX(-Math.PI / 2), mat(pathHex));
        m.position.set((p.x + q.x) / 2, 0.015, (p.z + q.z) / 2); m.rotation.y = -Math.atan2(dz, dx); m.receiveShadow = true; scene.add(m);
      }
    }
    // le ruisseau (de sirop dans la forêt)
    if (A.water) {
      for (let i = 0; i < A.water.length - 1; i++) {
        const [x0, z0] = A.water[i], [x1, z1] = A.water[i + 1];
        const len = Math.hypot(x1 - x0, z1 - z0);
        const m = new T.Mesh(new T.PlaneGeometry(len + 1.5, 3.2).rotateX(-Math.PI / 2), mat(A.waterColor || 0x4fa3c7, { transparent: true, opacity: 0.9 }));
        m.position.set((x0 + x1) / 2, 0.025, (z0 + z1) / 2); m.rotation.y = -Math.atan2(z1 - z0, x1 - x0); scene.add(m);
      }
    }
    // les lieux
    for (const p of A.places) {
      const isle = A.walls === "sea";
      const patchHex = p.kind === "danger" ? new T.Color(pal.ground2).offsetHSL(0, 0.1, -0.06).getHex() : pal.ground2;
      const patch = isle ? cyl(p === W.center ? 7.5 : 5.6, p === W.center ? 8 : 6.2, 0.6, pal.ground, 12) : flatDisc(p === W.center ? 6.5 : 5.2, patchHex, 28);
      patch.position.set(p.x, isle ? -0.28 : 0.02, p.z);
      if (isle) patch.position.y = -0.3 + 0.3; // le dessus de l'îlot au niveau 0
      scene.add(patch);
      if (isle) patch.position.y = -0.3;
      // slots où les candidats se tiennent
      const slots = [];
      for (let i = 0; i < 14; i++) { const a = i * 2.4, rad = 1.2 + (i % 5) * 0.7; slots.push(new T.Vector3(p.x + Math.cos(a) * rad, 0, p.z + Math.sin(a) * rad)); }
      W.spots[p.id] = slots;
      W.covers[p.id] = [];
      const props = p.props || [];
      props.forEach((name, i) => {
        const f = PROPS[name]; if (!f) return;
        const o = f(r);
        const big = ["igloo", "volcano", "fountain", "rink", "mud", "foampit", "leaning", "icecave", "lavacave", "chasm", "crack", "hollowtree", "syrup"].includes(name);
        const a = (i / Math.max(1, props.length)) * Math.PI * 2 + r() * 0.6;
        const rad = p === W.center || big && props.length === 1 ? 0 : big ? 1.5 : 2.6 + r() * 1.4;
        o.position.set(p.x + Math.cos(a) * rad, 0, p.z + Math.sin(a) * rad);
        if (!big) o.rotation.y = r() * Math.PI * 2;
        o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
        scene.add(o);
        if (COVER.has(name)) {
          // une cachette : derrière l'accessoire, du côté opposé à la caméra
          W.covers[p.id].push(new T.Vector3(o.position.x - 1.1, 0, o.position.z - 1.1));
        }
      });
      if (p === W.center) {
        for (let i = 0; i < 6; i++) { const c = PROPS.crate(); const th = (i / 6) * Math.PI * 2; c.scale.setScalar(0.75); c.position.set(p.x + Math.cos(th) * 4.4, 0, p.z + Math.sin(th) * 4.4); scene.add(c); }
      }
    }
    buildEnclosure(scene, A, r, W);
    return W;
  }

  function buildEnclosure(scene, A, r, W) {
    const pal = A.palette;
    let towersAt = 0;
    if (A.walls === "stadium") {
      const wall = new T.Mesh(new T.CylinderGeometry(R + 1.2, R + 1.2, 3, 64, 1, true), mat(0x6b7489, { side: T.DoubleSide }));
      wall.position.y = 1.5; scene.add(wall);
      const rim = new T.Mesh(new T.RingGeometry(R + 1.2, R + 2.2, 64).rotateX(-Math.PI / 2), mat(pal.accent)); rim.position.y = 3.02; scene.add(rim);
      for (let k = 0; k < 6; k++) {
        const step = new T.Mesh(new T.CylinderGeometry(R + 4 + k * 2.4, R + 4 + k * 2.4, 3.2 + k * 1.6, 64, 1, true), mat(k % 2 ? 0x2a2f3c : 0x323848, { side: T.DoubleSide }));
        step.position.y = (3.2 + k * 1.6) / 2; scene.add(step);
        const top = new T.Mesh(new T.RingGeometry(R + 2.2 + k * 2.4, R + 4 + k * 2.4, 64).rotateX(-Math.PI / 2), mat(k % 2 ? 0x3b4254 : 0x454d61));
        top.position.y = 3.2 + k * 1.6; scene.add(top);
      }
    } else {
      // un mur naturel ou urbain tout autour, plus bas côté caméra pour ne rien cacher
      const n = 46;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const front = Math.cos(a - Math.PI / 4) > 0.55; // côté caméra
        const h = front ? 1.2 + r() : 4 + r() * 4;
        const x = Math.cos(a) * (R + 2), z = Math.sin(a) * (R + 2);
        let o;
        if (A.walls === "forest") { o = cyl(1.4, 1.9, h * 1.6, r() < 0.5 ? 0x5a3f2e : 0x6b4a36, 8); o.position.set(x, (h * 1.6) / 2, z); if (!front && r() < 0.6) { const m = PROPS.mushroom(); m.scale.setScalar(1.6); m.position.set(x * 1.1, 0, z * 1.1); scene.add(m); } }
        else if (A.walls === "icecliffs") { o = mesh(new T.ConeGeometry(2, h, 5), r() < 0.5 ? 0xcfe9f7 : 0xb3dcf0); o.position.set(x, h / 2, z); }
        else if (A.walls === "buildings") { o = box(4, h * 1.4, 3, [0x8a7f74, 0x9a8c7c, 0x7a7068][i % 3]); o.position.set(x, (h * 1.4) / 2, z); o.lookAt(0, o.position.y, 0); }
        else { o = ico(1.8, 0x3b3433); o.scale.set(1.3, h / 4, 1.3); o.position.set(x * 1.15, h / 5 - 0.5, z * 1.15); }
        scene.add(o);
      }
    }
    // le public : en tribune dans le stade, sur des barges flottantes ailleurs
    const N = A.walls === "stadium" ? 1400 : 500;
    const fanGeo = new T.BoxGeometry(0.5, 0.8, 0.5).translate(0, 0.4, 0);
    const fans = new T.InstancedMesh(fanGeo, new T.MeshLambertMaterial({ flatShading: true }), N);
    const baseP = [], m4 = new T.Matrix4(), col = new T.Color();
    const palette = [0xff8a3d, 0x7fb0ff, 0xc08bff, 0x62d6a0, 0xffd166, 0xff5b6b, 0xf2f2f2, 0xe9cf98];
    for (let i = 0; i < N; i++) {
      let x, y, z;
      if (A.walls === "stadium") { const k = Math.floor(r() * 6), th = r() * Math.PI * 2, rad = R + 3.1 + k * 2.4 + r() * 1.2; x = Math.cos(th) * rad; z = Math.sin(th) * rad; y = 3.2 + k * 1.6; }
      else {
        // trois tribunes de bois au loin, côté opposé à la caméra
        const g = i % 3, th = Math.PI + Math.PI / 4 + (g - 1) * 0.75 + (r() - 0.5) * 0.45, rad = R + 9 + (i % 6) * 1.1;
        x = Math.cos(th) * rad; z = Math.sin(th) * rad; y = 1 + (i % 6) * 0.9;
      }
      baseP.push([x, y, z, r() * 6]);
      m4.makeTranslation(x, y, z); fans.setMatrixAt(i, m4);
      fans.setColorAt(i, col.setHex(palette[Math.floor(r() * palette.length)]));
    }
    fans.instanceColor.needsUpdate = true;
    scene.add(fans);
    if (A.walls !== "stadium") for (let g = 0; g < 3; g++) {
      const th = Math.PI + Math.PI / 4 + (g - 1) * 0.75, rad = R + 12;
      const s = box(9, 0.6, 8, 0x5a4a3a); s.position.set(Math.cos(th) * rad, 0.4, Math.sin(th) * rad); s.lookAt(0, 0.4, 0); scene.add(s);
    }
    let excite = 0.3;
    function updateFans(time) {
      for (let i = 0; i < N; i++) {
        const b = baseP[i], j = Math.max(0, Math.sin(time * (6 + excite * 6) + b[3])) * 0.35 * excite;
        m4.makeTranslation(b[0], b[1] + j, b[2]); fans.setMatrixAt(i, m4);
      }
      fans.instanceMatrix.needsUpdate = true;
    }
    // projecteurs
    const towers = [];
    for (let k = 0; k < 4; k++) {
      const th = (k * Math.PI) / 2 + towersAt, rad = R + 15;
      const tw = new T.Group();
      tw.add(put(box(0.8, 16, 0.8, 0x4a5163), 0, 8, 0));
      const head = new T.Mesh(new T.BoxGeometry(3.2, 1.6, 0.6), basic(0xfff6d8)); head.position.y = 16.5; tw.add(head);
      tw.position.set(Math.cos(th) * rad, 0, Math.sin(th) * rad); tw.lookAt(0, 0, 0);
      scene.add(tw); towers.push(head);
    }
    // écrans géants
    const cv = document.createElement("canvas"); cv.width = 512; cv.height = 192;
    const tex = new T.CanvasTexture(cv);
    for (let k = 0; k < 2; k++) {
      const th = (3 * Math.PI) / 4 + k * Math.PI, rad = R + 9;
      const sc = new T.Group();
      sc.add(box(10.6, 4.2, 0.4, 0x1b1f28));
      const face = new T.Mesh(new T.PlaneGeometry(10, 3.75), new T.MeshBasicMaterial({ map: tex })); face.position.z = 0.21; sc.add(face);
      sc.add(put(box(0.5, 13, 0.5, 0x4a5163), 0, -8, -0.3));
      sc.position.set(Math.cos(th) * rad, 15, Math.sin(th) * rad); sc.lookAt(0, 9, 0);
      scene.add(sc);
    }
    const accent = "#" + new T.Color(pal.accent).getHexString();
    function paintScreen(l1, l2) {
      const c = cv.getContext("2d");
      c.fillStyle = "#11141b"; c.fillRect(0, 0, 512, 192);
      c.fillStyle = accent; c.fillRect(0, 0, 512, 10); c.fillRect(0, 182, 512, 10);
      c.textAlign = "center"; c.fillStyle = "#f4ead2";
      c.font = "700 50px 'Chakra Petch', Arial Narrow, sans-serif"; c.fillText(l1, 256, 86);
      c.fillStyle = accent; c.font = "600 32px 'Chakra Petch', Arial Narrow, sans-serif"; c.fillText(l2, 256, 146);
      tex.needsUpdate = true;
    }
    // la Cage du sursis, suspendue au fond, hors de l'arène
    const cage = new T.Group();
    cage.add(cyl(2.8, 2.8, 0.25, 0x5a6275, 16));
    for (let i = 0; i < 18; i++) { const th = (i / 18) * Math.PI * 2; cage.add(put(cyl(0.06, 0.06, 3.4, 0xd9d9d9, 4), Math.cos(th) * 2.7, 1.7, Math.sin(th) * 2.7)); }
    cage.add(put(mesh(new T.ConeGeometry(3.1, 1.2, 16), 0xff5b6b), 0, 4, 0));
    cage.add(put(cyl(0.05, 0.05, 30, 0x222222, 4), 0, 19, 0));
    cage.position.set(-(R + 7) * 0.707, 15, -(R + 7) * 0.707);
    scene.add(cage);
    Object.assign(W, { updateFans, setExcite: (x) => { excite = x; }, paintScreen, cage, towers });
  }

  function makeDrone() {
    const g = new T.Group();
    g.add(box(0.9, 0.3, 0.9, 0xf2f2f2));
    const red = new T.Mesh(new T.BoxGeometry(0.92, 0.08, 0.2), basic(0xff5b6b)); red.position.y = 0.12; g.add(red);
    const rotors = [];
    for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const arm = box(0.08, 0.08, 0.8, 0x333333); arm.position.set(x * 0.45, 0.1, z * 0.45); arm.rotation.y = Math.atan2(x, z); g.add(arm);
      const rot = new T.Mesh(new T.CylinderGeometry(0.4, 0.4, 0.03, 8), basic(0xcccccc, { transparent: true, opacity: 0.5 }));
      rot.position.set(x * 0.7, 0.22, z * 0.7); g.add(rot); rotors.push(rot);
    }
    g.add(put(box(0.12, 0.9, 0.12, 0x333333), 0, -0.55, 0));
    g.scale.setScalar(1.4);
    g.userData.rotors = rotors;
    return g;
  }

  function makePerson(c) {
    const { group, armL, armR, height } = window.TheLastAvatar.build(T, c.look, mat);
    const g = new T.Group(); g.add(group);
    group.rotation.order = "YXZ";
    const s = 1.25 * (height || 1); group.scale.setScalar(s);
    const ringM = new T.Mesh(new T.TorusGeometry(0.85, 0.07, 4, 24).rotateX(Math.PI / 2), basic(0xffd166));
    ringM.position.y = 0.06; ringM.visible = false; g.add(ringM);
    const paint = new T.Group();
    for (let i = 0; i < 7; i++) { const b = new T.Mesh(new T.IcosahedronGeometry(0.16 + (i % 3) * 0.05, 0), mat(0xff4fb8)); b.position.set(Math.sin(i * 2.1) * 0.34, 0.6 + i * 0.22, Math.cos(i * 2.1) * 0.3); paint.add(b); }
    paint.visible = false; paint.scale.setScalar(s); g.add(paint);
    const goo = new T.Mesh(new T.CylinderGeometry(0.55, 0.65, 1.6, 8), mat(0xffffff, { transparent: true, opacity: 0.85 }));
    goo.position.y = 0.8; goo.visible = false; g.add(goo);
    const stars = new T.Group();
    for (let i = 0; i < 4; i++) { const st = new T.Mesh(new T.OctahedronGeometry(0.14, 0), basic(0xffe066)); const th = (i / 4) * Math.PI * 2; st.position.set(Math.cos(th) * 0.5, 0, Math.sin(th) * 0.5); stars.add(st); }
    stars.position.y = 2.75 * s / 1.25; stars.visible = false; g.add(stars);
    const net = new T.Mesh(new T.IcosahedronGeometry(1.15, 1), basic(0xe9cf98, { wireframe: true }));
    net.position.y = 1.2; net.visible = false; g.add(net);
    const shield = new T.Mesh(new T.CylinderGeometry(0.45, 0.45, 0.1, 12).rotateX(Math.PI / 2), mat(0x62d6a0));
    shield.position.set(-0.55, 1.2, 0.2); shield.visible = false; g.add(shield);
    const aura = new T.Group();
    aura.add(new T.Mesh(new T.TorusGeometry(1.1, 0.12, 6, 32).rotateX(Math.PI / 2), basic(0xffd166)));
    const beam = new T.Mesh(new T.CylinderGeometry(1.2, 1.2, 9, 16, 1, true), basic(0xffd166, { transparent: true, opacity: 0.18, side: T.DoubleSide, depthWrite: false }));
    beam.position.y = 4.5; aura.add(beam); aura.visible = false; g.add(aura);
    g.userData = { id: c.id, inner: group, armL, armR, ringM, paint, goo, stars, net, shield, aura, target: new T.Vector3(), speed: 5, scale: s, phase: Math.random() * 6, mode: "idle", nextWander: 0, crouch: 1 };
    return g;
  }

  // =====================================================================
  function init(canvas, cast, A, opts = {}) {
    const isSmall = Math.min(window.innerWidth, window.innerHeight) < 700;
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmall ? 1.75 : 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    const scene = new T.Scene();
    const r = rng(2026);

    const CAM = new T.Vector3(46, 40, 46);
    const camera = new T.OrthographicCamera(-1, 1, 1, -1, -200, 600);
    camera.position.copy(CAM);
    const controls = new T.OrbitControls(camera, canvas);
    Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, minZoom: 0.7, maxZoom: 7, maxPolarAngle: 1.2, minPolarAngle: 0.35, screenSpacePanning: true });
    const VIEW = 66;
    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      const aspect = w / h, span = aspect < 1 ? (VIEW / aspect) * 0.8 : VIEW;
      camera.left = (-span * aspect) / 2; camera.right = (span * aspect) / 2; camera.top = span / 2; camera.bottom = -span / 2;
      camera.updateProjectionMatrix();
    }
    new ResizeObserver(resize).observe(canvas);
    resize();

    const hemi = new T.HemisphereLight(0xcfe3ff, 0x30303a, 0.65); scene.add(hemi);
    const sun = new T.DirectionalLight(0xfff1d6, 0.85);
    sun.castShadow = true; sun.shadow.mapSize.set(isSmall ? 1024 : 2048, isSmall ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, near: 1, far: 200 });
    sun.shadow.bias = -0.0008; sun.position.set(30, 50, 20);
    scene.add(sun, sun.target);
    const flood = new T.PointLight(0xfff0d0, 0, 100); flood.position.set(0, 30, 0); scene.add(flood);

    const W = buildWorld(scene, A, r);
    const PL = Object.fromEntries(A.places.map((p) => [p.id, p]));
    const center = A.places[0];

    // brouillard des lieux fermés
    const fogs = {};
    for (const p of A.places.slice(1)) {
      const f = new T.Mesh(new T.SphereGeometry(6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshLambertMaterial({ color: A.palette.fog, transparent: true, opacity: 0, depthWrite: false }));
      f.position.set(p.x, 0, p.z); f.scale.y = 0.01; scene.add(f); fogs[p.id] = f;
    }
    // cercle d'alerte des dangers annoncés
    const warns = {};
    for (const p of A.places) {
      const m = new T.Mesh(new T.RingGeometry(4.6, 5.2, 40).rotateX(-Math.PI / 2), basic(0xffd166, { transparent: true, opacity: 0, depthWrite: false }));
      m.position.set(p.x, 0.06, p.z); scene.add(m); warns[p.id] = m;
    }

    // candidats
    const people = {}, byId = {};
    cast.forEach((c, i) => {
      const p = makePerson(c);
      people[c.id] = p; byId[c.id] = c;
      const th = (i / cast.length) * Math.PI * 2;
      p.position.set(Math.cos(th) * 12, 0, Math.sin(th) * 12);
      p.userData.target.copy(p.position);
      scene.add(p);
    });

    const drones = [];
    const getDrone = () => { let d = drones.find((x) => !x.userData.busy); if (!d) { d = makeDrone(); d.position.set(0, 60, 0); scene.add(d); drones.push(d); } d.userData.busy = true; return d; };

    // étiquettes, bulles et noms des lieux
    const host = canvas.parentElement;
    const layer = document.createElement("div"); layer.className = "a3-layer"; host.appendChild(layer);
    const tags = {};
    for (const c of cast) {
      const el = document.createElement("div"); el.className = "a3-tag"; el.textContent = c.name; el.hidden = true; layer.appendChild(el);
      tags[c.id] = { el, until: 0 };
    }
    const placeTags = {};
    for (const p of A.places) {
      const el = document.createElement("div"); el.className = "a3-place"; layer.appendChild(el);
      placeTags[p.id] = { el, v: new T.Vector3(p.x, 0.2, p.z + (p === center ? 7 : 5.6)), name: p.name.replace(/^(le |la |les |l'|the )/i, "") };
    }
    const pops = [];
    function pop(id, text, cls = "") {
      const el = document.createElement("div"); el.className = "a3-pop " + cls; el.textContent = text; layer.appendChild(el);
      pops.push({ el, id, born: clock.elapsedTime, life: 1.7, y: 3.2 });
    }
    function popAt(v, text, cls = "") {
      const el = document.createElement("div"); el.className = "a3-pop " + cls; el.textContent = text; layer.appendChild(el);
      pops.push({ el, at: v.clone(), born: clock.elapsedTime, life: 2, y: 2 });
    }
    function showTag(id, sec = 4) { if (tags[id]) tags[id].until = Math.max(tags[id].until, simTime + sec); }

    // ---------- temps ----------
    let speed = 1, paused = false, simTime = 0, slow = 1;
    const clock = new T.Clock();
    const waits = [], tweens = [];
    const wait = (sec) => new Promise((res) => waits.push({ at: simTime + sec, res }));
    function tween(sec, fn) { return new Promise((res) => tweens.push({ t0: simTime, sec, fn, res })); }

    // ---------- caméra ----------
    let me = null, mode = "director", userHold = 0, shake = 0;
    const camGoal = { target: new T.Vector3(0, 2, 0), zoom: 1 };
    controls.addEventListener("start", () => { userHold = clock.elapsedTime + 8; });
    function focus(v, zoom = 2.2) { camGoal.target.set(v.x, 1.5, v.z); camGoal.zoom = zoom; }
    function wide() { camGoal.target.set(0, 2, 0); camGoal.zoom = 1; }

    // ---------- placement ----------
    const where = {}; // id -> { place, hidden }
    function slotFor(id, place, hidden) {
      if (hidden && W.covers[place]?.length) return W.covers[place][hash(id) % W.covers[place].length].clone().add(new T.Vector3((hash(id) % 7) * 0.12 - 0.4, 0, 0));
      const s = W.spots[place];
      return s[hash(id + place) % s.length].clone().add(new T.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5));
    }
    function setCrouch(id, on) { const u = people[id].userData; u.crouch = on ? 0.6 : 1; }
    // déplace chaque candidat vers son lieu (en début d'heure)
    function sync(snap) {
      for (const c of snap.cast) {
        const p = people[c.id], u = p.userData;
        if (c.state !== "in" || u.mode === "gone" || u.mode === "cage" || u.mode === "carried") continue;
        const prev = where[c.id];
        where[c.id] = { place: c.place, hidden: c.hidden };
        if (!prev || prev.place !== c.place || prev.hidden !== c.hidden) {
          u.target.copy(slotFor(c.id, c.place, c.hidden)); u.mode = "idle"; u.nextWander = simTime + 6 + Math.random() * 6;
        }
        setCrouch(c.id, c.hidden);
      }
    }
    function runTo(id, v, sp = 9) {
      const p = people[id]; p.userData.mode = "run"; p.userData.target.copy(v); p.userData.speed = sp;
      return new Promise((res) => { p.userData.arrive = res; });
    }
    const near = (id, other, d = 1.3) => { const a = people[id].position, b = people[other].position; const dir = new T.Vector3().subVectors(a, b).setY(0); if (dir.length() < 0.01) dir.set(1, 0, 0); return b.clone().add(dir.normalize().multiplyScalar(d)); };
    const face = (id, other) => { const a = people[id], b = people[other]; a.userData.inner.rotation.y = Math.atan2(b.position.x - a.position.x, b.position.z - a.position.z); };
    function release(id) { const p = people[id]; if (!p) return; p.userData.mode = "idle"; p.userData.speed = 5; p.userData.nextWander = simTime + 2 + Math.random() * 3; }
    const placeV = (id) => new T.Vector3(PL[id].x, 0, PL[id].z);

    // ---------- pièges visibles ----------
    const traps = {}; // id -> mesh
    function addTrap(tp, at) {
      if (traps[tp.id]) return traps[tp.id];
      const m = trapMarker(tp.kind);
      const p = PL[tp.place], a = (hash(tp.id) % 12) / 12 * Math.PI * 2;
      m.position.copy(at || new T.Vector3(p.x + Math.cos(a) * 2.2, 0, p.z + Math.sin(a) * 2.2));
      scene.add(m); traps[tp.id] = m;
      const el = document.createElement("div"); el.className = "a3-trap"; el.textContent = "⚠"; layer.appendChild(el);
      m.userData.el = el;
      return m;
    }
    function removeTrap(id) { const m = traps[id]; if (!m) return; scene.remove(m); m.userData.el.remove(); delete traps[id]; }
    function syncTraps(list) {
      const ids = new Set(list.map((x) => x.id));
      for (const id of Object.keys(traps)) if (!ids.has(id)) removeTrap(id);
      for (const tp of list) addTrap(tp);
    }

    // ---------- effets des dangers ----------
    async function areaFX(placeId, fx, color) {
      const p = PL[placeId], c = new T.Vector3(p.x, 0, p.z);
      const g = new T.Group(); g.position.copy(c); scene.add(g);
      const parts = [];
      const n = fx === "rise" || fx === "dark" ? 0 : 60;
      for (let i = 0; i < n; i++) {
        const m = new T.Mesh(fx === "swarm" ? new T.OctahedronGeometry(0.18, 0) : new T.IcosahedronGeometry(fx === "fall" ? 0.22 : 0.3, 0), basic(color));
        const a = Math.random() * Math.PI * 2, rad = Math.random() * 5;
        m.userData.p = [Math.cos(a) * rad, Math.sin(a) * rad, Math.random()];
        g.add(m); parts.push(m);
      }
      let disc = null;
      if (fx === "rise" || fx === "dark") {
        disc = new T.Mesh(fx === "dark" ? new T.SphereGeometry(5.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2) : new T.CylinderGeometry(5.4, 5.4, 1, 24), basic(color, { transparent: true, opacity: fx === "dark" ? 0.75 : 0.6, depthWrite: false }));
        g.add(disc);
      }
      if (fx === "shake") shake = 1.2;
      opts.sfx?.(fx === "fall" ? "crash" : fx === "rise" ? "splash" : fx === "burst" ? "whoosh" : fx === "swarm" ? "wasps" : "thud");
      await tween(2.6, (k) => {
        for (const m of parts) {
          const [x, z, q] = m.userData.p;
          if (fx === "burst") m.position.set(x * 0.4 * (1 + k), Math.sin(Math.min(1, k * 1.4 + q * 0.2) * Math.PI) * (6 + q * 5), z * 0.4 * (1 + k));
          else if (fx === "fall") m.position.set(x, Math.max(0.1, 14 * (1 - k * 1.6 - q * 0.4) + 6), z);
          else if (fx === "swarm") m.position.set(Math.cos(k * 12 + q * 6) * (1.5 + q * 3), 1 + q * 2 + Math.sin(k * 20 + q) * 0.4, Math.sin(k * 12 + q * 6) * (1.5 + q * 3));
          else if (fx === "shake") m.position.set(x, Math.abs(Math.sin(k * 30 + q * 6)) * 0.6, z);
        }
        if (disc) { if (fx === "rise") { disc.scale.y = Math.sin(k * Math.PI) * 1.6 + 0.01; disc.position.y = disc.scale.y / 2; } else disc.material.opacity = Math.sin(k * Math.PI) * 0.8; }
      });
      scene.remove(g);
    }

    // ---------- animations d'un candidat ----------
    function swing(id, sec = 0.5) { const u = people[id].userData; return tween(sec, (k) => { u.armR.rotation.x = -Math.sin(k * Math.PI) * 2.4; }); }
    function spin(id, sec = 1) { const u = people[id].userData; const r0 = u.inner.rotation.y; return tween(sec, (k) => { u.inner.rotation.y = r0 + ease(k) * Math.PI * 4; }); }
    function dizzy(id, sec = 2.5) { const u = people[id].userData; u.stars.visible = true; u.dizzyUntil = simTime + sec; }
    function fall(id, sec = 0.4) { const u = people[id].userData; u.lockY = true; return tween(sec, (k) => { u.inner.rotation.x = -ease(k) * 1.45; u.inner.position.y = ease(k) * 0.3; }); }
    function standUp(id, sec = 0.5) { const u = people[id].userData; return tween(sec, (k) => { u.inner.rotation.x = -(1 - ease(k)) * 1.45; u.inner.position.y = (1 - ease(k)) * 0.3; }).then(() => { u.lockY = false; }); }
    const starsLabel = (n) => "★".repeat(n) + "☆".repeat(Math.max(0, 3 - n));
    function projectile(from, to, hex, sec = 0.5, size = 0.25) {
      const m = new T.Mesh(new T.IcosahedronGeometry(size, 0), mat(hex)); scene.add(m);
      const a = people[from].position.clone().setY(1.6), b = people[to].position.clone().setY(1.4);
      return tween(sec, (k) => { m.position.lerpVectors(a, b, k); m.position.y += Math.sin(k * Math.PI) * 2; m.rotation.x += 0.3; }).then(() => scene.remove(m));
    }
    async function lift(id, h = 2.2, hold = 1.2, net = true) {
      const u = people[id].userData; u.lockY = true;
      if (net) u.net.visible = true;
      await tween(0.5, (k) => { u.inner.position.y = ease(k) * h; u.net.position.y = 1.2 + ease(k) * h; u.inner.rotation.x = net ? Math.PI * ease(k) : 0; });
      await wait(hold);
      await tween(0.3, (k) => { u.inner.position.y = (1 - k) * h; u.net.position.y = 1.2 + (1 - k) * h; u.inner.rotation.x = net ? Math.PI * (1 - k) : 0; });
      u.net.visible = false; u.lockY = false;
    }
    async function sink(id, hex) {
      const u = people[id].userData; u.lockY = true;
      u.goo.material = mat(hex, { transparent: true, opacity: 0.85 }); u.goo.visible = true; u.goo.scale.set(1, 0.01, 1);
      await tween(0.6, (k) => { u.inner.position.y = -ease(k) * 1.1; u.goo.scale.y = 0.6; u.goo.position.y = 0.3; });
      await wait(1.2);
      await tween(0.5, (k) => { u.inner.position.y = -(1 - ease(k)) * 1.1; });
      u.goo.visible = false; u.lockY = false;
    }
    async function launch(id) {
      const p = people[id], u = p.userData; u.lockY = true;
      const from = p.position.clone(), to = from.clone().add(new T.Vector3(Math.random() * 4 - 2, 0, Math.random() * 4 - 2));
      await tween(1, (k) => { p.position.lerpVectors(from, to, k); u.inner.position.y = Math.sin(k * Math.PI) * 4; u.inner.rotation.x = k * Math.PI * 2; });
      u.inner.rotation.x = 0; u.inner.position.y = 0; u.lockY = false; u.target.copy(p.position);
    }
    async function bonkFromAbove(id, hex) {
      const p = people[id];
      const m = new T.Mesh(new T.IcosahedronGeometry(0.5, 0), mat(hex)); scene.add(m);
      await tween(0.5, (k) => m.position.set(p.position.x, lerp(9, 2.4, k * k), p.position.z));
      scene.remove(m); opts.sfx?.("bonk"); await spin(id, 0.7);
    }

    async function droneGrab(id, dest) {
      const p = people[id], d = getDrone();
      p.userData.mode = "carried";
      opts.sfx?.("drone");
      const start = new T.Vector3(p.position.x + 8, 26, p.position.z - 8);
      d.position.copy(start);
      const over = p.position.clone().setY(p.position.y + 3.2);
      await tween(1.1, (k) => d.position.lerpVectors(start, over, ease(k)));
      const dFrom = d.position.clone();
      await tween(1.5, (k) => {
        d.position.lerpVectors(dFrom, dest.clone().setY(dest.y + 3.2), ease(k));
        d.position.y += Math.sin(k * Math.PI) * 6;
        p.position.copy(d.position).setY(d.position.y - 3.2);
      });
      p.position.copy(dest);
      d.userData.busy = false; d.position.set(0, 60, 0);
    }
    const cageSlots = [];
    function cageSpot(id) {
      let i = cageSlots.indexOf(id); if (i < 0) { i = cageSlots.indexOf(null); if (i < 0) i = cageSlots.length; cageSlots[i] = id; }
      const th = (i / 8) * Math.PI * 2, rad = i ? 1.6 : 0.2;
      return new T.Vector3(W.cage.position.x + Math.cos(th) * rad, W.cage.position.y + 0.15, W.cage.position.z + Math.sin(th) * rad);
    }
    const inCage = new Set();
    function leaveCage(id) { const i = cageSlots.indexOf(id); if (i >= 0) cageSlots[i] = null; inCage.delete(id); }

    // ---------- jouer un événement ----------
    const KIND_POP = { foam: "BOING !", paint: "SPLAT !", potion: "HIC !", duel: "POW !", finale: "BAM !", hazard: "!!!" };
    const TRAP_POP = { lift: "FLOUMP !", launch: "BOING !", slip: "ZIIIP !", sink: "PLOUF !", bonk: "BONK !" };
    async function play(e) {
      const P = (id) => people[id];
      switch (e.type) {
        case "enter": {
          W.setExcite(1); opts.sfx?.("drum"); wide();
          const ids = Object.keys(people);
          ids.forEach((id, i) => { P(id).position.set(R * 0.7 + ((i % 5) - 2) * 0.9, 0, R * 0.7 + Math.floor(i / 5) * 1.2); });
          await wait(3.5); W.setExcite(0.4);
          break;
        }
        case "loot": {
          const p = P(e.a); focus(p.position, 1.8); showTag(e.a);
          await Promise.race([runTo(e.a, slotFor(e.a, center.id, false)), wait(2.2)]);
          pop(e.a, { foam: "🔨", paint: "🎨", potion: "🧪", shield: "🛡️", map: "🗺️", trap: "🪤" }[e.item] || "📦", "is-item");
          opts.sfx?.("pop");
          if (e.item === "shield") p.userData.shield.visible = true;
          await wait(0.5); release(e.a);
          break;
        }
        case "ally": {
          const a = P(e.a); focus(a.position, 2); showTag(e.a); showTag(e.v);
          await Promise.race([runTo(e.v, near(e.v, e.a, 1.1)), wait(2)]);
          face(e.v, e.a); face(e.a, e.v);
          pop(e.a, "🤝", "is-item"); opts.sfx?.("chime");
          await Promise.all([swing(e.a, 0.4), swing(e.v, 0.4)]);
          release(e.v); release(e.a);
          break;
        }
        case "hide": {
          const p = P(e.a); focus(p.position, 2.4); showTag(e.a, 3);
          await Promise.race([runTo(e.a, slotFor(e.a, e.place, true), 6), wait(2)]);
          setCrouch(e.a, true); where[e.a] = { place: e.place, hidden: true };
          pop(e.a, "🙈", "is-item");
          await wait(0.4);
          break;
        }
        case "trapSet": {
          const p = P(e.a); showTag(e.a, 5);
          const p2 = PL[e.place], a = (hash(e.trap) % 12) / 12 * Math.PI * 2;
          const spot = new T.Vector3(p2.x + Math.cos(a) * 2.2, 0, p2.z + Math.sin(a) * 2.2);
          focus(spot, 2.6);
          await Promise.race([runTo(e.a, spot.clone().add(new T.Vector3(0.9, 0, 0.9)), 8), wait(2.5)]);
          setCrouch(e.a, true);
          await swing(e.a, 0.4); await swing(e.a, 0.4);
          addTrap({ id: e.trap, kind: e.kind, place: e.place }, spot);
          opts.sfx?.("tension");
          popAt(spot, "⚠", "is-trap");
          setCrouch(e.a, false);
          await wait(0.6); release(e.a);
          break;
        }
        case "danger": {
          if (e.quiet) break;
          const v = P(e.v); showTag(e.v, 6);
          const m = traps[e.trap];
          if (m) { focus(m.position, 2.2); m.userData.alarm = simTime + 4; }
          pop(e.v, "⚠ ?", "is-warn");
          await wait(1);
          break;
        }
        case "heed": case "ignore": {
          const v = P(e.v); focus(v.position, 2.4); showTag(e.v, 5);
          pop(e.v, e.type === "heed" ? "😮 !" : "🙉", e.type === "heed" ? "is-gift" : "is-warn");
          if (e.type === "heed") await spin(e.v, 0.6); else await wait(0.8);
          break;
        }
        case "zone": {
          focus(placeV(e.place), 1.6); opts.sfx?.("alert");
          const f = fogs[e.place];
          for (const id of Object.keys(traps)) if (traps[id] && Math.hypot(traps[id].position.x - PL[e.place].x, traps[id].position.z - PL[e.place].z) < 6) removeTrap(id);
          await tween(2, (k) => { f.scale.y = Math.max(0.01, ease(k)); f.material.opacity = 0.55 * ease(k); });
          break;
        }
        case "hazardSoon": {
          warns[e.place].userData.until = simTime + 60;
          placeTags[e.place].soon = true;
          for (const id of e.ids || []) showTag(id, 6);
          if (e.ids?.length) { focus(placeV(e.place), 1.7); await wait(1.2); }
          break;
        }
        case "hazard": {
          focus(placeV(e.place), 1.9);
          warns[e.place].userData.until = 0; placeTags[e.place].soon = false;
          W.setExcite(1);
          for (const id of e.ids) showTag(id, 5);
          await areaFX(e.place, e.fx, e.color);
          W.setExcite(0.4);
          break;
        }
        case "note": {
          if (e.a) { showTag(e.a, 4); pop(e.a, "😎", "is-gift"); }
          await wait(0.3);
          break;
        }
        case "drop": {
          const p = P(e.a); focus(p.position, 2.2); showTag(e.a, 5);
          const c = box(1, 1, 1, 0xffd166);
          const chute = new T.Mesh(new T.SphereGeometry(1.4, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xff5b6b, { side: T.DoubleSide })); chute.position.y = 2.6; c.add(chute);
          scene.add(c); opts.sfx?.("whoosh");
          const at = p.position.clone().add(new T.Vector3(1.2, 0, 0.8));
          await tween(1.8, (k) => { c.position.set(at.x + Math.sin(k * 8) * 0.4, lerp(24, 0.5, ease(k)), at.z); });
          scene.remove(c);
          pop(e.a, { star: "⭐ +1", shield: "🛡️", map: "🗺️" }[e.item] || "📦", "is-gift");
          opts.sfx?.("chime");
          if (e.item === "shield") p.userData.shield.visible = true;
          await wait(0.8);
          break;
        }
        case "found": {
          const v = P(e.v); focus(v.position, 2.6); showTag(e.a); showTag(e.v);
          setCrouch(e.v, false);
          pop(e.v, "👀 !", "is-warn"); opts.sfx?.("gasp");
          await wait(0.6);
          break;
        }
        case "duelStart": {
          W.setExcite(1); opts.sfx?.("drum");
          focus(placeV(center.id), 2.4); showTag(e.a, 8); showTag(e.v, 8);
          const c = placeV(center.id);
          await Promise.all([runTo(e.a, c.clone().add(new T.Vector3(-1.5, 0, 2))), runTo(e.v, c.clone().add(new T.Vector3(1.5, 0, 2)))].map((p) => Promise.race([p, wait(3)])));
          face(e.a, e.v); face(e.v, e.a);
          for (let i = 0; i < 2; i++) { await swing(e.a, 0.35); opts.sfx?.("thud"); await swing(e.v, 0.35); opts.sfx?.("thud"); }
          break;
        }
        case "hit": {
          const v = P(e.v);
          showTag(e.v);
          if (e.a) showTag(e.a);
          if (e.kind === "hazard") {
            focus(v.position, 2.2);
            pop(e.v, "!!!", "is-hit");
            if (e.fx === "rise") await launch(e.v); else if (e.fx === "burst") await lift(e.v, 3.2, 0.6, false); else { await fall(e.v, 0.35); await wait(0.6); await standUp(e.v); }
          } else if (e.kind === "trap") {
            const m = traps[e.trap];
            const spot = m ? m.position.clone() : v.position.clone();
            focus(spot, 2.6);
            setCrouch(e.v, false);
            await Promise.race([runTo(e.v, spot, 6), wait(2.5)]);
            removeTrap(e.trap);
            const anim = TRAP_ANIM[e.trapKind] || "slip";
            pop(e.v, TRAP_POP[anim], "is-hit");
            if (anim === "lift") { opts.sfx?.("whoosh"); await lift(e.v); }
            else if (anim === "launch") { opts.sfx?.("bonk"); await launch(e.v); }
            else if (anim === "sink") { opts.sfx?.("splash"); await sink(e.v, (TRAP_LOOK[e.trapKind] || [0x6b4a2e])[0]); }
            else if (anim === "bonk") await bonkFromAbove(e.v, (TRAP_LOOK[e.trapKind] || [0xffffff])[0]);
            else { await fall(e.v, 0.35); opts.sfx?.("bonk"); await wait(0.8); await standUp(e.v); }
            W.setExcite(1); opts.sfx?.("cheer");
            if (e.a && P(e.a).visible) { showTag(e.a, 4); pop(e.a, "😈", "is-item"); }
          } else {
            const a = P(e.a);
            focus(v.position, 2.4);
            if (e.kind === "betray") { slow = 0.45; pop(e.a, t("TRAHISON !"), "is-betray"); opts.sfx?.("gasp"); }
            setCrouch(e.v, false);
            if (e.kind !== "paint" && e.kind !== "duel") await Promise.race([runTo(e.a, near(e.a, e.v, 1.2), 10), wait(2)]);
            face(e.a, e.v);
            if (e.kind === "paint") {
              await Promise.race([runTo(e.a, near(e.a, e.v, 5), 10), wait(1.5)]); face(e.a, e.v);
              await projectile(e.a, e.v, 0xff4fb8, 0.5);
              v.userData.paint.visible = true; v.userData.paintUntil = simTime + 25;
              opts.sfx?.("splash");
            } else if (e.kind === "potion") {
              await projectile(e.a, e.v, 0x62d6a0, 0.45, 0.18);
              const u = v.userData;
              await tween(1.6, (k) => { const w2 = 1 + Math.sin(k * 30) * 0.12 * (1 - k); u.inner.scale.set(u.scale * w2, u.scale * (2 - w2), u.scale * w2); });
              u.inner.scale.setScalar(u.scale);
            } else { await swing(e.a, 0.4); opts.sfx?.("bonk"); await spin(e.v, 0.8); }
            if (e.kind !== "betray") pop(e.v, KIND_POP[e.kind] || "POW !", "is-hit");
            if (e.kind === "betray") slow = 1;
            release(e.a);
          }
          pop(e.v, starsLabel(e.stars), "is-stars");
          dizzy(e.v);
          await wait(0.5);
          W.setExcite(0.4);
          break;
        }
        case "block": case "dodge": {
          const v = P(e.v); focus(v.position, 2.3); showTag(e.a); showTag(e.v);
          if (e.type === "dodge") {
            const m = traps[e.trap]; if (m) await Promise.race([runTo(e.v, m.position.clone(), 6), wait(2)]);
            removeTrap(e.trap);
            pop(e.v, t("🗺️ ÉVITÉ !"), "is-gift"); opts.sfx?.("pop");
          } else {
            await Promise.race([runTo(e.a, near(e.a, e.v, 1.3), 10), wait(2)]);
            face(e.a, e.v); await swing(e.a, 0.4);
            pop(e.v, t("🛡️ BLOQUÉ !"), "is-gift"); opts.sfx?.("pop");
            v.userData.shield.visible = false;
            await spin(e.a, 0.6); release(e.a);
          }
          break;
        }
        case "ko": case "out": {
          const fromCage = inCage.has(e.v);
          const v = P(e.v);
          showTag(e.v, 6);
          if (!fromCage) {
            focus(v.position, 2.2);
            await fall(e.v, 0.4);
            pop(e.v, t("HORS JEU"), "is-ko");
            W.setExcite(1); opts.sfx?.("cheer");
            await wait(0.6);
          } else focus(W.cage.position, 1.6);
          v.userData.inner.rotation.x = 0; v.userData.inner.position.y = 0; v.userData.lockY = false; setCrouch(e.v, false);
          if (e.type === "ko") {
            await droneGrab(e.v, cageSpot(e.v));
            v.userData.mode = "cage"; inCage.add(e.v);
          } else {
            const th = Math.random() * Math.PI * 2;
            await droneGrab(e.v, new T.Vector3(Math.cos(th) * (R + 40), 30, Math.sin(th) * (R + 40)));
            v.visible = false; v.userData.mode = "gone"; leaveCage(e.v);
            opts.sfx?.("sad");
          }
          delete where[e.v];
          W.setExcite(0.4);
          break;
        }
        case "vote": {
          focus(W.cage.position, 1.6);
          const v = P(e.saved);
          pop(e.saved, t("SAUVÉ·E !"), "is-gift"); opts.sfx?.("fanfare"); W.setExcite(1);
          await wait(0.8);
          await droneGrab(e.saved, slotFor(e.saved, center.id, false));
          leaveCage(e.saved); release(e.saved);
          where[e.saved] = { place: center.id, hidden: false };
          W.setExcite(0.4);
          break;
        }
        case "finale": {
          focus(placeV(center.id), 1.8); W.setExcite(1); opts.sfx?.("drum");
          for (const id of Object.keys(traps)) removeTrap(id);
          for (const id of e.ids) { setCrouch(id, false); runTo(id, slotFor(id, center.id, false), 6).then(() => release(id)); showTag(id, 30); }
          await wait(2.5);
          break;
        }
        case "win": {
          const p = P(e.a); p.visible = true;
          focus(p.position, 3); p.userData.aura.visible = true; showTag(e.a, 9999);
          await Promise.race([runTo(e.a, placeV(center.id).add(new T.Vector3(0, 0, 3)), 5), wait(3)]);
          confetti(); opts.sfx?.("fanfare"); W.setExcite(1.4);
          pop(e.a, "🏆", "is-gift");
          await wait(2);
          break;
        }
        default: await wait(0.2);
      }
    }

    let conf = null;
    function confetti() {
      const n = 500, geo = new T.PlaneGeometry(0.35, 0.2), m = new T.MeshBasicMaterial({ side: T.DoubleSide });
      conf = new T.InstancedMesh(geo, m, n);
      const col = new T.Color(), palC = [0xffd166, 0xff5b6b, 0x7fb0ff, 0x62d6a0, 0xc08bff, 0xff8a3d];
      conf.userData.p = [];
      for (let i = 0; i < n; i++) { conf.setColorAt(i, col.setHex(palC[i % palC.length])); conf.userData.p.push([(Math.random() - 0.5) * 40, 20 + Math.random() * 25, (Math.random() - 0.5) * 40, Math.random() * 6]); }
      conf.instanceColor.needsUpdate = true;
      scene.add(conf);
    }

    // ---------- heure du jour ----------
    const sky = new T.Color(A.palette.sky);
    const SKY = [[6, 0x223049, 0.3], [9, sky.getHex(), 1], [16, sky.getHex(), 1], [19, 0xe07a4f, 0.65], [20.5, 0x2a2550, 0.35], [23, 0x0b1020, 0.25]];
    function setHour(day, hour) {
      let c = new T.Color(0x0b1020), l = 0.25;
      for (let i = 0; i < SKY.length - 1; i++) {
        const [h0, c0, l0] = SKY[i], [h1, c1, l1] = SKY[i + 1];
        if (hour >= h0 && hour <= h1) { const k = (hour - h0) / (h1 - h0); c = new T.Color(c0).lerp(new T.Color(c1), k); l = lerp(l0, l1, k); }
      }
      scene.background = c;
      hemi.intensity = 0.25 + 0.45 * l; sun.intensity = 0.15 + 0.75 * l;
      const night = l < 0.7;
      flood.intensity = night ? 1.1 : 0;
      for (const tw of W.towers) tw.material.color.setHex(night ? 0xfff6d8 : 0x9aa3ad);
    }
    function setClosed(list) { for (const id of list) { if (fogs[id]) { fogs[id].scale.y = 1; fogs[id].material.opacity = 0.55; } } }
    function setFavorite(id) {
      if (me && people[me]) { people[me].userData.ringM.visible = false; tags[me].el.classList.remove("is-me"); }
      me = id;
      if (me && people[me]) { people[me].userData.ringM.visible = true; tags[me].el.classList.add("is-me"); }
    }
    function setMode(m) { mode = m; if (m === "follow" && me) focus(people[me].position, 2.6); }
    function setHazards(list) { for (const h of list) if (h.hour === undefined) continue; }

    const ray = new T.Raycaster(), mouse = new T.Vector2();
    canvas.addEventListener("click", (ev) => {
      const rc = canvas.getBoundingClientRect();
      mouse.set(((ev.clientX - rc.left) / rc.width) * 2 - 1, -((ev.clientY - rc.top) / rc.height) * 2 + 1);
      ray.setFromCamera(mouse, camera);
      const hits = ray.intersectObjects(Object.values(people).filter((p) => p.visible), true);
      if (hits.length) { let o = hits[0].object; while (o && !o.userData.id) o = o.parent; if (o) opts.onPick?.(o.userData.id); }
    });

    // ---------- boucle ----------
    const v3 = new T.Vector3();
    function frame() {
      requestAnimationFrame(frame);
      const rdt = Math.min(clock.getDelta(), 0.05);
      const dt = paused ? 0 : rdt * speed * slow;
      simTime += dt;
      const time = clock.elapsedTime;
      for (let i = waits.length - 1; i >= 0; i--) if (simTime >= waits[i].at) { waits[i].res(); waits.splice(i, 1); }
      for (let i = tweens.length - 1; i >= 0; i--) {
        const w = tweens[i], k = clamp((simTime - w.t0) / w.sec, 0, 1);
        w.fn(k); if (k >= 1) { tweens.splice(i, 1); w.res(); }
      }
      for (const id in people) {
        const p = people[id], u = p.userData;
        if (u.mode === "gone" || u.mode === "carried") continue;
        if (u.mode === "cage") { p.position.copy(cageSpot(id)); u.inner.rotation.y += dt * 0.4; continue; }
        const w0 = where[id];
        if (u.mode === "idle" && w0 && !w0.hidden && simTime > u.nextWander) { u.target.copy(slotFor(id, w0.place, false)); u.nextWander = simTime + 4 + Math.random() * 6; }
        v3.subVectors(u.target, p.position).setY(0);
        const d = v3.length(), moving = d > 0.15;
        if (moving) {
          p.position.addScaledVector(v3.normalize(), Math.min(d, u.speed * dt));
          u.inner.rotation.y = Math.atan2(v3.x, v3.z);
        } else if (u.arrive) { const f = u.arrive; u.arrive = null; f(); }
        if (u.armL) u.armL.rotation.x = moving ? Math.sin(simTime * 12 + u.phase) * 0.6 : 0;
        if (!u.lockY) u.inner.position.y = moving ? Math.abs(Math.sin(simTime * 12 + u.phase)) * 0.12 : 0;
        u.inner.scale.y = lerp(u.inner.scale.y, u.scale * u.crouch, 0.2);
        if (u.stars.visible) { u.stars.rotation.y += rdt * 6; if (simTime > u.dizzyUntil) u.stars.visible = false; }
        if (u.paint.visible && simTime > u.paintUntil) u.paint.visible = false;
        if (u.aura.visible) u.aura.rotation.y += rdt;
      }
      for (const d of drones) for (const ro of d.userData.rotors) ro.rotation.y += rdt * 30;
      W.cage.rotation.y += rdt * 0.15;
      W.updateFans(time);
      for (const id in traps) { const m = traps[id], k = m.userData.alarm > simTime ? 10 : 3; m.userData.halo.material.opacity = 0.45 + Math.sin(time * k) * 0.4; m.userData.halo.scale.setScalar(1 + Math.max(0, Math.sin(time * k)) * 0.25); }
      for (const id in warns) { const m = warns[id]; m.material.opacity = (m.userData.until || 0) > simTime ? 0.5 + Math.sin(time * 6) * 0.35 : 0; }
      if (conf) {
        const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), sc = new T.Vector3(1, 1, 1), pos = new T.Vector3();
        conf.userData.p.forEach((c, i) => { c[1] -= rdt * 4; if (c[1] < 0) c[1] = 30; c[3] += rdt * 4; e.set(c[3], c[3] * 0.7, 0); q.setFromEuler(e); pos.set(c[0] + Math.sin(c[3]) * 0.6, c[1], c[2]); m4.compose(pos, q, sc); conf.setMatrixAt(i, m4); });
        conf.instanceMatrix.needsUpdate = true;
      }
      if (clock.elapsedTime > userHold) {
        if (mode === "follow" && me && people[me]?.visible) { const p = people[me].position; camGoal.target.set(p.x, Math.max(1.5, p.y + 1.5), p.z); camGoal.zoom = Math.max(camGoal.zoom, 2.4); }
        if (mode === "wide") { camGoal.target.set(0, 2, 0); camGoal.zoom = 1; }
        const k = 1 - Math.pow(0.05, rdt);
        controls.target.lerp(camGoal.target, k);
        camera.zoom = lerp(camera.zoom, camGoal.zoom, k);
        camera.position.copy(controls.target).add(CAM);
        if (shake > 0) { shake = Math.max(0, shake - rdt); camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; }
        camera.updateProjectionMatrix();
      }
      controls.update();
      renderer.render(scene, camera);
      // étiquettes
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const placeAt = (el, v, y) => { v3.copy(v); v3.y += y; v3.project(camera); el.style.transform = `translate(${((v3.x + 1) / 2) * w}px, ${((1 - v3.y) / 2) * h}px) translate(-50%, -100%)`; };
      for (const id in tags) {
        const tg = tags[id], p = people[id];
        const show = p.visible && p.userData.mode !== "gone" && (id === me || simTime < tg.until);
        tg.el.hidden = !show;
        if (show) placeAt(tg.el, p.position, 2.9 * p.userData.scale / 1.25 * p.userData.crouch + p.userData.inner.position.y);
      }
      for (const id in placeTags) {
        const pt = placeTags[id];
        const nTraps = Object.values(traps).filter((m) => Math.hypot(m.position.x - PL[id].x, m.position.z - PL[id].z) < 5).length;
        const label = `${pt.name}${nTraps ? " · ⚠" + (nTraps > 1 ? "×" + nTraps : "") : ""}${pt.soon ? " · ⏱" : ""}`;
        if (pt.el.textContent !== label) pt.el.textContent = label;
        pt.el.classList.toggle("is-hot", !!(nTraps || pt.soon));
        placeAt(pt.el, pt.v, 0);
      }
      for (const id in traps) { const m = traps[id]; placeAt(m.userData.el, m.position, 1.4); }
      for (let i = pops.length - 1; i >= 0; i--) {
        const pp = pops[i], age = time - pp.born;
        if (age > pp.life) { pp.el.remove(); pops.splice(i, 1); continue; }
        if (pp.at) placeAt(pp.el, pp.at, pp.y + age);
        else { const p = people[pp.id]; if (p) placeAt(pp.el, p.position, pp.y + age * 1.2 + (pp.el.classList.contains("is-stars") ? -0.6 : 0)); }
        pp.el.style.opacity = String(1 - Math.max(0, age - pp.life + 0.4) / 0.4);
      }
    }
    frame();

    return {
      play, sync, syncTraps, setHour, setScreen: W.paintScreen, setClosed, setFavorite, setMode, wide,
      setSpeed: (x) => { speed = x; }, setPaused: (b) => { paused = b; }, wait,
      focusOn: (id) => { if (people[id]) focus(people[id].position, 2.6); },
      focusPlace: (id) => focus(placeV(id), 2.2),
      restore(snap) {
        for (const c of snap.cast) {
          const p = people[c.id];
          if (c.state === "out") { p.visible = false; p.userData.mode = "gone"; }
          else if (c.state === "cage") { p.userData.mode = "cage"; inCage.add(c.id); }
          else { p.position.copy(slotFor(c.id, c.place, c.hidden)); p.userData.target.copy(p.position); where[c.id] = { place: c.place, hidden: c.hidden }; }
        }
        setClosed(snap.closed);
        syncTraps(snap.traps);
      },
    };
  }

  window.Arena3D = { init };
})();
