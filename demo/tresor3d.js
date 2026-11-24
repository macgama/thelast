// The Last - Chasse au trésor : la vallée d'Itzaluna en 3D low poly (Three.js r128, tout est généré ici).
// Jungle amazonienne, fleuve, 6 zones autour de la grande pyramide du Soleil (monde de fiction, inspiré
// de l'architecture aztèque sans divinité réelle). Réutilise les personnages de Survivor (avatar.js).
// Joue chaque événement du moteur comme un gag de dessin animé : boue, lianes, fumée violette, toucan, drones.
// Expose window.Tresor3D = { init(canvas, cast, opts) }.
(function () {
  "use strict";
  const T = window.THREE;
  const t = (s, v) => (window.t ? window.t(s, v) : s);

  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6d2b79f5) >>> 0; let x = s; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  }
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const ease = (k) => k * k * (3 - 2 * k);
  const V = (x, y, z) => new T.Vector3(x, y, z);

  // ---------- plan de la vallée ----------
  const ZONE_POS = [V(2, 0, 29), V(-25, 0, 15), V(-29, 0, -9), V(-12, 0, -29), V(17, 0, -26), V(29, 0, 2), V(0, 0, 0)];
  const CAMP = V(14, 0, 30), GUARD = V(-9, 0, 31);
  const RIVER_Z = 40, HALF = 48;
  const TIER = 1.7, TIERS = 5;
  const TOP = V(0, TIER * TIERS, 0);

  const matCache = {};
  const mat = (hex, opts = {}) => {
    const key = hex + JSON.stringify(opts);
    return (matCache[key] ??= new T.MeshLambertMaterial({ color: hex, flatShading: true, ...opts }));
  };
  const box = (w, h, d, hex) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat(hex)); m.castShadow = true; m.receiveShadow = true; return m; };
  const disk = (r, hex, opts) => { const m = new T.Mesh(new T.CircleGeometry(r, 28).rotateX(-Math.PI / 2), mat(hex, opts)); m.receiveShadow = true; return m; };

  function zonePoint(z, rnd) {
    const c = ZONE_POS[z];
    if (z === 6) { const th = rnd() * Math.PI - Math.PI; return V(Math.cos(th) * 13 + 0, 0, 13 + rnd() * 4); }
    const th = rnd() * Math.PI * 2, rr = 2.5 + rnd() * 5;
    return V(c.x + Math.cos(th) * rr, 0, c.z + Math.sin(th) * rr);
  }
  const campPoint = (rnd) => { const th = rnd() * Math.PI * 2, rr = 2.2 + rnd() * 3.2; return V(CAMP.x + Math.cos(th) * rr, 0, CAMP.z + Math.sin(th) * rr * 0.7); };

  function tree(r, kind) {
    const g = new T.Group();
    if (kind === "palm") {
      const h = 4 + r() * 2;
      const trunk = new T.Mesh(new T.CylinderGeometry(0.18, 0.28, h, 6), mat(0x8a6a44)); trunk.position.y = h / 2; trunk.rotation.z = (r() - 0.5) * 0.3; g.add(trunk);
      for (let i = 0; i < 6; i++) { const leaf = box(0.4, 0.08, 2.6, 0x3f9a4a); leaf.position.set(0, h, 0); leaf.rotation.y = (i / 6) * Math.PI * 2; leaf.rotation.x = 0.35; leaf.geometry.translate(0, 0, 1.2); g.add(leaf); }
      return g;
    }
    const h = 2.5 + r() * 3.5, tall = kind === "giant";
    const th = tall ? 9 + r() * 3 : h;
    const trunk = new T.Mesh(new T.CylinderGeometry(tall ? 0.5 : 0.22, tall ? 0.8 : 0.35, th, 6), mat(0x6b4a2e)); trunk.position.y = th / 2; trunk.castShadow = true; g.add(trunk);
    const greens = [0x2f7d3a, 0x3c9147, 0x26683a, 0x4aa34f, 0x1f5c33];
    const n = tall ? 3 : 1 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const s = (tall ? 3.2 : 1.4 + r() * 1.3) * (1 - i * 0.15);
      const c = new T.Mesh(new T.IcosahedronGeometry(s, 0), mat(greens[Math.floor(r() * greens.length)]));
      c.position.set((r() - 0.5) * 1.2, th + i * s * 0.7 - 0.2, (r() - 0.5) * 1.2); c.castShadow = true;
      g.add(c);
    }
    return g;
  }

  function stepPyramid(size, tiers, hex, hex2) {
    const g = new T.Group();
    for (let i = 0; i < tiers; i++) {
      const s = size * (1 - i / (tiers + 0.6));
      const b = box(s, TIER, s, i % 2 ? hex2 : hex); b.position.y = TIER / 2 + i * TIER; g.add(b);
    }
    // escalier sur la face sud
    const stairs = box(size * 0.18, TIER * tiers, size * 0.6, 0xb59a6a);
    stairs.position.set(0, (TIER * tiers) / 2 - 0.4, size * 0.32); stairs.rotation.x = -0.62; g.add(stairs);
    return g;
  }

  function buildValley(scene, r) {
    const g = new T.Group(); scene.add(g);
    // sol de jungle, fleuve, sable
    const ground = new T.Mesh(new T.PlaneGeometry(HALF * 2 + 260, HALF * 2 + 260).rotateX(-Math.PI / 2), mat(0x3d6b35)); ground.receiveShadow = true; g.add(ground);
    const river = new T.Mesh(new T.PlaneGeometry(HALF * 2 + 260, 7).rotateX(-Math.PI / 2), mat(0x3f8fb0, { transparent: true, opacity: 0.92 })); river.position.set(0, 0.05, RIVER_Z); g.add(river);
    const sand = new T.Mesh(new T.CircleGeometry(1, 32).rotateX(-Math.PI / 2), mat(0xe2cf96)); sand.scale.set(24, 1, 7); sand.position.set(2, 0.03, 32); sand.receiveShadow = true; g.add(sand);
    // sentiers vers la pyramide
    for (let z = 0; z < 6; z++) {
      const a = ZONE_POS[z], len = a.length() - 10;
      const path = new T.Mesh(new T.PlaneGeometry(2.2, len).rotateX(-Math.PI / 2), mat(0x9c7d52)); path.receiveShadow = true;
      const mid = a.clone().multiplyScalar(0.5 + 5 / a.length());
      path.position.set(mid.x, 0.02, mid.z); path.rotation.y = Math.atan2(a.x, a.z); g.add(path);
    }

    // 0. plage : pirogues, statue géante à moitié dans le sable, feu de camp
    for (let i = 0; i < 4; i++) { const p = box(1.1, 0.5, 4.2, 0x7a5232); p.position.set(-12 + i * 3, 0.25, RIVER_Z - 4.4); p.rotation.y = 0.2 * i; g.add(p); }
    const head = box(3.2, 3.6, 3, 0x9a8c74); head.position.set(-4, 1.2, 27); head.rotation.set(0.25, 0.4, -0.1); g.add(head);
    const brow = box(3.4, 0.6, 0.6, 0x7e715c); brow.position.set(0, 0.9, 1.4); head.add(brow);
    const nose = box(0.7, 1.1, 0.8, 0x7e715c); nose.position.set(0, 0.1, 1.6); head.add(nose);
    const fireG = new T.Group(); fireG.position.copy(CAMP);
    for (let i = 0; i < 6; i++) { const l = box(0.25, 0.25, 1.4, 0x5a3b22); l.rotation.y = (i / 6) * Math.PI; l.position.y = 0.15; fireG.add(l); }
    const flame = new T.Mesh(new T.ConeGeometry(0.6, 1.6, 6), new T.MeshBasicMaterial({ color: 0xffa13d })); flame.position.y = 0.9; fireG.add(flame);
    g.add(fireG);
    // pierre du gardien : un cercle de pierres levées
    for (let i = 0; i < 7; i++) { const th = (i / 7) * Math.PI * 2; const s = box(0.8, 2.4, 0.6, 0x8c8a80); s.position.set(GUARD.x + Math.cos(th) * 4, 1.2, GUARD.z + Math.sin(th) * 3); s.rotation.y = -th; g.add(s); }
    const gstone = box(1.6, 1.2, 1.6, 0x4f8f6a); gstone.position.copy(GUARD).setY(0.6); g.add(gstone);

    // 1. canopée : arbres géants, plateformes et ponts de lianes
    const cz = ZONE_POS[1];
    const giants = [];
    for (let i = 0; i < 5; i++) {
      const th = (i / 5) * Math.PI * 2, p = V(cz.x + Math.cos(th) * 5.5, 0, cz.z + Math.sin(th) * 5.5);
      const tr = tree(r, "giant"); tr.position.copy(p); g.add(tr);
      const plat = box(3, 0.3, 3, 0x9b7448); plat.position.set(p.x, 6, p.z); g.add(plat);
      giants.push(p);
    }
    for (let i = 0; i < 5; i++) {
      const a = giants[i], b = giants[(i + 1) % 5], m = a.clone().add(b).multiplyScalar(0.5), d = a.distanceTo(b);
      const br = box(0.6, 0.12, d, 0xc8a46b); br.position.set(m.x, 5.9, m.z); br.rotation.y = Math.atan2(b.x - a.x, b.z - a.z); g.add(br);
    }

    // 2. temple du Jaguar
    const jag = stepPyramid(10, 3, 0xa8956a, 0x968458); jag.position.copy(ZONE_POS[2]).add(V(-3, 0, -3)); g.add(jag);
    const jh = box(2.2, 1.6, 2, 0xe0b23a); jh.position.set(0, TIER * 3 + 0.8, 0); jag.add(jh);
    for (let i = 0; i < 5; i++) { const sp = box(0.3, 0.3, 0.05, 0x222222); sp.position.set(-0.7 + (i % 3) * 0.6, 0.3 + (i % 2) * 0.5, 1.02); jh.add(sp); }

    // 3. cascades : falaise, chute d'eau, bassin
    const fz = ZONE_POS[3];
    const cliff = box(18, 10, 6, 0x6f7d6a); cliff.position.set(fz.x, 5, fz.z - 7); g.add(cliff);
    const fallM = new T.MeshBasicMaterial({ color: 0x9fd8f0, transparent: true, opacity: 0.75 });
    const fall = new T.Mesh(new T.PlaneGeometry(4, 10), fallM); fall.position.set(fz.x, 5, fz.z - 3.95); g.add(fall);
    const pool = disk(4.5, 0x4aa8c8, { transparent: true, opacity: 0.9 }); pool.position.set(fz.x, 0.06, fz.z - 1.5); g.add(pool);

    // 4. marais des brumes
    const sz = ZONE_POS[4];
    for (let i = 0; i < 6; i++) { const d = disk(1.5 + r() * 2, 0x2f5f55, { transparent: true, opacity: 0.95 }); d.position.set(sz.x + (r() - 0.5) * 12, 0.05, sz.z + (r() - 0.5) * 10); g.add(d); }
    for (let i = 0; i < 30; i++) { const reed = box(0.08, 1 + r(), 0.08, 0x6a8f3a); reed.position.set(sz.x + (r() - 0.5) * 14, 0.6, sz.z + (r() - 0.5) * 12); g.add(reed); }
    const mist = [];
    for (let i = 0; i < 7; i++) { const m = new T.Mesh(new T.SphereGeometry(2.5 + r() * 2, 8, 6), new T.MeshLambertMaterial({ color: 0xdfe8e4, transparent: true, opacity: 0.28, depthWrite: false })); m.position.set(sz.x + (r() - 0.5) * 12, 1.4, sz.z + (r() - 0.5) * 10); m.scale.y = 0.4; g.add(m); mist.push(m); }

    // 5. cénote
    const ce = ZONE_POS[5];
    const rim = new T.Mesh(new T.CylinderGeometry(5.2, 5.6, 1.2, 20, 1, true), mat(0x8c8a80, { side: T.DoubleSide })); rim.position.set(ce.x, 0.3, ce.z - 3); g.add(rim);
    const water = disk(5.1, 0x2ec4c4); water.position.set(ce.x, 0.12, ce.z - 3); g.add(water);
    for (let i = 0; i < 10; i++) { const vine = box(0.1, 1.6, 0.1, 0x3c9147); const th = (i / 10) * Math.PI * 2; vine.position.set(ce.x + Math.cos(th) * 5.3, 0.4, ce.z - 3 + Math.sin(th) * 5.3); g.add(vine); }

    // 6. la grande pyramide du Soleil et son coffre
    const sun = stepPyramid(22, TIERS, 0xc7ac74, 0xb8995e); g.add(sun);
    const disc = new T.Mesh(new T.CylinderGeometry(1.6, 1.6, 0.3, 20).rotateX(Math.PI / 2), mat(0xffd166)); disc.position.set(0, TOP.y + 3.2, -1.4); g.add(disc);
    const chest = new T.Group(); chest.position.copy(TOP).add(V(0, 0, 0.6));
    const cb = box(1.6, 0.9, 1, 0x7a4a22); cb.position.y = 0.45; chest.add(cb);
    const lid = new T.Group(); lid.position.set(0, 0.9, -0.5); chest.add(lid);
    const lb = box(1.6, 0.4, 1, 0x8a5a2a); lb.position.set(0, 0.2, 0.5); lid.add(lb);
    const gold = new T.Mesh(new T.BoxGeometry(1.4, 0.3, 0.8), new T.MeshBasicMaterial({ color: 0xffd166 })); gold.position.y = 0.85; gold.visible = false; chest.add(gold);
    g.add(chest);

    // stèles : là où se cache le morceau de carte de chaque zone
    const steles = ZONE_POS.map((p, z) => {
      const s = box(1.2, 2, 0.4, 0x8d8371);
      if (z === 6) s.position.copy(TOP).add(V(-2.2, 1, 0.4)); else s.position.copy(p).add(V(0, 1, 0));
      const glow = new T.Mesh(new T.BoxGeometry(0.8, 1.2, 0.45), new T.MeshBasicMaterial({ color: 0xffd166 })); glow.visible = false; s.add(glow);
      s.userData.glow = glow; g.add(s); return s;
    });

    // jungle autour
    const avoid = [...ZONE_POS.map((p, i) => [p, i === 6 ? 15 : 9]), [CAMP, 6], [GUARD, 6], [V(-4, 0, 27), 4]];
    let n = 0, guard = 0;
    while (n < 170 && guard++ < 3000) {
      const x = (r() - 0.5) * HALF * 2, z = (r() - 0.5) * HALF * 2;
      if (z > RIVER_Z - 5 && z < RIVER_Z + 4) continue;
      const p = V(x, 0, z);
      if (avoid.some(([c, d]) => c.distanceTo(p) < d)) continue;
      const tr = tree(r, z > 24 && z < RIVER_Z ? "palm" : "tree"); tr.position.copy(p); tr.rotation.y = r() * 6; g.add(tr); n++;
    }
    return { fallM, mist, flame, chest, lid, gold, steles };
  }

  function makeDrone() {
    const g = new T.Group();
    g.add(box(0.9, 0.3, 0.9, 0xf2f2f2));
    const red = new T.Mesh(new T.BoxGeometry(0.92, 0.08, 0.2), new T.MeshBasicMaterial({ color: 0xff5b6b })); red.position.y = 0.12; g.add(red);
    const rotors = [];
    for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const arm = box(0.08, 0.08, 0.8, 0x333333); arm.position.set(x * 0.45, 0.1, z * 0.45); arm.rotation.y = Math.atan2(x, z); g.add(arm);
      const rot = new T.Mesh(new T.CylinderGeometry(0.4, 0.4, 0.03, 8), new T.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.5 }));
      rot.position.set(x * 0.7, 0.22, z * 0.7); g.add(rot); rotors.push(rot);
    }
    const claw = box(0.12, 0.9, 0.12, 0x333333); claw.position.y = -0.55; g.add(claw);
    g.scale.setScalar(1.4);
    g.userData.rotors = rotors;
    return g;
  }

  function makeToucan() {
    const g = new T.Group();
    g.add(box(0.5, 0.45, 0.8, 0x1a1a1a));
    const belly = box(0.42, 0.3, 0.3, 0xfff1b8); belly.position.set(0, 0, 0.3); g.add(belly);
    const beak = new T.Mesh(new T.ConeGeometry(0.17, 0.9, 6).rotateX(Math.PI / 2), mat(0xff8a3d)); beak.position.set(0, 0.08, 0.8); g.add(beak);
    const wings = [-1, 1].map((s) => { const w = box(0.6, 0.06, 0.5, 0x222222); w.position.set(s * 0.5, 0.1, 0); g.add(w); return w; });
    g.userData.wings = wings; g.scale.setScalar(1.3);
    return g;
  }

  function makePerson(c) {
    const { group, armL, armR, height } = window.TheLastAvatar.build(T, c.look, mat);
    const g = new T.Group(); g.add(group);
    group.rotation.order = "YXZ";
    const s = 1.25 * (height || 1); group.scale.setScalar(s);
    const ringM = new T.Mesh(new T.TorusGeometry(0.85, 0.07, 4, 24).rotateX(Math.PI / 2), new T.MeshBasicMaterial({ color: 0xffd166 }));
    ringM.position.y = 0.06; ringM.visible = false; g.add(ringM);
    // boue (cachée)
    const mud = new T.Group();
    for (let i = 0; i < 7; i++) { const b = new T.Mesh(new T.IcosahedronGeometry(0.17 + (i % 3) * 0.05, 0), mat(0x6b4a2e)); b.position.set(Math.sin(i * 2.1) * 0.34, 0.3 + i * 0.2, Math.cos(i * 2.1) * 0.3); mud.add(b); }
    mud.visible = false; mud.scale.setScalar(s); g.add(mud);
    // étoiles du vertige
    const stars = new T.Group();
    for (let i = 0; i < 4; i++) { const st = new T.Mesh(new T.OctahedronGeometry(0.14, 0), new T.MeshBasicMaterial({ color: 0xffe066 })); const th = (i / 4) * Math.PI * 2; st.position.set(Math.cos(th) * 0.5, 0, Math.sin(th) * 0.5); stars.add(st); }
    stars.position.y = 2.75 * s / 1.25; stars.visible = false; g.add(stars);
    // nuage de la malédiction
    const cloud = new T.Group();
    for (let i = 0; i < 4; i++) { const b = new T.Mesh(new T.IcosahedronGeometry(0.35, 0), mat(0x5b4a7a)); b.position.set((i - 1.5) * 0.35, Math.sin(i) * 0.1, 0); cloud.add(b); }
    cloud.position.y = 3.3 * s / 1.25; cloud.visible = false; g.add(cloud);
    // morceau de carte porté (rouleau doré dans le dos)
    const scroll = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 0.7, 8).rotateZ(Math.PI / 2), mat(0xf0dca0));
    scroll.position.set(0, 1.5 * s / 1.25, -0.35); scroll.visible = false; g.add(scroll);
    // aura du vainqueur
    const aura = new T.Group();
    const halo = new T.Mesh(new T.TorusGeometry(1.1, 0.12, 6, 32).rotateX(Math.PI / 2), new T.MeshBasicMaterial({ color: 0xffd166 }));
    const beam = new T.Mesh(new T.CylinderGeometry(1.2, 1.2, 9, 16, 1, true), new T.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.18, side: T.DoubleSide, depthWrite: false }));
    beam.position.y = 4.5; aura.add(halo, beam); aura.visible = false; g.add(aura);
    g.userData = { id: c.id, inner: group, armL, armR, ringM, mud, stars, cloud, scroll, aura, target: new T.Vector3(), speed: 3.2, scale: s, phase: Math.random() * 6, mode: "idle", nextWander: 0 };
    return g;
  }

  // =====================================================================
  function init(canvas, cast, opts = {}) {
    const isSmall = Math.min(window.innerWidth, window.innerHeight) < 700;
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmall ? 1.75 : 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    const scene = new T.Scene();
    const r = rng(2027);

    const camera = new T.OrthographicCamera(-1, 1, 1, -1, -200, 600);
    const OFF = V(46, 42, 46);
    camera.position.copy(OFF);
    const controls = new T.OrbitControls(camera, canvas);
    Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, minZoom: 0.6, maxZoom: 7, maxPolarAngle: 1.2, minPolarAngle: 0.35, screenSpacePanning: true });
    const VIEW = 84;
    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      const aspect = w / h, span = aspect < 1 ? VIEW / aspect * 0.8 : VIEW;
      camera.left = (-span * aspect) / 2; camera.right = (span * aspect) / 2; camera.top = span / 2; camera.bottom = -span / 2;
      camera.updateProjectionMatrix();
    }
    new ResizeObserver(resize).observe(canvas);
    resize();

    const hemi = new T.HemisphereLight(0xd8f0ff, 0x2f4a2a, 0.65); scene.add(hemi);
    const sun = new T.DirectionalLight(0xfff1d6, 0.85);
    sun.castShadow = true; sun.shadow.mapSize.set(isSmall ? 1024 : 2048, isSmall ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 220 });
    sun.shadow.bias = -0.0008; sun.position.set(30, 60, 20);
    scene.add(sun, sun.target);
    const fireLight = new T.PointLight(0xffa04a, 0, 26); fireLight.position.copy(CAMP).setY(2.5); scene.add(fireLight);

    const W = buildValley(scene, r);

    // candidats
    const people = {};
    cast.forEach((c) => {
      const p = makePerson(c);
      people[c.id] = p;
      p.position.copy(campPoint(Math.random));
      p.userData.target.copy(p.position);
      scene.add(p);
    });
    const drones = [];
    const getDrone = () => { let d = drones.find((x) => !x.userData.busy); if (!d) { d = makeDrone(); d.position.set(0, 60, 0); scene.add(d); drones.push(d); } d.userData.busy = true; return d; };
    const toucan = makeToucan(); toucan.visible = false; scene.add(toucan);

    // étiquettes et bulles HTML
    const host = canvas.parentElement;
    const layer = document.createElement("div"); layer.className = "a3-layer"; host.appendChild(layer);
    const tags = {};
    for (const c of cast) {
      const el = document.createElement("div"); el.className = "a3-tag"; el.textContent = c.name; el.hidden = true; layer.appendChild(el);
      tags[c.id] = { el, until: 0 };
    }
    const pops = [];
    function pop(id, text, cls = "") {
      const el = document.createElement("div"); el.className = "a3-pop " + cls; el.textContent = text; layer.appendChild(el);
      pops.push({ el, id, born: clock.elapsedTime, life: 1.8, y: 3.2 });
    }
    function popAt(v, text, cls = "") {
      const el = document.createElement("div"); el.className = "a3-pop " + cls; el.textContent = text; layer.appendChild(el);
      pops.push({ el, at: v.clone(), born: clock.elapsedTime, life: 2.2, y: 0 });
    }
    function showTag(id, sec = 4) { if (tags[id]) tags[id].until = Math.max(tags[id].until, simTime + sec); }

    // ---------- temps de la mise en scène ----------
    let speed = 1, paused = false, simTime = 0;
    const clock = new T.Clock();
    const waits = [];
    const wait = (sec) => new Promise((res) => waits.push({ at: simTime + sec, res }));
    const tweens = [];
    function tween(sec, fn) { return new Promise((res) => tweens.push({ t0: simTime, sec, fn, res })); }

    // ---------- caméra du réalisateur ----------
    let me = null, mode = "director", userHold = 0;
    const camGoal = { target: V(0, 2, 6), zoom: 1 };
    controls.addEventListener("start", () => { userHold = clock.elapsedTime + 8; });
    function focus(v, zoom = 2.2) { camGoal.target.set(v.x, Math.max(1.5, v.y + 1.5), v.z); camGoal.zoom = zoom; }
    function wide() { camGoal.target.set(0, 2, 6); camGoal.zoom = 1; }

    // ---------- déplacements ----------
    let place = "camp", zoneNow = 0;
    const home = (id) => (place === "camp" ? campPoint(Math.random) : zonePoint(zoneNow, Math.random));
    function runTo(id, v, sp = 8) {
      const p = people[id]; p.userData.mode = "run"; p.userData.target.copy(v); p.userData.speed = sp;
      return new Promise((res) => { p.userData.arrive = res; });
    }
    const run = (id, v, sp, max = 2.4) => Promise.race([runTo(id, v, sp), wait(max)]);
    const near = (id, other, d = 1.3) => { const a = people[id].position, b = people[other].position; const dir = new T.Vector3().subVectors(a, b).setY(0); if (dir.length() < 0.01) dir.set(1, 0, 0); return b.clone().setY(0).add(dir.normalize().multiplyScalar(d)); };
    const face = (id, other) => { const a = people[id], b = people[other]; a.userData.inner.rotation.y = Math.atan2(b.position.x - a.position.x, b.position.z - a.position.z); };
    function release(id) { const p = people[id]; if (!p || p.userData.mode === "gone") return; p.userData.mode = "idle"; p.userData.speed = 3.2; p.userData.nextWander = simTime + 1 + Math.random() * 2; }
    const alive = () => Object.keys(people).filter((id) => people[id].userData.mode !== "gone");
    function gather(where, z) {
      place = where; if (z !== undefined) zoneNow = z;
      for (const id of alive()) { const p = people[id]; if (p.userData.mode === "fixed") continue; p.position.y = 0; runTo(id, home(id), 7 + Math.random() * 3).then(() => release(id)); }
    }

    // ---------- animations ----------
    function swing(id, sec = 0.5) { const u = people[id].userData; return tween(sec, (k) => { u.armR.rotation.x = -Math.sin(k * Math.PI) * 2.4; }); }
    function spin(id, sec = 1) { const u = people[id].userData; const r0 = u.inner.rotation.y; return tween(sec, (k) => { u.inner.rotation.y = r0 + ease(k) * Math.PI * 4; }); }
    function dizzy(id, sec = 2.5) { const u = people[id].userData; u.stars.visible = true; u.dizzyUntil = simTime + sec; }
    function fall(id, sec = 0.4) { const u = people[id].userData; return tween(sec, (k) => { u.inner.rotation.x = -ease(k) * 1.45; u.inner.position.y = ease(k) * 0.3; }); }
    function standUp(id, sec = 0.5) { const u = people[id].userData; return tween(sec, (k) => { u.inner.rotation.x = -(1 - ease(k)) * 1.45; u.inner.position.y = (1 - ease(k)) * 0.3; }); }
    function hop(id, to, h = 6, sec = 1.2) {
      const p = people[id], from = p.position.clone(); p.userData.mode = "carried";
      return tween(sec, (k) => { p.position.lerpVectors(from, to, k); p.position.y = Math.sin(k * Math.PI) * h; p.userData.inner.rotation.x = k * Math.PI * 2; })
        .then(() => { p.userData.inner.rotation.x = 0; p.position.y = 0; p.userData.target.copy(p.position); release(id); });
    }
    function puff(v, hex, n = 10, spread = 1.6, sec = 1.6) {
      const g = new T.Group(); scene.add(g);
      const ps = Array.from({ length: n }, () => { const m = new T.Mesh(new T.IcosahedronGeometry(0.25 + Math.random() * 0.25, 0), mat(hex, { transparent: true, opacity: 0.85 })); m.userData.d = V((Math.random() - 0.5) * spread, Math.random() * 1.5 + 0.5, (Math.random() - 0.5) * spread); g.add(m); return m; });
      g.position.copy(v).setY(1.2);
      return tween(sec, (k) => { for (const m of ps) { m.position.copy(m.userData.d).multiplyScalar(ease(k) * 1.6); m.scale.setScalar(1 + k); m.material.opacity = 0.85 * (1 - k); } }).then(() => scene.remove(g));
    }
    async function droneGrab(id, dest) {
      const p = people[id], d = getDrone();
      p.userData.mode = "carried";
      opts.sfx?.("drone");
      const start = V(p.position.x + 8, 28, p.position.z - 8);
      d.position.copy(start);
      const over = p.position.clone().setY(p.position.y + 3.2);
      await tween(1.1, (k) => d.position.lerpVectors(start, over, ease(k)));
      const dFrom = d.position.clone();
      await tween(1.6, (k) => {
        d.position.lerpVectors(dFrom, dest.clone().setY(dest.y + 3.2), ease(k));
        d.position.y += Math.sin(k * Math.PI) * 6;
        p.position.copy(d.position).setY(d.position.y - 3.2);
      });
      p.position.copy(dest);
      d.userData.busy = false; d.position.set(0, 60, 0);
    }
    async function flyToucan(id) {
      const p = people[id];
      const from = V(p.position.x - 18, 16, p.position.z - 18), to = p.position.clone().setY(2.9 * p.userData.scale / 1.25 + 0.6);
      toucan.visible = true; toucan.position.copy(from); toucan.lookAt(to);
      opts.sfx?.("whoosh");
      await tween(2, (k) => { toucan.position.lerpVectors(from, to, ease(k)); toucan.position.y += Math.sin(k * Math.PI) * 3; for (const w of toucan.userData.wings) w.rotation.z = Math.sin(simTime * 30) * 0.7 * (w.position.x > 0 ? 1 : -1); });
      pop(id, "🦜💬", "is-gift"); opts.sfx?.("chime");
      await wait(1.2);
      const away = V(to.x + 20, 18, to.z + 10);
      await tween(1.4, (k) => { toucan.position.lerpVectors(to, away, ease(k)); for (const w of toucan.userData.wings) w.rotation.z = Math.sin(simTime * 30) * 0.7; });
      toucan.visible = false;
    }
    const gone = new Set();
    let finalSpots = {};

    // ---------- jouer un événement ----------
    async function play(e) {
      const P = (id) => people[id];
      const piecesOf = opts.piecesOf || (() => 0);
      const refreshScroll = (id) => { if (P(id)) P(id).userData.scroll.visible = piecesOf(id) > 0; };
      switch (e.type) {
        case "enter": {
          focus(V(0, 0, 32), 1.5); opts.sfx?.("drum");
          const ids = alive();
          ids.forEach((id, i) => { const p = P(id); p.position.set(-14 + (i % 8) * 2.6, 0, RIVER_Z - 3 + Math.floor(i / 8) * 0.8); });
          for (const id of ids) runTo(id, campPoint(Math.random), 5 + Math.random() * 2).then(() => release(id));
          await wait(3);
          break;
        }
        case "zone": {
          if (e.zone === 6) { focus(V(0, 4, 4), 1.4); } else focus(ZONE_POS[e.zone], 1.7);
          for (const s of W.steles) s.userData.glow.visible = false;
          gather("zone", e.zone);
          opts.sfx?.("alert");
          await wait(2.6);
          break;
        }
        case "riddle": case "hint": {
          const s = W.steles[zoneNow]; const v = s.getWorldPosition(V(0, 0, 0)).add(V(0, 2, 0));
          focus(v, 2); popAt(v, e.type === "riddle" ? "❓" : "💡", "is-item"); opts.sfx?.("chime");
          await wait(1.2);
          break;
        }
        case "medal": {
          const ids = e.ids || [e.a];
          if (ids.length) focus(P(ids[0]).position, ids.length > 1 ? 1.6 : 2.2);
          for (const id of ids) { showTag(id, 3); pop(id, "🟢", "is-gift"); }
          opts.sfx?.("pop");
          await wait(ids.length > 1 ? 1.2 : 0.9);
          break;
        }
        case "piece": {
          const p = P(e.a); showTag(e.a, 8);
          const s = W.steles[e.n === 7 ? 6 : zoneNow];
          const at = s.getWorldPosition(V(0, 0, 0));
          if (e.how !== "orphan") {
            focus(at, 2.4);
            if (e.n === 7) { p.position.copy(at).add(V(1.2, -1, 1.4)); p.userData.mode = "fixed"; }
            else await run(e.a, at.clone().setY(0).add(V(1.2, 0, 1.2)), 9, 3);
            s.userData.glow.visible = true;
          } else focus(p.position, 2.2);
          pop(e.a, t("📜 MORCEAU N°{n}", { n: e.n }), "is-hit"); opts.sfx?.("fanfare");
          refreshScroll(e.a);
          await swing(e.a, 0.5); await wait(0.6);
          if (e.n !== 7) release(e.a);
          break;
        }
        case "toucan": {
          const p = P(e.a); showTag(e.a, 6); focus(p.position, 2.6);
          await flyToucan(e.a);
          break;
        }
        case "trap": {
          const p = P(e.a); showTag(e.a, 5); focus(p.position, 2.5);
          const k = e.kind;
          if (k === "mud") { await fall(e.a, 0.35); p.userData.mud.visible = true; p.userData.mudUntil = simTime + 30; opts.sfx?.("splash"); pop(e.a, t("SPLOUCH !"), "is-hit"); await wait(0.8); await standUp(e.a); }
          else if (k === "liana") { pop(e.a, t("WIIIII !"), "is-hit"); opts.sfx?.("whoosh"); await hop(e.a, p.position.clone().add(V(4, 0, 3)), 7, 1.3); opts.sfx?.("splash"); }
          else if (k === "smoke") { puff(p.position, 0xb06ad8, 12); await wait(0.5); pop(e.a, t("ATCHOUM !"), "is-hit"); await spin(e.a, 0.6); }
          else if (k === "ants") { pop(e.a, t("AÏE AÏE AÏE !"), "is-hit"); opts.sfx?.("bonk"); await Promise.all([spin(e.a, 1.4), tween(1.4, (q) => { p.userData.inner.position.y = Math.abs(Math.sin(q * 20)) * 0.5; })]); }
          else if (k === "caiman") {
            const cai = box(0.8, 0.4, 2.6, 0x4c7a3a); const from = p.position.clone().add(V(-4, 0.2, 2)); cai.position.copy(from); scene.add(cai);
            await tween(1, (q) => { cai.position.lerpVectors(from, p.position.clone().setY(0.2), ease(q)); cai.lookAt(p.position.clone().setY(0.2)); });
            pop(e.a, t("CROC !"), "is-hit"); opts.sfx?.("bonk");
            await tween(0.9, (q) => { cai.position.lerpVectors(p.position.clone().setY(0.2), from, ease(q)); });
            scene.remove(cai);
          } else if (k === "bats") { puff(p.position.clone().setY(1), 0x222222, 14, 3, 1.4); pop(e.a, t("FLAP FLAP !"), "is-hit"); dizzy(e.a); await wait(1); }
          else if (k === "rain") { puff(p.position.clone().setY(3), 0x7fb6d9, 16, 2, 1.2); pop(e.a, t("PLIC PLOC"), "is-item"); opts.sfx?.("splash"); await wait(1); }
          else if (k === "door") { pop(e.a, "?!", "is-hit"); dizzy(e.a, 3); await spin(e.a, 1.2); }
          else if (k === "monkey") { pop(e.a, "🐒💨", "is-hit"); opts.sfx?.("whoosh"); dizzy(e.a); await wait(1); }
          if (e.lost) pop(e.a, e.lost === "medal" ? t("− 🟢") : t("− ✍️"), "is-ko");
          await wait(0.3);
          break;
        }
        case "curse": {
          const p = P(e.a); showTag(e.a, 6); focus(p.position, 2.4);
          p.userData.cloud.visible = true;
          if (e.kind === "start") { opts.sfx?.("tension"); puff(p.position, 0x6a4a9a, 10); pop(e.a, t("MAUDIT·E !"), "is-ko"); await wait(1.4); break; }
          pop(e.a, { monkeys: "🐒🐒🐒", parrot: t("🦜 « ICI ! »"), storm: "⛈️" }[e.kind] || "☁️", "is-betray");
          opts.sfx?.(e.kind === "storm" ? "crash" : "gasp");
          if (e.kind === "storm") puff(p.position.clone().setY(3), 0x7fb6d9, 14, 1.2, 1.2);
          await spin(e.a, 0.7);
          break;
        }
        case "pact": {
          const a = P(e.a); focus(a.position, 2.3); showTag(e.a); showTag(e.v);
          await run(e.v, near(e.v, e.a, 1.1));
          face(e.v, e.a); face(e.a, e.v);
          pop(e.a, "🤝", "is-item"); opts.sfx?.("chime");
          await Promise.all([swing(e.a, 0.4), swing(e.v, 0.4)]);
          release(e.v); release(e.a);
          break;
        }
        case "steal": case "caught": {
          const v = P(e.v); focus(v.position, 2.5); showTag(e.a, 5); showTag(e.v, 5);
          await run(e.a, near(e.a, e.v, 0.9), 4, 2.5);
          face(e.a, e.v);
          if (e.type === "steal") { pop(e.a, e.what === "piece" ? t("🤫 📜") : t("🤫 🟢"), "is-betray"); opts.sfx?.("whoosh"); refreshScroll(e.a); refreshScroll(e.v); }
          else { pop(e.v, "‼️", "is-ko"); opts.sfx?.("gasp"); }
          await wait(0.6);
          await run(e.a, home(e.a), 10, 1.6); release(e.a);
          break;
        }
        case "copy": {
          const a = P(e.a); focus(a.position, 2.4); showTag(e.a, 4); showTag(e.v, 4);
          await run(e.a, near(e.a, e.v, 1.1), 6, 2);
          face(e.a, e.v); face(e.v, e.a);
          pop(e.a, "✍️", "is-item"); opts.sfx?.("blip");
          await wait(0.8); release(e.a);
          break;
        }
        case "guardian": {
          focus(GUARD, 1.9); opts.sfx?.("tension");
          e.ids.forEach((id, i) => { const th = (i / e.ids.length) * Math.PI * 2; showTag(id, 30); P(id).userData.mode = "fixed"; runTo(id, V(GUARD.x + Math.cos(th) * 2.4, 0, GUARD.z + Math.sin(th) * 1.8), 8).then(() => { P(id).userData.mode = "fixed"; }); });
          await wait(2.4);
          break;
        }
        case "vote": {
          focus(GUARD, 2);
          pop(e.saved, t("SAUVÉ·E !"), "is-gift"); opts.sfx?.("fanfare");
          await wait(1);
          release(e.saved);
          await run(e.saved, campPoint(Math.random), 8, 2);
          break;
        }
        case "out": {
          const v = P(e.v); showTag(e.v, 6);
          if (e.cause === "finale") { focus(v.position, 2); pop(e.v, `${e.rank}`, "is-stars"); opts.sfx?.("sad"); await wait(0.7); break; }
          if (v.userData.mode !== "fixed") focus(v.position, 2.2); else focus(GUARD, 2);
          if (e.cause === "accident") { await fall(e.v, 0.4); pop(e.v, "🩹", "is-ko"); await wait(0.6); }
          else pop(e.v, t("ÉVACUÉ·E"), "is-ko");
          const th = Math.random() * Math.PI * 2;
          await droneGrab(e.v, V(Math.cos(th) * 90, 34, Math.sin(th) * 90));
          v.visible = false; v.userData.mode = "gone"; gone.add(e.v);
          opts.sfx?.("sad");
          break;
        }
        case "night": {
          for (const id of alive()) if (P(id).userData.mode === "fixed") P(id).userData.mode = "idle";
          gather("camp"); focus(CAMP, 1.6);
          await wait(1.2);
          break;
        }
        case "finale": {
          focus(V(0, 5, 6), 1.5); opts.sfx?.("drum");
          finalSpots = {};
          e.ids.forEach((id, i) => { const x = (i - (e.ids.length - 1) / 2) * 1.5; finalSpots[id] = x; P(id).userData.mode = "fixed"; P(id).position.y = 0; runTo(id, V(x, 0, 14), 7).then(() => { P(id).userData.mode = "fixed"; }); showTag(id, 60); });
          await wait(2.6);
          break;
        }
        case "lock": {
          const p = P(e.a); showTag(e.a, 30);
          const x = finalSpots[e.a] ?? 0, frac = 0.35 + (e.locks / 7) * 0.6;
          const from = p.position.clone(), to = V(x * (1 - frac * 0.6), TOP.y * frac, 11 - 8.6 * frac);
          p.userData.mode = "carried";
          focus(to, 1.9);
          await tween(1.6, (k) => { p.position.lerpVectors(from, to, ease(k)); p.position.y += Math.abs(Math.sin(k * 18)) * 0.3; });
          p.userData.mode = "fixed"; p.userData.target.copy(p.position);
          pop(e.a, `🔓 ${e.locks}/7`, "is-stars"); opts.sfx?.("blip");
          await wait(0.6);
          break;
        }
        case "fake": { const p = P(e.a); focus(p.position, 2.4); pop(e.a, t("❌ FAUSSE COPIE"), "is-ko"); opts.sfx?.("gasp"); await wait(1); break; }
        case "win": {
          const p = P(e.a); p.visible = true; p.userData.mode = "carried";
          const from = p.position.clone(), to = TOP.clone().add(V(0, 0, 1.8));
          focus(TOP, 2.6);
          await tween(1.4, (k) => { p.position.lerpVectors(from, to, ease(k)); });
          p.userData.mode = "fixed"; p.userData.target.copy(p.position);
          await tween(0.8, (k) => { W.lid.rotation.x = -ease(k) * 1.9; });
          W.gold.visible = true; p.userData.aura.visible = true; showTag(e.a, 9999);
          confetti(); opts.sfx?.("fanfare");
          pop(e.a, "🏆", "is-gift");
          await wait(2);
          break;
        }
        default: await wait(0.25);
      }
    }

    // confettis
    let conf = null;
    function confetti() {
      const n = 500, geo = new T.PlaneGeometry(0.35, 0.2), m = new T.MeshBasicMaterial({ side: T.DoubleSide });
      conf = new T.InstancedMesh(geo, m, n);
      const col = new T.Color(), pal = [0xffd166, 0x62d6a0, 0xff8a3d, 0x2ec4c4, 0xc08bff, 0xff5b6b];
      conf.userData.p = [];
      for (let i = 0; i < n; i++) { conf.setColorAt(i, col.setHex(pal[i % pal.length])); conf.userData.p.push([(Math.random() - 0.5) * 30, 15 + Math.random() * 25, (Math.random() - 0.5) * 30, Math.random() * 6]); }
      conf.instanceColor.needsUpdate = true;
      scene.add(conf);
    }

    // ---------- heure du jour ----------
    const SKY = [[6, 0x223049, 0.3], [9, 0x9fd3e0, 1], [16, 0xa6d6e0, 1], [19, 0xe0874f, 0.65], [20.5, 0x2a2550, 0.35], [23, 0x0b1020, 0.22]];
    function setHour(day, hour) {
      let c = new T.Color(0x0b1020), l = 0.22;
      for (let i = 0; i < SKY.length - 1; i++) {
        const [h0, c0, l0] = SKY[i], [h1, c1, l1] = SKY[i + 1];
        if (hour >= h0 && hour <= h1) { const k = (hour - h0) / (h1 - h0); c = new T.Color(c0).lerp(new T.Color(c1), k); l = lerp(l0, l1, k); }
      }
      scene.background = c;
      hemi.intensity = 0.25 + 0.45 * l; sun.intensity = 0.15 + 0.75 * l;
      fireLight.intensity = l < 0.7 ? 1.6 : 0;
    }
    function setFavorite(id) {
      if (me && people[me]) { people[me].userData.ringM.visible = false; tags[me].el.classList.remove("is-me"); }
      me = id;
      if (me && people[me]) { people[me].userData.ringM.visible = true; tags[me].el.classList.add("is-me"); }
    }
    function setMode(m) { mode = m; if (m === "follow" && me) focus(people[me].position, 2.6); }

    // clic sur un candidat
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
      const dt = paused ? 0 : rdt * speed;
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
        if (u.cloud.visible) u.cloud.rotation.y += rdt;
        if (u.stars.visible) { u.stars.rotation.y += rdt * 6; if (simTime > u.dizzyUntil) u.stars.visible = false; }
        if (u.mud.visible && simTime > u.mudUntil) u.mud.visible = false;
        if (u.aura.visible) u.aura.rotation.y += rdt;
        if (u.mode === "fixed") { if (u.armL) u.armL.rotation.x = 0; continue; }
        if (u.mode === "idle" && simTime > u.nextWander) { u.target.copy(home(id)); u.nextWander = simTime + 4 + Math.random() * 6; }
        v3.subVectors(u.target, p.position).setY(0);
        const d = v3.length();
        const moving = d > 0.15;
        if (moving) {
          const step = Math.min(d, u.speed * dt);
          p.position.addScaledVector(v3.normalize(), step);
          u.inner.rotation.y = Math.atan2(v3.x, v3.z);
        } else if (u.arrive) { const f = u.arrive; u.arrive = null; f(); }
        const sw = moving ? Math.sin(simTime * 12 + u.phase) * 0.6 : 0;
        if (u.armL) u.armL.rotation.x = sw;
        u.inner.position.y = u.inner.rotation.x ? u.inner.position.y : (moving ? Math.abs(Math.sin(simTime * 12 + u.phase)) * 0.12 : 0);
      }
      for (const d of drones) for (const ro of d.userData.rotors) ro.rotation.y += rdt * 30;
      W.fallM.color.setHSL(0.54, 0.6, 0.72 + Math.sin(time * 6) * 0.05);
      W.flame.scale.set(1 + Math.sin(time * 9) * 0.12, 1 + Math.sin(time * 13) * 0.2, 1);
      for (const m of W.mist) m.position.x += Math.sin(time * 0.3 + m.position.z) * rdt * 0.4;
      if (conf) {
        const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), sc = V(1, 1, 1), pos = V(0, 0, 0);
        conf.userData.p.forEach((c, i) => { c[1] -= rdt * 4; if (c[1] < 0) c[1] = 30; c[3] += rdt * 4; e.set(c[3], c[3] * 0.7, 0); q.setFromEuler(e); pos.set(c[0] + Math.sin(c[3]) * 0.6, c[1], c[2]); m4.compose(pos, q, sc); conf.setMatrixAt(i, m4); });
        conf.instanceMatrix.needsUpdate = true;
      }
      if (clock.elapsedTime > userHold) {
        if (mode === "follow" && me && people[me]?.visible) { const p = people[me].position; camGoal.target.set(p.x, Math.max(1.5, p.y + 1.5), p.z); camGoal.zoom = Math.max(camGoal.zoom, 2.4); }
        if (mode === "wide") { camGoal.target.set(0, 2, 6); camGoal.zoom = 0.9; }
        const k = 1 - Math.pow(0.05, rdt);
        controls.target.lerp(camGoal.target, k);
        camera.zoom = lerp(camera.zoom, camGoal.zoom, k);
        camera.position.copy(controls.target).add(OFF);
        camera.updateProjectionMatrix();
      }
      controls.update();
      renderer.render(scene, camera);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const placeEl = (el, pos, y) => {
        v3.copy(pos); v3.y += y; v3.project(camera);
        el.style.transform = `translate(${((v3.x + 1) / 2) * w}px, ${((1 - v3.y) / 2) * h}px) translate(-50%, -100%)`;
      };
      for (const id in tags) {
        const tg = tags[id], p = people[id];
        const show = p.visible && p.userData.mode !== "gone" && (id === me || simTime < tg.until);
        tg.el.hidden = !show;
        if (show) placeEl(tg.el, p.position, 2.9 * p.userData.scale / 1.25 + p.userData.inner.position.y);
      }
      for (let i = pops.length - 1; i >= 0; i--) {
        const pp = pops[i], age = time - pp.born;
        if (age > pp.life) { pp.el.remove(); pops.splice(i, 1); continue; }
        if (pp.at) placeEl(pp.el, pp.at, age * 1.2);
        else { const p = people[pp.id]; if (p) placeEl(pp.el, p.position, pp.y + age * 1.2 + (pp.el.classList.contains("is-stars") ? -0.6 : 0)); }
        pp.el.style.opacity = String(1 - Math.max(0, age - pp.life + 0.4) / 0.4);
      }
    }
    frame();

    return {
      play, setHour, setFavorite, setMode, wide, gather,
      setSpeed: (x) => { speed = x; }, setPaused: (b) => { paused = b; }, wait,
      focusOn: (id) => { if (people[id]) focus(people[id].position, 2.6); },
      setScroll: (id, on) => { if (people[id]) people[id].userData.scroll.visible = on; },
      setCursed: (id) => { for (const k in people) people[k].userData.cloud.visible = k === id; },
    };
  }

  window.Tresor3D = { init };
})();
