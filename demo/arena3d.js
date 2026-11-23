// The Last - Arena Battle : le Colisée d'acier en 3D low poly (Three.js r128, tout est généré ici).
// Réutilise les personnages de Survivor (avatar.js). Joue chaque événement du moteur comme un gag de dessin animé :
// BOING, SPLAT, filets, peaux de banane, potions, drones d'évacuation et Cage du sursis.
// Expose window.Arena3D = { init(canvas, cast, opts) }.
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

  // ---------- Géométrie de l'arène ----------
  const R = 24, HEART = 6, SECTORS = 6;
  const SECTOR_COLORS = [0xff8a3d, 0x7fb0ff, 0xc08bff, 0x62d6a0, 0xffd166, 0xff5b6b];
  const angleOf = (s, f = 0.5) => ((s + f) / SECTORS) * Math.PI * 2;
  // même convention que les formes 2D tournées à plat : (r cos θ, -r sin θ)
  const pt = (theta, r) => new T.Vector3(Math.cos(theta) * r, 0, -Math.sin(theta) * r);
  const sectorPoint = (s, rnd) => pt(angleOf(s, 0.15 + rnd() * 0.7), lerp(HEART + 2.5, R - 2.5, rnd()));

  const matCache = {};
  const mat = (hex, opts = {}) => {
    const key = hex + JSON.stringify(opts);
    return (matCache[key] ??= new T.MeshLambertMaterial({ color: hex, flatShading: true, ...opts }));
  };
  const box = (w, h, d, hex) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat(hex)); m.castShadow = true; m.receiveShadow = true; return m; };

  function sectorShape(s, r0, r1, pad = 0) {
    const a0 = angleOf(s, 0) + pad, a1 = angleOf(s, 1) - pad;
    const sh = new T.Shape();
    sh.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0);
    sh.absarc(0, 0, r1, a0, a1, false);
    sh.lineTo(Math.cos(a1) * r0, Math.sin(a1) * r0);
    sh.absarc(0, 0, r0, a1, a0, true);
    return sh;
  }
  const flat = (geo) => geo.rotateX(-Math.PI / 2);

  function buildArena(scene, r) {
    const g = new T.Group();
    // sol : le cœur et six zones
    const heart = new T.Mesh(flat(new T.CircleGeometry(HEART, 32)), mat(0x2b2f3a));
    heart.receiveShadow = true; g.add(heart);
    const ring = new T.Mesh(flat(new T.RingGeometry(HEART - 0.25, HEART, 48)), new T.MeshBasicMaterial({ color: 0xffd166 }));
    ring.position.y = 0.03; g.add(ring);
    for (let s = 0; s < SECTORS; s++) {
      const m = new T.Mesh(flat(new T.ShapeGeometry(sectorShape(s, HEART + 0.2, R, 0.01), 12)), mat(s % 2 ? 0x3a4150 : 0x434b5c));
      m.receiveShadow = true; m.position.y = 0.01; g.add(m);
      // liseré lumineux de la zone
      const edge = new T.Mesh(flat(new T.ShapeGeometry(sectorShape(s, R - 0.6, R - 0.2, 0.02), 12)), new T.MeshBasicMaterial({ color: SECTOR_COLORS[s] }));
      edge.position.y = 0.04; g.add(edge);
      // obstacles : colonnes, tonneaux, rampes, blocs de mousse
      for (let i = 0; i < 4; i++) {
        const p = sectorPoint(s, r);
        const kind = (s + i) % 4;
        let o;
        if (kind === 0) { o = new T.Mesh(new T.CylinderGeometry(0.7, 0.8, 3.2, 8), mat(0x8a93a6)); o.position.y = 1.6; }
        else if (kind === 1) { o = new T.Mesh(new T.CylinderGeometry(0.55, 0.55, 1.1, 10), mat(SECTOR_COLORS[s])); o.position.y = 0.55; }
        else if (kind === 2) { o = box(2.4, 0.9, 1.6, 0x5a6275); o.position.y = 0.45; o.rotation.z = 0.18; }
        else { o = box(1.4, 1.4, 1.4, SECTOR_COLORS[s]); o.position.y = 0.7; o.material = mat(SECTOR_COLORS[s], { transparent: true, opacity: 0.85 }); }
        o.castShadow = true; o.receiveShadow = true;
        o.position.x = p.x; o.position.z = p.z; o.rotation.y = r() * 3;
        g.add(o);
      }
    }
    // mur d'enceinte et gradins
    const wall = new T.Mesh(new T.CylinderGeometry(R + 1.2, R + 1.2, 3, 64, 1, true), mat(0x6b7489, { side: T.DoubleSide }));
    wall.position.y = 1.5; wall.receiveShadow = true; g.add(wall);
    const rim = new T.Mesh(flat(new T.RingGeometry(R + 1.2, R + 2.2, 64)), mat(0xffd166)); rim.position.y = 3.02; g.add(rim);
    for (let k = 0; k < 6; k++) {
      const step = new T.Mesh(new T.CylinderGeometry(R + 4 + k * 2.4, R + 4 + k * 2.4, 3.2 + k * 1.6, 64, 1, true), mat(k % 2 ? 0x2a2f3c : 0x323848, { side: T.DoubleSide }));
      step.position.y = (3.2 + k * 1.6) / 2; g.add(step);
      const top = new T.Mesh(flat(new T.RingGeometry(R + 2.2 + k * 2.4, R + 4 + k * 2.4, 64)), mat(k % 2 ? 0x3b4254 : 0x454d61));
      top.position.y = 3.2 + k * 1.6; g.add(top);
    }
    // la porte d'entrée (au sud)
    const gate = new T.Group();
    const lin = box(5, 0.6, 1.2, 0xffd166); lin.position.y = 4.2; gate.add(lin);
    for (const sx of [-2.2, 2.2]) { const p = box(0.6, 4, 1.2, 0x8a93a6); p.position.set(sx, 2, 0); gate.add(p); }
    gate.position.set(0, 0, R + 1.2); g.add(gate);
    scene.add(g);

    // le public : des milliers de petits spectateurs qui sautillent
    const fanGeo = new T.BoxGeometry(0.5, 0.8, 0.5).translate(0, 0.4, 0);
    const fanMat = new T.MeshLambertMaterial({ flatShading: true });
    const N = 1400;
    const fans = new T.InstancedMesh(fanGeo, fanMat, N);
    const base = [];
    const m4 = new T.Matrix4(), col = new T.Color();
    const palette = [0xff8a3d, 0x7fb0ff, 0xc08bff, 0x62d6a0, 0xffd166, 0xff5b6b, 0xf2f2f2, 0xe9cf98];
    for (let i = 0; i < N; i++) {
      const k = Math.floor(r() * 6), th = r() * Math.PI * 2;
      if (Math.abs(Math.cos(th) * 1) < 0.12 && Math.sin(th) < 0) { /* place devant la porte */ }
      const rad = R + 3.1 + k * 2.4 + r() * 1.2;
      const y = 3.2 + k * 1.6;
      base.push([Math.cos(th) * rad, y, Math.sin(th) * rad, r() * 6]);
      m4.makeTranslation(base[i][0], y, base[i][2]); fans.setMatrixAt(i, m4);
      fans.setColorAt(i, col.setHex(palette[Math.floor(r() * palette.length)]));
    }
    fans.instanceColor.needsUpdate = true;
    scene.add(fans);
    let excite = 0.3;
    function updateFans(time) {
      for (let i = 0; i < N; i++) {
        const b = base[i];
        const j = Math.max(0, Math.sin(time * (6 + excite * 6) + b[3])) * 0.35 * excite;
        m4.makeTranslation(b[0], b[1] + j, b[2]); fans.setMatrixAt(i, m4);
      }
      fans.instanceMatrix.needsUpdate = true;
    }

    // projecteurs aux quatre coins
    const towers = [];
    for (let k = 0; k < 4; k++) {
      const th = (k * Math.PI) / 2, rad = R + 17; // jamais dans l'axe de la caméra
      const tw = new T.Group();
      const mast = box(0.8, 16, 0.8, 0x4a5163); mast.position.y = 8; tw.add(mast);
      const head = new T.Mesh(new T.BoxGeometry(3.2, 1.6, 0.6), new T.MeshBasicMaterial({ color: 0xfff6d8 }));
      head.position.y = 16.5; tw.add(head);
      tw.position.set(Math.cos(th) * rad, 0, Math.sin(th) * rad); tw.lookAt(0, 0, 0);
      scene.add(tw); towers.push(head);
    }

    // écrans géants sur le mur
    const screens = [];
    const cv = document.createElement("canvas"); cv.width = 512; cv.height = 192;
    const tex = new T.CanvasTexture(cv);
    for (let k = 0; k < 2; k++) {
      const th = (3 * Math.PI) / 4 + k * Math.PI, rad = R + 9; // sur les côtés, hors de l'axe de la caméra
      const sc = new T.Group();
      const frame = box(10.6, 4.2, 0.4, 0x1b1f28); sc.add(frame);
      const face = new T.Mesh(new T.PlaneGeometry(10, 3.75), new T.MeshBasicMaterial({ map: tex })); face.position.z = 0.21; sc.add(face);
      sc.position.set(Math.cos(th) * rad, 15, Math.sin(th) * rad); sc.lookAt(0, 9, 0);
      scene.add(sc); screens.push(sc);
    }
    function paintScreen(l1, l2, accent = "#ffd166") {
      const c = cv.getContext("2d");
      c.fillStyle = "#11141b"; c.fillRect(0, 0, 512, 192);
      c.fillStyle = accent; c.fillRect(0, 0, 512, 10); c.fillRect(0, 182, 512, 10);
      c.textAlign = "center"; c.fillStyle = "#f4ead2";
      c.font = "700 56px 'Chakra Petch', Arial Narrow, sans-serif"; c.fillText(l1, 256, 86);
      c.fillStyle = accent; c.font = "600 34px 'Chakra Petch', Arial Narrow, sans-serif"; c.fillText(l2, 256, 146);
      tex.needsUpdate = true;
    }

    // la Cage du sursis, suspendue au-dessus du cœur
    const cage = new T.Group();
    const floor = new T.Mesh(new T.CylinderGeometry(2.8, 2.8, 0.25, 16), mat(0x5a6275)); cage.add(floor);
    for (let i = 0; i < 18; i++) {
      const th = (i / 18) * Math.PI * 2;
      const bar = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 3.4, 4), mat(0xd9d9d9));
      bar.position.set(Math.cos(th) * 2.7, 1.7, Math.sin(th) * 2.7); cage.add(bar);
    }
    const roof = new T.Mesh(new T.ConeGeometry(3.1, 1.2, 16), mat(0xff5b6b)); roof.position.y = 4; cage.add(roof);
    const cable = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 30, 4), mat(0x222222)); cable.position.y = 19; cage.add(cable);
    // suspendue au-dessus des gradins du fond, pour ne pas cacher l'arène
    cage.position.set(-(R + 6) * 0.707, 15, -(R + 6) * 0.707);
    scene.add(cage);

    return { updateFans, setExcite: (x) => { excite = x; }, paintScreen, cage, towers };
  }

  // brouillard qui fait éternuer, posé sur une zone fermée
  function buildFog(s) {
    const geo = new T.ExtrudeGeometry(sectorShape(s, HEART + 0.3, R - 0.1, 0.01), { depth: 3.6, bevelEnabled: false, curveSegments: 16 });
    geo.rotateX(-Math.PI / 2);
    const m = new T.Mesh(geo, new T.MeshLambertMaterial({ color: 0xff9ad5, transparent: true, opacity: 0, depthWrite: false }));
    m.scale.y = 0.01;
    return m;
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

  function makePerson(c) {
    const { group, armL, armR, height } = window.TheLastAvatar.build(T, c.look, mat);
    const g = new T.Group(); g.add(group);
    group.rotation.order = "YXZ";
    const s = 1.25 * (height || 1); group.scale.setScalar(s);
    // repère du favori
    const ringM = new T.Mesh(new T.TorusGeometry(0.85, 0.07, 4, 24).rotateX(Math.PI / 2), new T.MeshBasicMaterial({ color: 0xffd166 }));
    ringM.position.y = 0.06; ringM.visible = false; g.add(ringM);
    // peinture rose (cachée)
    const paint = new T.Group();
    for (let i = 0; i < 7; i++) { const b = new T.Mesh(new T.IcosahedronGeometry(0.16 + (i % 3) * 0.05, 0), mat(0xff4fb8)); b.position.set(Math.sin(i * 2.1) * 0.34, 0.6 + i * 0.22, Math.cos(i * 2.1) * 0.3); paint.add(b); }
    paint.visible = false; paint.scale.setScalar(s); g.add(paint);
    // étoiles qui tournent au-dessus de la tête
    const stars = new T.Group();
    for (let i = 0; i < 4; i++) { const st = new T.Mesh(new T.OctahedronGeometry(0.14, 0), new T.MeshBasicMaterial({ color: 0xffe066 })); const th = (i / 4) * Math.PI * 2; st.position.set(Math.cos(th) * 0.5, 0, Math.sin(th) * 0.5); stars.add(st); }
    stars.position.y = 2.75 * s / 1.25; stars.visible = false; g.add(stars);
    // filet
    const net = new T.Mesh(new T.IcosahedronGeometry(1.15, 1), new T.MeshBasicMaterial({ color: 0xe9cf98, wireframe: true }));
    net.position.y = 1.2; net.visible = false; g.add(net);
    // bouclier en mousse
    const shield = new T.Mesh(new T.CylinderGeometry(0.45, 0.45, 0.1, 12).rotateX(Math.PI / 2), mat(0x62d6a0));
    shield.position.set(-0.55, 1.2, 0.2); shield.visible = false; g.add(shield);
    // aura du vainqueur
    const aura = new T.Group();
    const halo = new T.Mesh(new T.TorusGeometry(1.1, 0.12, 6, 32).rotateX(Math.PI / 2), new T.MeshBasicMaterial({ color: 0xffd166 }));
    const beam = new T.Mesh(new T.CylinderGeometry(1.2, 1.2, 9, 16, 1, true), new T.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.18, side: T.DoubleSide, depthWrite: false }));
    beam.position.y = 4.5; aura.add(halo, beam); aura.visible = false; g.add(aura);
    g.userData = { id: c.id, inner: group, armL, armR, ringM, paint, stars, net, shield, aura, target: new T.Vector3(), speed: 3.2, anim: [], scale: s, phase: Math.random() * 6, mode: "idle", nextWander: 0 };
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
    const r = rng(2026);

    const camera = new T.OrthographicCamera(-1, 1, 1, -1, -200, 600);
    camera.position.set(46, 40, 46);
    const controls = new T.OrbitControls(camera, canvas);
    Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, minZoom: 0.7, maxZoom: 7, maxPolarAngle: 1.2, minPolarAngle: 0.35, screenSpacePanning: true });
    const VIEW = 64;
    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      const aspect = w / h, span = aspect < 1 ? VIEW / aspect * 0.8 : VIEW;
      camera.left = (-span * aspect) / 2; camera.right = (span * aspect) / 2; camera.top = span / 2; camera.bottom = -span / 2;
      camera.updateProjectionMatrix();
    }
    new ResizeObserver(resize).observe(canvas);
    resize();

    const hemi = new T.HemisphereLight(0xcfe3ff, 0x30303a, 0.65); scene.add(hemi);
    const sun = new T.DirectionalLight(0xfff1d6, 0.85);
    sun.castShadow = true; sun.shadow.mapSize.set(isSmall ? 1024 : 2048, isSmall ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 200 });
    sun.shadow.bias = -0.0008; sun.position.set(30, 50, 20);
    scene.add(sun, sun.target);
    const flood = new T.PointLight(0xfff0d0, 0, 90); flood.position.set(0, 30, 0); scene.add(flood);

    const A = buildArena(scene, r);
    const fogs = []; for (let s = 0; s < SECTORS; s++) { const f = buildFog(s); scene.add(f); fogs.push(f); }

    // caisses du cœur
    const crates = [];
    for (let i = 0; i < 6; i++) {
      const c = box(0.9, 0.9, 0.9, 0xb4772f); const th = (i / 6) * Math.PI * 2;
      c.position.set(Math.cos(th) * 2.6, 0.45, Math.sin(th) * 2.6);
      const band = new T.Mesh(new T.BoxGeometry(0.95, 0.18, 0.95), new T.MeshBasicMaterial({ color: 0xffd166 })); c.add(band);
      scene.add(c); crates.push(c);
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

    // drones
    const drones = [];
    const getDrone = () => { let d = drones.find((x) => !x.userData.busy); if (!d) { d = makeDrone(); d.position.set(0, 40, 0); scene.add(d); drones.push(d); } d.userData.busy = true; return d; };

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
      pops.push({ el, id, born: clock.elapsedTime, life: 1.6, y: 3.2 });
      if (opts.onPop) opts.onPop(text);
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
    const camGoal = { target: new T.Vector3(0, 2, 0), zoom: 1 };
    controls.addEventListener("start", () => { userHold = clock.elapsedTime + 8; });
    function focus(v, zoom = 2.2) { camGoal.target.set(v.x, 1.5, v.z); camGoal.zoom = zoom; }
    function wide() { camGoal.target.set(0, 2, 0); camGoal.zoom = 1; }

    // ---------- déplacements ----------
    const sectorOf = {};
    function goSector(id, s) { sectorOf[id] = s; const p = people[id]; if (p && p.userData.mode === "idle") p.userData.target.copy(sectorPoint(s, Math.random)); }
    function runTo(id, v, sp = 9) {
      const p = people[id]; p.userData.mode = "run"; p.userData.target.copy(v); p.userData.speed = sp;
      return new Promise((res) => { p.userData.arrive = res; });
    }
    const near = (id, other, d = 1.3) => { const a = people[id].position, b = people[other].position; const dir = new T.Vector3().subVectors(a, b).setY(0); if (dir.length() < 0.01) dir.set(1, 0, 0); return b.clone().add(dir.normalize().multiplyScalar(d)); };
    const face = (id, other) => { const a = people[id], b = people[other]; a.userData.inner.rotation.y = Math.atan2(b.position.x - a.position.x, b.position.z - a.position.z); };
    function release(id) { const p = people[id]; if (!p) return; p.userData.mode = "idle"; p.userData.speed = 3.2; p.userData.nextWander = simTime + 1 + Math.random() * 2; }

    // ---------- animations d'un candidat ----------
    function swing(id, sec = 0.5) { const u = people[id].userData; return tween(sec, (k) => { u.armR.rotation.x = -Math.sin(k * Math.PI) * 2.4; }); }
    function spin(id, sec = 1) { const u = people[id].userData; const r0 = u.inner.rotation.y; return tween(sec, (k) => { u.inner.rotation.y = r0 + ease(k) * Math.PI * 4; }); }
    function dizzy(id, sec = 2.5) { const u = people[id].userData; u.stars.visible = true; u.dizzyUntil = simTime + sec; }
    function fall(id, sec = 0.4) { const u = people[id].userData; return tween(sec, (k) => { u.inner.rotation.x = -ease(k) * 1.45; u.inner.position.y = ease(k) * 0.3; }); }
    function standUp(id, sec = 0.5) { const u = people[id].userData; return tween(sec, (k) => { u.inner.rotation.x = -(1 - ease(k)) * 1.45; u.inner.position.y = (1 - ease(k)) * 0.3; }); }
    function starsLabel(n) { return "★".repeat(n) + "☆".repeat(Math.max(0, 3 - n)); }

    function projectile(from, to, hex, sec = 0.5, size = 0.25) {
      const m = new T.Mesh(new T.IcosahedronGeometry(size, 0), mat(hex)); scene.add(m);
      const a = people[from].position.clone().setY(1.6), b = people[to].position.clone().setY(1.4);
      return tween(sec, (k) => { m.position.lerpVectors(a, b, k); m.position.y += Math.sin(k * Math.PI) * 2; m.rotation.x += 0.3; }).then(() => scene.remove(m));
    }

    async function droneGrab(id, dest) {
      const p = people[id], d = getDrone();
      p.userData.mode = "carried";
      opts.sfx?.("drone");
      const start = new T.Vector3(p.position.x + 8, 26, p.position.z - 8);
      d.position.copy(start);
      const over = p.position.clone().setY(p.position.y + 3.2);
      await tween(1.1, (k) => d.position.lerpVectors(start, over, ease(k)));
      const from = p.position.clone(), dFrom = d.position.clone();
      await tween(1.5, (k) => {
        d.position.lerpVectors(dFrom, dest.clone().setY(dest.y + 3.2), ease(k));
        d.position.y += Math.sin(k * Math.PI) * 6;
        p.position.copy(d.position).setY(d.position.y - 3.2);
      });
      p.position.copy(dest);
      d.userData.busy = false; d.position.set(0, 60, 0);
      return from;
    }
    // places dans la Cage
    const cageSlots = [];
    function cageSpot(id) {
      let i = cageSlots.indexOf(id); if (i < 0) { i = cageSlots.indexOf(null); if (i < 0) i = cageSlots.length; cageSlots[i] = id; }
      const th = (i / 8) * Math.PI * 2, rad = i ? 1.6 : 0.2;
      return new T.Vector3(A.cage.position.x + Math.cos(th) * rad, A.cage.position.y + 0.15, A.cage.position.z + Math.sin(th) * rad);
    }
    const inCage = new Set(), gone = new Set();

    // ---------- jouer un événement ----------
    const KIND_POP = { foam: "BOING !", paint: "SPLAT !", net: "FLOUMP !", banana: "ZIIIP !", potion: "HIC !", betray: "", duel: "POW !", self: "OUPS !", finale: "BAM !" };
    async function play(e) {
      const P = (id) => people[id];
      switch (e.type) {
        case "enter": {
          A.setExcite(1); opts.sfx?.("drum");
          wide();
          const ids = Object.keys(people);
          ids.forEach((id, i) => { const p = P(id); p.position.set(((i % 5) - 2) * 0.9, 0, R + 4 + Math.floor(i / 5) * 1.2); });
          for (const id of ids) runTo(id, sectorPoint(sectorOf[id] ?? 0, Math.random), 7).then(() => release(id));
          await wait(3.5); A.setExcite(0.4);
          break;
        }
        case "loot": {
          const p = P(e.a); focus(p.position, 1.8); showTag(e.a);
          const c = crates[Math.floor(Math.random() * crates.length)];
          await Promise.race([runTo(e.a, c.position.clone().setY(0).add(new T.Vector3(0.9, 0, 0.9))), wait(2.2)]);
          pop(e.a, { foam: "🔨", paint: "🎨", net: "🕸️", potion: "🧪", shield: "🛡️", map: "🗺️" }[e.item] || "📦", "is-item");
          opts.sfx?.("pop");
          if (e.item === "shield") P(e.a).userData.shield.visible = true;
          await wait(0.6); release(e.a);
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
        case "zone": {
          wide(); opts.sfx?.("alert");
          const f = fogs[e.sector]; f.material.opacity = 0;
          await tween(2, (k) => { f.scale.y = Math.max(0.01, ease(k)); f.material.opacity = 0.55 * ease(k); });
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
        case "duelStart": {
          A.setExcite(1); opts.sfx?.("drum");
          focus(new T.Vector3(0, 0, 0), 2.4); showTag(e.a, 8); showTag(e.v, 8);
          await Promise.all([runTo(e.a, new T.Vector3(-1.5, 0, 0)), runTo(e.v, new T.Vector3(1.5, 0, 0))].map((p) => Promise.race([p, wait(2.5)])));
          face(e.a, e.v); face(e.v, e.a);
          for (let i = 0; i < 2; i++) { await swing(e.a, 0.35); opts.sfx?.("thud"); await swing(e.v, 0.35); opts.sfx?.("thud"); }
          break;
        }
        case "hit": {
          const self = e.a === e.v;
          const a = P(e.a), v = P(e.v);
          showTag(e.a); showTag(e.v);
          focus(v.position, 2.4);
          if (e.kind === "betray") { setSlow(0.45); pop(e.a, t("TRAHISON !"), "is-betray"); opts.sfx?.("gasp"); }
          if (!self && e.kind !== "paint" && e.kind !== "duel") await Promise.race([runTo(e.a, near(e.a, e.v, 1.2), 10), wait(2)]);
          if (!self) face(e.a, e.v);
          if (e.kind === "paint") {
            await Promise.race([runTo(e.a, near(e.a, e.v, 5), 10), wait(1.5)]); face(e.a, e.v);
            await projectile(e.a, e.v, 0xff4fb8, 0.5);
            v.userData.paint.visible = true; v.userData.paintUntil = simTime + 25;
            opts.sfx?.("splash");
          } else if (e.kind === "net") {
            await swing(e.a, 0.3);
            v.userData.net.visible = true; opts.sfx?.("whoosh");
            await tween(0.5, (k) => { v.userData.inner.position.y = ease(k) * 2.2; v.userData.net.position.y = 1.2 + ease(k) * 2.2; });
            await wait(1.2);
            await tween(0.3, (k) => { v.userData.inner.position.y = (1 - k) * 2.2; v.userData.net.position.y = 1.2 + (1 - k) * 2.2; });
            v.userData.net.visible = false; opts.sfx?.("thud");
          } else if (e.kind === "banana" || e.kind === "self") {
            const peel = new T.Mesh(new T.TorusGeometry(0.22, 0.08, 4, 8, Math.PI), mat(0xffe066)); peel.position.copy(v.position).setY(0.08); peel.rotation.x = -Math.PI / 2; scene.add(peel);
            await fall(e.v, 0.35); opts.sfx?.("bonk");
            await wait(0.9); await standUp(e.v); scene.remove(peel);
          } else if (e.kind === "potion") {
            await projectile(e.a, e.v, 0x62d6a0, 0.45, 0.18);
            const u = v.userData;
            await tween(1.6, (k) => { const w = 1 + Math.sin(k * 30) * 0.12 * (1 - k); u.inner.scale.set(u.scale * w, u.scale * (2 - w), u.scale * w); });
            u.inner.scale.setScalar(u.scale);
          } else {
            await swing(e.a, 0.4);
            opts.sfx?.("bonk");
            await spin(e.v, 0.8);
          }
          if (e.kind !== "betray") pop(e.v, KIND_POP[e.kind] || "POW !", "is-hit");
          pop(e.v, starsLabel(e.stars), "is-stars");
          dizzy(e.v);
          if (e.kind === "betray") setSlow(1);
          await wait(0.5);
          release(e.a);
          break;
        }
        case "block":
        case "dodge": {
          const v = P(e.v); focus(v.position, 2.3); showTag(e.a); showTag(e.v);
          await Promise.race([runTo(e.a, near(e.a, e.v, 1.3), 10), wait(2)]);
          face(e.a, e.v); await swing(e.a, 0.4);
          pop(e.v, e.type === "block" ? t("🛡️ BLOQUÉ !") : t("🗺️ RATÉ !"), "is-gift"); opts.sfx?.("pop");
          if (e.type === "block") v.userData.shield.visible = false;
          await spin(e.a, 0.6); release(e.a);
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
            A.setExcite(1); opts.sfx?.("cheer");
            await wait(0.6);
          } else focus(A.cage.position, 1.6);
          if (e.type === "ko") {
            await droneGrab(e.v, cageSpot(e.v));
            v.userData.inner.rotation.x = 0; v.userData.inner.position.y = 0;
            v.userData.mode = "cage"; inCage.add(e.v); v.userData.target.copy(v.position);
          } else {
            const th = Math.random() * Math.PI * 2;
            await droneGrab(e.v, new T.Vector3(Math.cos(th) * (R + 40), 30, Math.sin(th) * (R + 40)));
            v.visible = false; v.userData.mode = "gone"; gone.add(e.v); inCage.delete(e.v);
            const i = cageSlots.indexOf(e.v); if (i >= 0) cageSlots[i] = null;
            opts.sfx?.("sad");
          }
          A.setExcite(0.4);
          break;
        }
        case "vote": {
          focus(A.cage.position, 1.6);
          const v = P(e.saved);
          pop(e.saved, t("SAUVÉ·E !"), "is-gift"); opts.sfx?.("fanfare"); A.setExcite(1);
          await wait(0.8);
          await droneGrab(e.saved, sectorPoint(Math.floor(Math.random() * SECTORS), Math.random));
          const i = cageSlots.indexOf(e.saved); if (i >= 0) cageSlots[i] = null;
          inCage.delete(e.saved); v.userData.inner.rotation.x = 0; release(e.saved);
          A.setExcite(0.4);
          break;
        }
        case "finale": {
          wide(); A.setExcite(1); opts.sfx?.("drum");
          for (const id of e.ids) { runTo(id, pt(Math.random() * 6.28, 3 + Math.random() * 2), 6).then(() => release(id)); showTag(id, 30); }
          await wait(2.5);
          break;
        }
        case "win": {
          const p = P(e.a); p.visible = true;
          focus(p.position, 3); p.userData.aura.visible = true; showTag(e.a, 9999);
          await runTo(e.a, new T.Vector3(0, 0, 0), 5).catch(() => {});
          confetti(); opts.sfx?.("fanfare"); A.setExcite(1.4);
          pop(e.a, "🏆", "is-gift");
          await wait(2);
          break;
        }
        default: await wait(0.3);
      }
    }
    let slow = 1;
    function setSlow(x) { slow = x; }

    // confettis de la victoire
    let conf = null;
    function confetti() {
      const n = 500, geo = new T.PlaneGeometry(0.35, 0.2), m = new T.MeshBasicMaterial({ side: T.DoubleSide });
      conf = new T.InstancedMesh(geo, m, n);
      const col = new T.Color(), pal = [0xffd166, 0xff5b6b, 0x7fb0ff, 0x62d6a0, 0xc08bff, 0xff8a3d];
      conf.userData.p = [];
      for (let i = 0; i < n; i++) { conf.setColorAt(i, col.setHex(pal[i % pal.length])); conf.userData.p.push([(Math.random() - 0.5) * 40, 20 + Math.random() * 25, (Math.random() - 0.5) * 40, Math.random() * 6]); }
      conf.instanceColor.needsUpdate = true;
      scene.add(conf);
    }

    // ---------- heure du jour ----------
    const SKY = [[6, 0x223049, 0.3], [9, 0x7fb6d9, 1], [16, 0x8cc0df, 1], [19, 0xe07a4f, 0.65], [20.5, 0x2a2550, 0.35], [23, 0x0b1020, 0.25]];
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
      for (const tw of A.towers) tw.material.color.setHex(night ? 0xfff6d8 : 0x9aa3ad);
    }
    function setScreen(l1, l2) { A.paintScreen(l1, l2); }
    function setClosed(list) { for (const s of list) { fogs[s].scale.y = 1; fogs[s].material.opacity = 0.55; } }
    function setFavorite(id) {
      if (me && people[me]) people[me].userData.ringM.visible = false;
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
      const dt = paused ? 0 : rdt * speed * slow;
      simTime += dt;
      const time = clock.elapsedTime;
      // attentes et interpolations
      for (let i = waits.length - 1; i >= 0; i--) if (simTime >= waits[i].at) { waits[i].res(); waits.splice(i, 1); }
      for (let i = tweens.length - 1; i >= 0; i--) {
        const w = tweens[i], k = clamp((simTime - w.t0) / w.sec, 0, 1);
        w.fn(k); if (k >= 1) { tweens.splice(i, 1); w.res(); }
      }
      // candidats
      for (const id in people) {
        const p = people[id], u = p.userData;
        if (u.mode === "gone" || u.mode === "carried") continue;
        if (u.mode === "cage") { p.position.copy(cageSpot(id)); u.inner.rotation.y += dt * 0.4; continue; }
        if (u.mode === "idle" && simTime > u.nextWander && sectorOf[id] !== undefined) { u.target.copy(sectorPoint(sectorOf[id], Math.random)); u.nextWander = simTime + 3 + Math.random() * 5; }
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
        if (!tweens.length || !moving) { /* le bras droit est piloté par swing() */ }
        u.inner.position.y = u.inner.rotation.x ? u.inner.position.y : (moving ? Math.abs(Math.sin(simTime * 12 + u.phase)) * 0.12 : 0);
        if (u.stars.visible) { u.stars.rotation.y += rdt * 6; if (simTime > u.dizzyUntil) u.stars.visible = false; }
        if (u.paint.visible && simTime > u.paintUntil) u.paint.visible = false;
        if (u.aura.visible) u.aura.rotation.y += rdt;
      }
      for (const d of drones) for (const ro of d.userData.rotors) ro.rotation.y += rdt * 30;
      A.cage.rotation.y += rdt * 0.15;
      A.updateFans(time);
      if (conf) {
        const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), sc = new T.Vector3(1, 1, 1), pos = new T.Vector3();
        conf.userData.p.forEach((c, i) => { c[1] -= rdt * 4; if (c[1] < 0) c[1] = 30; c[3] += rdt * 4; e.set(c[3], c[3] * 0.7, 0); q.setFromEuler(e); pos.set(c[0] + Math.sin(c[3]) * 0.6, c[1], c[2]); m4.compose(pos, q, sc); conf.setMatrixAt(i, m4); });
        conf.instanceMatrix.needsUpdate = true;
      }
      // caméra
      if (clock.elapsedTime > userHold) {
        if (mode === "follow" && me && people[me]?.visible) { const p = people[me].position; camGoal.target.set(p.x, Math.max(1.5, p.y + 1.5), p.z); camGoal.zoom = Math.max(camGoal.zoom, 2.4); }
        if (mode === "wide") { camGoal.target.set(0, 2, 0); camGoal.zoom = 1; }
        const k = 1 - Math.pow(0.05, rdt);
        controls.target.lerp(camGoal.target, k);
        camera.zoom = lerp(camera.zoom, camGoal.zoom, k);
        camera.position.copy(controls.target).add(new T.Vector3(46, 40, 46));
        camera.updateProjectionMatrix();
      }
      controls.update();
      renderer.render(scene, camera);
      // étiquettes
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const place = (el, obj, y) => {
        v3.copy(obj.position); v3.y += y; v3.project(camera);
        el.style.transform = `translate(${((v3.x + 1) / 2) * w}px, ${((1 - v3.y) / 2) * h}px) translate(-50%, -100%)`;
      };
      for (const id in tags) {
        const tg = tags[id], p = people[id];
        const show = p.visible && p.userData.mode !== "gone" && (id === me || simTime < tg.until);
        tg.el.hidden = !show;
        if (show) place(tg.el, p, 2.9 * p.userData.scale / 1.25 + p.userData.inner.position.y);
      }
      for (let i = pops.length - 1; i >= 0; i--) {
        const pp = pops[i], age = time - pp.born;
        if (age > pp.life) { pp.el.remove(); pops.splice(i, 1); continue; }
        const p = people[pp.id];
        if (p) place(pp.el, p, pp.y + age * 1.2 + (pp.el.classList.contains("is-stars") ? -0.6 : 0));
        pp.el.style.opacity = String(1 - Math.max(0, age - pp.life + 0.4) / 0.4);
      }
    }
    frame();

    return {
      play, setHour, setScreen, setClosed, setFavorite, setMode, goSector, wide,
      setSpeed: (x) => { speed = x; }, setPaused: (b) => { paused = b; }, wait,
      focusOn: (id) => { if (people[id]) focus(people[id].position, 2.6); },
      restore(snap) {
        // remet la scène dans l'état d'une photo du moteur (au chargement)
        for (const c of snap.cast) {
          const p = people[c.id];
          if (c.state === "out") { p.visible = false; p.userData.mode = "gone"; gone.add(c.id); }
          else if (c.state === "cage") { p.userData.mode = "cage"; inCage.add(c.id); }
          else { sectorOf[c.id] = c.sector; p.position.copy(sectorPoint(c.sector, Math.random)); p.userData.target.copy(p.position); }
        }
        setClosed(snap.closed);
      },
    };
  }

  window.Arena3D = { init };
})();
