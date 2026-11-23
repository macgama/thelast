// The Last : l'île en 3D low poly (Three.js r128, sans modèle externe : tout est généré ici).
// Expose window.World3D = { init(canvas, data, opts) } qui renvoie un objet de contrôle.
(function () {
  "use strict";
  const T = window.THREE;

  // ---------- Aléatoire déterministe ----------
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
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

  // ---------- Géographie (coordonnées monde : x vers l'est, z vers le sud) ----------
  // Le relief est dessiné sur un plan de base, puis agrandi de S : l'île est 1,5 fois plus grande que les personnages
  const S = 1.5;
  const BASE_ZONES = {
    beach: [0, 25], lagoon: [-27, 17], cliffs: [30, 15], jungle: [-1, 5], mangrove: [-27, -2],
    river: [-12, -14], ruins: [22, -3], waterfall: [4, -20], summit: [29, -22],
    cove: [37, -8], cave: [-17, -25], springs: [12, -11],
  };
  const ZONES = Object.fromEntries(Object.entries(BASE_ZONES).map(([k, [x, z]]) => [k, [x * S, z * S]]));
  const RIVER = [[4, -22], [0, -18], [-6, -15], [-12, -14], [-18, -10], [-24, -5], [-30, -1], [-38, 1], [-48, 2]];
  const gauss = (x, z, cx, cz, s) => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * s * s));
  function distSeg(px, pz, ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(px - ax - t * dx, pz - az - t * dz);
  }
  function riverDist(x, z) { return baseRiverDist(x / S, z / S) * S; }
  function islandMask(x, z) { return baseMask(x / S, z / S); }
  function height(x, z) { return baseHeight(x / S, z / S); }
  function baseRiverDist(x, z) {
    let d = 1e9;
    for (let i = 0; i < RIVER.length - 1; i++) d = Math.min(d, distSeg(x, z, RIVER[i][0], RIVER[i][1], RIVER[i + 1][0], RIVER[i + 1][1]));
    return d;
  }
  function baseMask(x, z) {
    const a = Math.atan2(z, x);
    const wobble = 1 + 0.08 * Math.sin(a * 3 + 1.3) + 0.05 * Math.sin(a * 7 + 0.4) + 0.03 * Math.sin(a * 13);
    const r = Math.hypot(x / 46, (z - 1) / 36) / wobble;
    return smooth(1.02, 0.82, r);
  }
  function baseHeight(x, z) {
    const m = baseMask(x, z);
    let h = lerp(-4, 0.5, m);
    h += m * (13 * gauss(x, z, 31, -23, 6.5) + 8 * gauss(x, z, 6, -27, 6) + 6.5 * gauss(x, z, 33, 16, 4.5) +
      3 * gauss(x, z, 22, -3, 7) + 1.6 * gauss(x, z, -1, 4, 11) + 3 * gauss(x, z, 18, -17, 6));
    // pentes douces et petites bosses
    h += m * 0.35 * (Math.sin(x * 0.7) * Math.cos(z * 0.6) + 0.5 * Math.sin(x * 1.7 + z * 1.3));
    // le lagon, creusé dans la côte ouest
    h -= m * 3.2 * gauss(x, z, -33, 21, 5.5);
    // bassin au pied de la cascade
    h -= m * 2.6 * gauss(x, z, 3, -19, 2.6);
    // la rivière
    const rd = baseRiverDist(x, z);
    if (z > -21) h -= m * 2.2 * smooth(2.6, 0.6, rd);
    // la mangrove : plate et humide
    h = lerp(h, Math.min(h, 0.25), m * gauss(x, z, -29, -2, 7));
    // la crique : une petite baie de sable sur la côte est
    h -= m * 2.6 * gauss(x, z, 43, -9, 4.2);
    // la colline de la grotte, au nord
    h += m * 4.5 * gauss(x, z, -19, -29, 4.5);
    // les sources chaudes : un replat
    h = lerp(h, 1.1, m * gauss(x, z, 12, -11, 3.5));
    return h;
  }
  function zoneAt(x, z) {
    let best = "beach", bd = 1e9;
    for (const [id, [zx, zz]] of Object.entries(ZONES)) {
      const d = (x - zx) ** 2 + (z - zz) ** 2;
      if (d < bd) { bd = d; best = id; }
    }
    return best;
  }

  const GROUND = {
    beach: 0xe3c98f, lagoon: 0xd9c08a, jungle: 0x2f7a3c, mangrove: 0x56703f, river: 0x4f8f4a,
    ruins: 0x8e9a5c, cliffs: 0x7d8a52, waterfall: 0x4c8a55, summit: 0x6d8a4f,
    cove: 0xe3c98f, cave: 0x5f6b4a, springs: 0x7aa07a,
  };
  function groundColor(x, z, h, slope, r) {
    const c = new T.Color();
    if (h < -0.4) return c.setHex(0x2b6c72).offsetHSL(0, 0, (r() - 0.5) * 0.03);
    if (h < 0.55) return c.setHex(h < 0.15 ? 0xc9ad76 : 0xe6cd93).offsetHSL(0, 0, (r() - 0.5) * 0.04);
    const zone = zoneAt(x, z);
    c.setHex(GROUND[zone]);
    if (zone === "beach" || ((zone === "lagoon" || zone === "cove") && h < 1.2)) c.setHex(0xe3c98f);
    if (slope > 0.9 || h > 9.5) c.setHex(h > 11 ? 0xb3aba0 : 0x8d8173);
    else if (slope > 0.6) c.lerp(new T.Color(0x8d8173), 0.55);
    return c.offsetHSL((r() - 0.5) * 0.02, 0, (r() - 0.5) * 0.06);
  }

  // ---------- Matériaux partagés ----------
  const matCache = {};
  const mat = (hex, opts = {}) => {
    const key = hex + JSON.stringify(opts);
    return (matCache[key] ??= new T.MeshLambertMaterial({ color: hex, flatShading: true, ...opts }));
  };

  function buildTerrain(scene, r) {
    const geo = new T.PlaneGeometry(130 * S, 104 * S, 140, 112).toNonIndexed();
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + (r() - 0.5) * 0.0, z = pos.getZ(i);
      pos.setY(i, height(x, z));
    }
    const colors = new Float32Array(pos.count * 3);
    const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), n = new T.Vector3();
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
      n.subVectors(c, b).cross(new T.Vector3().subVectors(a, b)).normalize();
      const cx = (a.x + b.x + c.x) / 3, cz = (a.z + b.z + c.z) / 3, cy = (a.y + b.y + c.y) / 3;
      const col = groundColor(cx, cz, cy, 1 - Math.abs(n.y), r);
      for (let k = 0; k < 3; k++) col.toArray(colors, (i + k) * 3);
    }
    geo.setAttribute("color", new T.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new T.Mesh(geo, new T.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  function buildWater(scene) {
    const geo = new T.PlaneGeometry(320, 320, 64, 64);
    geo.rotateX(-Math.PI / 2);
    const m = new T.MeshPhongMaterial({ color: 0x2aa0b4, transparent: true, opacity: 0.8, flatShading: true, shininess: 90, specular: 0x9fe6f0 });
    const mesh = new T.Mesh(geo, m);
    mesh.position.y = 0.02;
    mesh.receiveShadow = true;
    scene.add(mesh);
    // écume le long du rivage
    const foam = new T.Mesh(new T.RingGeometry(1, 1.02, 90, 1), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
    foam.rotation.x = -Math.PI / 2;
    foam.scale.set(46.5 * S, 37 * S, 1);
    foam.position.set(0, 0.08, 1 * S);
    scene.add(foam);
    return { mesh, foam, base: Float32Array.from(geo.attributes.position.array) };
  }

  function buildRiver(scene) {
    const pts = RIVER.slice(0, 8).map(([x, z]) => new T.Vector3(x * S, 0, z * S));
    const curve = new T.CatmullRomCurve3(pts);
    const n = 110, w = 1.7 * S;
    const verts = [];
    for (let i = 0; i < n; i++) {
      const p0 = curve.getPoint(i / n), p1 = curve.getPoint((i + 1) / n);
      const d0 = curve.getTangent(i / n), d1 = curve.getTangent((i + 1) / n);
      const s0 = new T.Vector3(-d0.z, 0, d0.x).multiplyScalar(w), s1 = new T.Vector3(-d1.z, 0, d1.x).multiplyScalar(w);
      const y0 = Math.max(height(p0.x, p0.z), -0.6) + 0.35, y1 = Math.max(height(p1.x, p1.z), -0.6) + 0.35;
      const A = [p0.x + s0.x, y0, p0.z + s0.z], B = [p0.x - s0.x, y0, p0.z - s0.z], C = [p1.x + s1.x, y1, p1.z + s1.z], E = [p1.x - s1.x, y1, p1.z - s1.z];
      verts.push(...A, ...B, ...C, ...B, ...E, ...C);
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    const mesh = new T.Mesh(geo, new T.MeshPhongMaterial({ color: 0x3fb3c6, flatShading: true, transparent: true, opacity: 0.88, side: T.DoubleSide, shininess: 100 }));
    scene.add(mesh);
  }

  // Cascade : une nappe d'eau animée qui tombe du plateau dans le bassin
  function buildWaterfall(scene) {
    const cv = document.createElement("canvas");
    cv.width = 32; cv.height = 128;
    const g = cv.getContext("2d");
    g.fillStyle = "#6fd0e0"; g.fillRect(0, 0, 32, 128);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.5})`; g.fillRect(Math.random() * 32, Math.random() * 128, 1 + Math.random() * 3, 6 + Math.random() * 18); }
    const tex = new T.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.repeat.set(2, 1);
    const top = height(4 * S, -23.5 * S);
    const fall = new T.Mesh(new T.PlaneGeometry(3.2 * 1.3, top + 0.5, 1, 4), new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9, side: T.DoubleSide }));
    fall.position.set(4 * S, (top + 0.5) / 2 - 0.2, -21.6 * S);
    fall.rotation.x = -0.25;
    scene.add(fall);
    // brume au pied
    const mist = new T.Group();
    for (let i = 0; i < 14; i++) {
      const m = new T.Mesh(new T.IcosahedronGeometry(0.35 + Math.random() * 0.35, 0), new T.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, flatShading: true }));
      m.position.set(4 * S + (Math.random() - 0.5) * 3.5, 0.4, -20 * S + (Math.random() - 0.5) * 2);
      m.userData.phase = Math.random() * 6;
      mist.add(m);
    }
    scene.add(mist);
    return { tex, mist };
  }

  // ---------- Végétation et rochers (instanciés) ----------
  function instanced(geo, material, count) {
    const m = new T.InstancedMesh(geo, material, count);
    m.castShadow = true;
    m.receiveShadow = true;
    m.instanceMatrix.setUsage(T.StaticDrawUsage);
    return m;
  }

  function buildVegetation(scene, r) {
    const dummy = new T.Object3D();
    const spots = { palm: [], tree: [], pine: [], bush: [], rock: [], mangrove: [], fern: [] };
    for (let i = 0; i < 5200; i++) {
      const x = (r() - 0.5) * 100 * S, z = (r() - 0.5) * 82 * S;
      const h = height(x, z);
      if (h < 0.35 || islandMask(x, z) < 0.5) continue;
      if (riverDist(x, z) < 2.3 * S && z > -21 * S) continue;
      const zone = zoneAt(x, z);
      const ox = x - ZONES[zone][0], oz = z - ZONES[zone][1];
      if (Math.hypot(ox, oz) < 6.8 * S) continue; // clairière pour les candidats
      // couloir dégagé vers la caméra, pour que les arbres ne cachent pas les scènes
      const along = (ox + oz) * 0.7071, side = (ox - oz) * 0.7071;
      if (along > -3 && along < 13 * S && Math.abs(side) < 6 * S) continue;
      const roll = r();
      const slopeRock = h > 9;
      if (slopeRock) { if (roll < 0.18) spots.rock.push([x, h, z]); else if (roll < 0.24) spots.pine.push([x, h, z]); continue; }
      if (h < 1.1 && (zone === "beach" || zone === "lagoon")) { if (roll < 0.07) spots.palm.push([x, h, z]); else if (roll < 0.09) spots.rock.push([x, h, z]); continue; }
      switch (zone) {
        case "jungle": if (roll < 0.42) spots.tree.push([x, h, z]); else if (roll < 0.62) spots.fern.push([x, h, z]); else if (roll < 0.66) spots.palm.push([x, h, z]); break;
        case "mangrove": if (roll < 0.28) spots.mangrove.push([x, h, z]); else if (roll < 0.4) spots.bush.push([x, h, z]); break;
        case "river": if (roll < 0.25) spots.tree.push([x, h, z]); else if (roll < 0.4) spots.fern.push([x, h, z]); else if (roll < 0.45) spots.rock.push([x, h, z]); break;
        case "waterfall": if (roll < 0.22) spots.tree.push([x, h, z]); else if (roll < 0.3) spots.rock.push([x, h, z]); else if (roll < 0.38) spots.fern.push([x, h, z]); break;
        case "ruins": if (roll < 0.08) spots.tree.push([x, h, z]); else if (roll < 0.2) spots.bush.push([x, h, z]); else if (roll < 0.26) spots.rock.push([x, h, z]); break;
        case "cliffs": if (roll < 0.14) spots.rock.push([x, h, z]); else if (roll < 0.2) spots.pine.push([x, h, z]); else if (roll < 0.26) spots.bush.push([x, h, z]); break;
        case "summit": if (roll < 0.14) spots.pine.push([x, h, z]); else if (roll < 0.24) spots.rock.push([x, h, z]); break;
        default: if (roll < 0.06) spots.palm.push([x, h, z]); else if (roll < 0.1) spots.bush.push([x, h, z]);
      }
    }
    const put = (mesh, list, fn) => {
      list.forEach((p, i) => { fn(p, i); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      scene.add(mesh);
    };
    const tint = (mesh, i, hex, v) => mesh.setColorAt(i, new T.Color(hex).offsetHSL((r() - 0.5) * 0.04, 0, (r() - 0.5) * v));

    // Palmiers : tronc courbé + couronne de palmes
    const trunkGeo = new T.CylinderGeometry(0.12, 0.2, 3.2, 5);
    trunkGeo.translate(0, 1.6, 0);
    const palmTrunk = instanced(trunkGeo, mat(0x8a6a44), spots.palm.length);
    const leafGeo = new T.ConeGeometry(1.7, 0.9, 6, 1);
    leafGeo.translate(0, 3.3, 0);
    const palmLeaf = instanced(leafGeo, new T.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), spots.palm.length);
    spots.palm.forEach(([x, h, z], i) => {
      const s = 0.8 + r() * 0.5, lean = (r() - 0.5) * 0.35, rot = r() * 6.3;
      dummy.position.set(x, h - 0.1, z); dummy.rotation.set(lean, rot, lean * 0.6); dummy.scale.set(s, s, s);
      dummy.updateMatrix(); palmTrunk.setMatrixAt(i, dummy.matrix); palmLeaf.setMatrixAt(i, dummy.matrix);
      tint(palmLeaf, i, 0x3f9a45, 0.08);
    });
    [palmTrunk, palmLeaf].forEach((m) => { m.instanceMatrix.needsUpdate = true; scene.add(m); });
    tall.push({ meshes: [palmTrunk, palmLeaf], pts: spots.palm, top: 3 });

    // Arbres de jungle : tronc + houppier en icosaèdre
    const tTrunkGeo = new T.CylinderGeometry(0.18, 0.28, 1.6, 5); tTrunkGeo.translate(0, 0.8, 0);
    const tTop = new T.IcosahedronGeometry(1.3, 0); tTop.translate(0, 2.3, 0);
    const treeTrunk = instanced(tTrunkGeo, mat(0x6b4a2e), spots.tree.length);
    const treeTop = instanced(tTop, new T.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), spots.tree.length);
    spots.tree.forEach(([x, h, z], i) => {
      const s = 0.75 + r() * 0.8;
      dummy.position.set(x, h - 0.1, z); dummy.rotation.set(0, r() * 6.3, 0); dummy.scale.set(s, s * (0.9 + r() * 0.5), s);
      dummy.updateMatrix(); treeTrunk.setMatrixAt(i, dummy.matrix); treeTop.setMatrixAt(i, dummy.matrix);
      tint(treeTop, i, r() < 0.15 ? 0x6aa83a : 0x2c7a36, 0.1);
    });
    [treeTrunk, treeTop].forEach((m) => { m.instanceMatrix.needsUpdate = true; scene.add(m); });
    tall.push({ meshes: [treeTrunk, treeTop], pts: spots.tree, top: 2.3 });

    // Conifères d'altitude
    const pineGeo = new T.ConeGeometry(0.9, 2.6, 6); pineGeo.translate(0, 1.6, 0);
    const pine = instanced(pineGeo, new T.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), spots.pine.length);
    tall.push({ meshes: [pine], pts: spots.pine, top: 1.8 });
    put(pine, spots.pine, ([x, h, z], i) => { const s = 0.7 + r() * 0.6; dummy.position.set(x, h - 0.1, z); dummy.rotation.set(0, r() * 6, 0); dummy.scale.set(s, s, s); tint(pine, i, 0x2f5f3a, 0.08); });

    // Buissons et fougères
    const bushGeo = new T.DodecahedronGeometry(0.7, 0); bushGeo.translate(0, 0.35, 0);
    const bush = instanced(bushGeo, new T.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), spots.bush.length);
    put(bush, spots.bush, ([x, h, z], i) => { const s = 0.6 + r() * 0.7; dummy.position.set(x, h, z); dummy.rotation.set(0, r() * 6, 0); dummy.scale.set(s, s * 0.7, s); tint(bush, i, 0x4a8a3a, 0.1); });
    const fernGeo = new T.ConeGeometry(0.6, 0.8, 5, 1, true); fernGeo.translate(0, 0.3, 0); fernGeo.rotateX(Math.PI);
    fernGeo.translate(0, 0.7, 0);
    const fern = instanced(fernGeo, new T.MeshLambertMaterial({ color: 0xffffff, flatShading: true, side: T.DoubleSide }), spots.fern.length);
    put(fern, spots.fern, ([x, h, z], i) => { const s = 0.6 + r() * 0.6; dummy.position.set(x, h - 0.1, z); dummy.rotation.set(0, r() * 6, 0); dummy.scale.set(s, s, s); tint(fern, i, 0x3d9a4a, 0.1); });

    // Rochers
    const rockGeo = new T.DodecahedronGeometry(0.8, 0);
    const rock = instanced(rockGeo, new T.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), spots.rock.length);
    put(rock, spots.rock, ([x, h, z], i) => { const s = 0.4 + r() * 1.1; dummy.position.set(x, h + 0.1, z); dummy.rotation.set(r() * 3, r() * 3, r() * 3); dummy.scale.set(s, s * (0.6 + r() * 0.5), s); tint(rock, i, 0x8f877d, 0.12); });

    // Palétuviers : racines aériennes + feuillage plat
    const rootGeo = new T.ConeGeometry(0.7, 1.1, 5, 1, true); rootGeo.translate(0, 0.55, 0);
    const roots = instanced(rootGeo, new T.MeshLambertMaterial({ color: 0x5a4632, flatShading: true, wireframe: false, side: T.DoubleSide }), spots.mangrove.length);
    const crownGeo = new T.SphereGeometry(1.4, 6, 3); crownGeo.scale(1, 0.45, 1); crownGeo.translate(0, 1.8, 0);
    const crown = instanced(crownGeo, new T.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), spots.mangrove.length);
    spots.mangrove.forEach(([x, h, z], i) => {
      const s = 0.7 + r() * 0.5;
      dummy.position.set(x, h - 0.2, z); dummy.rotation.set(0, r() * 6, 0); dummy.scale.set(s, s, s);
      dummy.updateMatrix(); roots.setMatrixAt(i, dummy.matrix); crown.setMatrixAt(i, dummy.matrix);
      tint(crown, i, 0x4f7a3a, 0.08);
    });
    [roots, crown].forEach((m) => { m.instanceMatrix.needsUpdate = true; scene.add(m); });
    for (const g of tall) { g.orig = g.meshes.map((m) => m.instanceMatrix.array.slice()); g.hidden = new Uint8Array(g.pts.length); }
  }

  // ---------- Arbres qui masquent l'action ----------
  // Quand la caméra est proche, on escamote les arbres situés entre elle et la scène filmée.
  const tall = [];
  const occ = new T.Vector3(), occDir = new T.Vector3();
  function clearView(target, camPos, radius) {
    if (radius) occDir.subVectors(camPos, target).normalize();
    for (const g of tall) {
      let dirty = false;
      for (let i = 0; i < g.pts.length; i++) {
        let hide = 0;
        if (radius) {
          const [x, h, z] = g.pts[i];
          occ.set(x - target.x, h + g.top - target.y, z - target.z);
          const t = occ.dot(occDir);
          if (t > 0.5) { occ.addScaledVector(occDir, -t); hide = occ.length() < radius ? 1 : 0; }
        }
        if (hide === g.hidden[i]) continue;
        g.hidden[i] = hide; dirty = true;
        g.meshes.forEach((m, k) => { const a = m.instanceMatrix.array, o = i * 16; if (hide) a.fill(0, o, o + 16); else a.set(g.orig[k].subarray(o, o + 16), o); });
      }
      if (dirty) g.meshes.forEach((m) => (m.instanceMatrix.needsUpdate = true));
    }
  }

  // ---------- Lieux remarquables ----------
  function box(w, h, d, hex) { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat(hex)); m.castShadow = true; m.receiveShadow = true; return m; }
  function at(obj, x, z, dy = 0) { obj.position.set(x, height(x, z) + dy, z); return obj; }

  function buildLandmarks(scene, r) {
    const out = {};
    // Ponton d'arrivée et bateau de la production, sur la plage
    const pier = new T.Group();
    for (let i = 0; i < 9; i++) { const p = box(2.2, 0.15, 0.7, i % 2 ? 0x9a7650 : 0x8a6a44); p.position.set(0, 0.55, 30 * S + i * 0.75); pier.add(p); }
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) { const post = box(0.2, 2, 0.2, 0x5a4632); post.position.set(s * 1.05, -0.3, 30 * S + i * 1.6); pier.add(post); }
    scene.add(pier);
    const boat = new T.Group();
    const hull = new T.Mesh(new T.CylinderGeometry(1.2, 0.6, 5.5, 6, 1), mat(0xf2f2f2)); hull.rotation.x = Math.PI / 2; hull.scale.set(1, 1, 0.5); hull.castShadow = true;
    const cabin = box(1.4, 0.9, 1.8, 0x1d5a66); cabin.position.set(0, 0.7, -0.4);
    const stripe = box(2.25, 0.18, 4.6, 0xff8a3d); stripe.position.y = 0.15;
    boat.add(hull, stripe, cabin);
    boat.position.set(3.4, 0.35, 30 * S + 6.5);
    scene.add(boat);
    out.boat = boat;

    // Camp de base : feu, rondins et cabane du confessionnal
    const camp = new T.Group();
    const stones = new T.Group();
    for (let i = 0; i < 8; i++) { const s = new T.Mesh(new T.DodecahedronGeometry(0.22, 0), mat(0x777068)); s.position.set(Math.cos(i / 8 * 6.28) * 0.6, 0.1, Math.sin(i / 8 * 6.28) * 0.6); stones.add(s); }
    const flame = new T.Mesh(new T.ConeGeometry(0.35, 0.9, 5), new T.MeshBasicMaterial({ color: 0xffa040 }));
    flame.position.y = 0.45;
    const flame2 = new T.Mesh(new T.ConeGeometry(0.2, 0.6, 5), new T.MeshBasicMaterial({ color: 0xfff08a }));
    flame2.position.y = 0.35;
    camp.add(stones, flame, flame2);
    for (const a of [0.4, 2.1, 3.9]) { const log = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 1.8, 6), mat(0x7a5634)); log.rotation.z = Math.PI / 2; log.rotation.y = a; log.position.set(Math.cos(a) * 1.7, 0.2, Math.sin(a) * 1.7); log.castShadow = true; camp.add(log); }
    at(camp, 4.5 * S, 21 * S, 0);
    scene.add(camp);
    const fireLight = new T.PointLight(0xff9a40, 0, 16, 2);
    fireLight.position.set(4.5 * S, height(4.5 * S, 21 * S) + 1.5, 21 * S);
    scene.add(fireLight);
    out.fire = { flame, flame2, light: fireLight };

    const booth = new T.Group(); // cabane du confessionnal
    const walls = box(2.2, 2, 2, 0x6a2f3a); walls.position.y = 1;
    const roof = new T.Mesh(new T.ConeGeometry(1.9, 1.2, 4), mat(0x3a1c22)); roof.position.y = 2.6; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
    const door = box(0.8, 1.3, 0.05, 0x1b0f12); door.position.set(0, 0.65, 1.01);
    const lamp = new T.Mesh(new T.SphereGeometry(0.15, 6, 4), new T.MeshBasicMaterial({ color: 0xff5b6b })); lamp.position.set(0, 1.6, 1.05);
    booth.add(walls, roof, door, lamp);
    at(booth, -6 * S, 22.5 * S); booth.rotation.y = 0.5;
    scene.add(booth);
    out.lamp = lamp;

    // Les ruines : temple à degrés, colonnes, arche effondrée
    const ruins = new T.Group();
    for (let k = 0; k < 3; k++) { const step = box(6 - k * 1.6, 0.6, 6 - k * 1.6, k === 2 ? 0xb8ad8e : 0xa39a7c); step.position.y = 0.3 + k * 0.6; ruins.add(step); }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, hh = i % 3 === 0 ? 0.9 + r() : 3;
      const col = new T.Mesh(new T.CylinderGeometry(0.32, 0.36, hh, 6), mat(0xbdb397)); col.castShadow = true;
      col.position.set(Math.cos(a) * 5.2, hh / 2, Math.sin(a) * 5.2);
      ruins.add(col);
    }
    const lintel = box(4.2, 0.5, 0.6, 0xb0a688); lintel.position.set(0, 3.2, -5.2); ruins.add(lintel);
    const fallen = new T.Mesh(new T.CylinderGeometry(0.32, 0.36, 3, 6), mat(0xa9a087)); fallen.rotation.z = Math.PI / 2; fallen.rotation.y = 0.7; fallen.position.set(4, 0.35, 3); ruins.add(fallen);
    const idol = new T.Mesh(new T.OctahedronGeometry(0.5, 0), new T.MeshLambertMaterial({ color: 0xe6b84a, emissive: 0x4a3000, flatShading: true })); idol.position.y = 2.4; ruins.add(idol);
    at(ruins, 25 * S, -6 * S, -0.3);
    scene.add(ruins);
    out.idol = idol;

    // Le sommet : cairn et drapeau de l'émission
    const summit = new T.Group();
    for (let i = 0; i < 6; i++) { const s = new T.Mesh(new T.DodecahedronGeometry(0.5 - i * 0.06, 0), mat(0x9a9288)); s.position.set((r() - 0.5) * 0.3, 0.3 + i * 0.4, (r() - 0.5) * 0.3); s.castShadow = true; summit.add(s); }
    const pole = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 4.5, 5), mat(0xdddddd)); pole.position.set(0.9, 2.25, 0); summit.add(pole);
    const flagGeo = new T.PlaneGeometry(1.8, 1.1, 8, 1);
    const flag = new T.Mesh(flagGeo, new T.MeshLambertMaterial({ color: 0xff8a3d, side: T.DoubleSide, flatShading: true }));
    flag.position.set(1.8, 3.9, 0); summit.add(flag);
    at(summit, 31 * S, -23 * S, -0.2);
    scene.add(summit);
    out.flag = { mesh: flag, base: Float32Array.from(flagGeo.attributes.position.array) };

    // Les falaises : aiguilles de roche
    for (let i = 0; i < 7; i++) {
      const x = (36 + r() * 6) * S, z = (9 + r() * 14) * S;
      const sp = new T.Mesh(new T.CylinderGeometry(0.2 + r() * 0.4, 1 + r() * 0.8, 3 + r() * 5, 5), mat(0x8d8173));
      sp.castShadow = true;
      at(sp, x, z, 1.2);
      scene.add(sp);
    }
    // Une épave sur la plage
    const wreck = new T.Group();
    const wh = new T.Mesh(new T.CylinderGeometry(1, 0.5, 4, 5, 1, true, 0, Math.PI), new T.MeshLambertMaterial({ color: 0x6b4a2e, side: T.DoubleSide, flatShading: true }));
    wh.rotation.set(Math.PI / 2, 0, 0.4); wreck.add(wh);
    const mast = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 3.5, 5), mat(0x5a4632)); mast.rotation.z = 0.9; mast.position.set(0.5, 1, 0); wreck.add(mast);
    at(wreck, -14 * S, 28 * S, 0.2); wreck.rotation.y = 1.2;
    scene.add(wreck);
    // Pont de lianes au-dessus de la rivière
    const bridge = new T.Group();
    for (let i = 0; i < 12; i++) { const pl = box(0.5, 0.08, 1.6, 0x9a7650); pl.position.set(i * 0.55 - 3.0, 0.0 - Math.sin((i / 11) * Math.PI) * 0.35, 0); bridge.add(pl); }
    at(bridge, -9 * S, -14.5 * S, 1.4); bridge.rotation.y = 0.6;
    scene.add(bridge);
    // La grotte : une entrée sombre dans la colline
    const cave = new T.Group();
    const arch = new T.Mesh(new T.CylinderGeometry(2.4, 2.8, 1.6, 7, 1, false, 0, Math.PI), mat(0x6f675d)); arch.rotation.set(Math.PI / 2, 0, Math.PI / 2); arch.scale.set(1, 1.2, 1.3); arch.position.y = 0.6; cave.add(arch);
    const hole = new T.Mesh(new T.CircleGeometry(1.7, 10, 0, Math.PI), new T.MeshBasicMaterial({ color: 0x0b0d10 })); hole.position.set(0, 0.05, 0.85); cave.add(hole);
    for (let i = 0; i < 5; i++) { const st = new T.Mesh(new T.ConeGeometry(0.18, 0.7, 5), mat(0x8d8173)); st.rotation.x = Math.PI; st.position.set(-1.2 + i * 0.6, 2.0 - (i % 2) * 0.2, 0.9); cave.add(st); }
    const [gx, gz] = ZONES.cave;
    at(cave, gx - 1.5, gz - 4.5, 0); cave.rotation.y = 0.2;
    scene.add(cave);
    // Les sources chaudes : bassins turquoise et vapeur
    const springs = new T.Group();
    const steam = [];
    for (const [dx, dz, rr] of [[0, 0, 1.6], [2.6, 1.2, 1.1], [-2.2, 1.6, 0.9]]) {
      const rim = new T.Mesh(new T.TorusGeometry(rr, 0.18, 4, 14), mat(0xb3aba0)); rim.rotation.x = Math.PI / 2; rim.position.set(dx, 0.12, dz); springs.add(rim);
      const pool = new T.Mesh(new T.CircleGeometry(rr, 14), new T.MeshLambertMaterial({ color: 0x5fd3c8, emissive: 0x0a3a36 })); pool.rotation.x = -Math.PI / 2; pool.position.set(dx, 0.1, dz); springs.add(pool);
      for (let k = 0; k < 3; k++) { const m = new T.Mesh(new T.IcosahedronGeometry(0.4, 0), new T.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, flatShading: true })); m.position.set(dx + (r() - 0.5) * rr, 0.6, dz + (r() - 0.5) * rr); m.userData = { y0: 0.4, ph: r() * 6 }; springs.add(m); steam.push(m); }
    }
    const [sx, sz] = ZONES.springs;
    at(springs, sx + 3.5, sz + 3, 0);
    scene.add(springs);
    out.steam = steam;
    // La crique : une barque échouée et des filets
    const dinghy = new T.Group();
    const dh = new T.Mesh(new T.CylinderGeometry(0.7, 0.35, 2.6, 6, 1, true, 0, Math.PI), new T.MeshLambertMaterial({ color: 0x3d7ea6, side: T.DoubleSide, flatShading: true })); dh.rotation.set(Math.PI / 2, 0, Math.PI); dinghy.add(dh);
    const [cx0, cz0] = ZONES.cove;
    at(dinghy, cx0 + 3, cz0 - 2, 0.4); dinghy.rotation.y = 0.8;
    scene.add(dinghy);
    // Drones caméras de la production
    const cams = [];
    for (let i = 0; i < 3; i++) { const d = makeDrone(0x2a2a30); d.scale.setScalar(0.6); d.userData = { r: (16 + i * 10) * S, s: 0.08 + i * 0.03, p: i * 2, y: 9 + i * 2 }; scene.add(d); cams.push(d); }
    out.cams = cams;
    return out;
  }

  function makeDrone(hex = 0xffffff) {
    const g = new T.Group();
    const body = box(0.9, 0.3, 0.9, hex); g.add(body);
    const red = new T.Mesh(new T.BoxGeometry(0.92, 0.08, 0.2), new T.MeshBasicMaterial({ color: 0xff5b6b })); red.position.y = 0.12; g.add(red);
    for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const arm = box(0.08, 0.08, 0.8, 0x333333); arm.position.set(x * 0.45, 0.1, z * 0.45); arm.rotation.y = Math.atan2(x, z); g.add(arm);
      const rot = new T.Mesh(new T.CylinderGeometry(0.4, 0.4, 0.03, 8), new T.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.5 }));
      rot.position.set(x * 0.7, 0.22, z * 0.7); g.add(rot);
    }
    return g;
  }

  // ---------- Personnages ----------
  const SKIN = [0xf6d3b3, 0xe9b48f, 0xc98e62, 0xa86b45, 0x7b4a2d, 0x563220];
  const HAIR = [0x1d1512, 0x3b2418, 0x6b3e1f, 0xb4772f, 0xd9b36c, 0x8a8f99, 0xa33b2b];
  const SHIRT = [0xff8a3d, 0x62d6a0, 0xe9cf98, 0x7fb0ff, 0xff5b6b, 0xc08bff, 0xf2f2f2];
  const PANTS = [0x2b2b35, 0x3a4a5a, 0x5a4a3a, 0x2f3f2f];
  const GEO = {
    legs: new T.BoxGeometry(0.46, 0.7, 0.3).translate(0, 0.35, 0),
    body: new T.CylinderGeometry(0.3, 0.36, 0.8, 6).translate(0, 1.1, 0),
    arm: new T.BoxGeometry(0.14, 0.62, 0.14).translate(0, -0.28, 0),
    head: new T.IcosahedronGeometry(0.28, 1).translate(0, 1.76, 0),
    hairCap: new T.SphereGeometry(0.31, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.8, 0),
    hairLong: new T.BoxGeometry(0.5, 0.55, 0.16).translate(0, 1.62, -0.2),
    bun: new T.IcosahedronGeometry(0.14, 0).translate(0, 2.1, -0.05),
    afro: new T.IcosahedronGeometry(0.42, 0).translate(0, 1.9, -0.02),
    brim: new T.CylinderGeometry(0.42, 0.42, 0.04, 8).translate(0, 1.98, 0.05),
    helmet: new T.SphereGeometry(0.34, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.84, 0),
    pack: new T.BoxGeometry(0.4, 0.5, 0.22).translate(0, 1.15, -0.3),
    visor: new T.BoxGeometry(0.4, 0.1, 0.12).translate(0, 1.8, 0.24),
    glove: new T.IcosahedronGeometry(0.15, 0).translate(0, -0.64, 0),
    phones: new T.TorusGeometry(0.33, 0.045, 4, 12, Math.PI).translate(0, 1.78, 0),
    cup: new T.CylinderGeometry(0.11, 0.11, 0.08, 8).rotateZ(Math.PI / 2),
    glasses: new T.BoxGeometry(0.4, 0.07, 0.05).translate(0, 1.79, 0.27),
    tie: new T.BoxGeometry(0.09, 0.45, 0.04).translate(0, 1.2, 0.33),
    rod: new T.CylinderGeometry(0.025, 0.035, 2.4, 4).translate(0, 1.2, 0),
    necklace: new T.TorusGeometry(0.33, 0.05, 4, 14).rotateX(Math.PI / 2).translate(0, 1.47, 0.02),
    pendant: new T.OctahedronGeometry(0.1, 0).translate(0, 1.34, 0.33),
    ring: new T.TorusGeometry(0.85, 0.07, 4, 24).rotateX(Math.PI / 2).translate(0, 0.06, 0),
    beam: new T.CylinderGeometry(0.05, 0.05, 6, 6, 1, true).translate(0, 4.6, 0),
    arrow: new T.ConeGeometry(0.28, 0.5, 4).rotateX(Math.PI).translate(0, 2.75, 0),
  };
  // Accessoires des 5 candidats suivis, pour les reconnaître de loin
  const SIGNATURE = {
    c046: { beanie: 0x1d3557, shirt: 0xffc43d },                // Noa, bonnet et ciré de navigateur·ice
    c085: { phones: 0xc08bff, shirt: 0x7fb0ff },                 // Selin, casque audio de développeuse
    c053: { glasses: 0x111111, tie: 0x7a1f2b, shirt: 0xf2f2f2 }, // Matthias, chemise blanche et cravate
    c071: { cap: 0xc8a165, pack: 0x7a5230 },                     // Omar, chapeau et sac d'archéologue
    c086: { glasses: 0x3a2a1a, tie: 0x1f4e8c, shirt: 0xd9c7a3 }, // Louis, costume beige d'agent immobilier
  };

  function makePerson(c) {
    const h = hash(c.id);
    const g = new T.Group();
    const sig = SIGNATURE[c.id];
    const skin = SKIN[h % 6], hair = HAIR[(h >> 3) % 7], shirt = sig?.shirt ?? SHIRT[(h >> 9) % 7], pants = PANTS[(h >> 5) % 4];
    g.rotation.order = "YXZ";
    const add = (geo, hex, y = 0) => { const m = new T.Mesh(geo, mat(hex)); m.castShadow = true; m.position.y = y; g.add(m); return m; };
    add(GEO.legs, pants); add(GEO.body, shirt); add(GEO.head, skin);
    const armL = add(GEO.arm, shirt); armL.position.set(-0.38, 1.45, 0);
    const armR = add(GEO.arm, shirt); armR.position.set(0.38, 1.45, 0);
    const styles = c.gender === "f" ? [1, 2, 3, 1, 0] : c.gender === "m" ? [0, 4, 3, 0, 4] : [0, 1, 2, 3, 4];
    const style = styles[(h >> 12) % 5];
    if (style === 3) add(GEO.afro, hair);
    else { add(GEO.hairCap, hair); if (style === 1) add(GEO.hairLong, hair); if (style === 2) add(GEO.bun, hair); }
    if (sig?.helmet) { add(GEO.helmet, sig.helmet); add(GEO.brim, sig.helmet); }
    if (sig?.cap) { add(GEO.hairCap, sig.cap).scale.set(1.05, 0.8, 1.05); const v = add(GEO.visor, sig.cap); v.position.z = 0.1; }
    if (sig?.beanie) add(GEO.helmet, sig.beanie).scale.set(1, 1.15, 1);
    if (sig?.visor) add(GEO.visor, sig.visor);
    if (sig?.pack) add(GEO.pack, sig.pack);
    if (sig?.gloves) for (const arm of [armL, armR]) { const gl = new T.Mesh(GEO.glove, mat(sig.gloves)); arm.add(gl); }
    if (sig?.phones) { add(GEO.phones, 0x222222); for (const s of [-1, 1]) add(GEO.cup, sig.phones).position.set(s * 0.32, 1.76, 0); }
    if (sig?.glasses) add(GEO.glasses, sig.glasses);
    if (sig?.tie) add(GEO.tie, sig.tie);
    // canne à pêche (dans la main droite) et collier d'immunité, cachés par défaut
    const rod = new T.Mesh(GEO.rod, mat(0x8a6a44)); rod.position.set(0, -0.6, 0); rod.rotation.x = 2.14; rod.visible = false; armR.add(rod);
    const necklace = new T.Group(); necklace.add(new T.Mesh(GEO.necklace, mat(0xe6b84a, { emissive: 0x3a2800 })), new T.Mesh(GEO.pendant, mat(0xff8a3d, { emissive: 0x401800 })));
    necklace.visible = false; g.add(necklace);
    if (!sig && (h >> 15) % 5 === 0) { add(GEO.brim, 0xd9c08a); add(GEO.hairCap, 0xd9c08a).scale.set(0.9, 0.6, 0.9); } // chapeau de paille
    // repère du candidat suivi
    const ring = new T.Mesh(GEO.ring, new T.MeshBasicMaterial({ color: 0xff8a3d })); ring.visible = false; g.add(ring);
    const arrow = new T.Mesh(GEO.arrow, new T.MeshBasicMaterial({ color: 0xff8a3d })); arrow.visible = false; g.add(arrow);
    const scale = 1.25;
    g.scale.setScalar(scale);
    g.userData = { id: c.id, armL, armR, ring, arrow, rod, necklace, pos: new T.Vector3(), target: new T.Vector3(), phase: (h % 100) / 16 };
    return g;
  }

  // Place les candidats d'une même zone en spirale autour du centre, sur la terre ferme
  function slots(zone, n) {
    const [cx, cz] = ZONES[zone];
    const res = [];
    let i = 0, k = 0;
    const start = zone === "lagoon" ? 2 : 0;
    while (res.length < n && k < 400) {
      const a = (k + start * 7) * 2.399, rad = 1.1 + 0.95 * Math.sqrt(k + start * 6);
      const x = cx + Math.cos(a) * rad, z = cz + Math.sin(a) * rad;
      k++;
      const hh = height(x, z);
      if (hh < 0.3) continue;
      res.push([x, hh, z]);
      i++;
    }
    while (res.length < n) res.push([cx, Math.max(0.3, height(cx, cz)), cz]);
    return res;
  }

  // ---------- Effets : pluie, guêpes, colis ----------
  function buildRain(scene) {
    const n = 1800, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = (Math.random() - 0.5) * 110; arr[i * 3 + 1] = Math.random() * 30; arr[i * 3 + 2] = (Math.random() - 0.5) * 90; }
    const geo = new T.BufferGeometry(); geo.setAttribute("position", new T.BufferAttribute(arr, 3));
    const pts = new T.Points(geo, new T.PointsMaterial({ color: 0xbfe6f0, size: 2 * Math.min(window.devicePixelRatio || 1, 2), sizeAttenuation: false, transparent: true, opacity: 0.7 }));
    pts.visible = false; pts.frustumCulled = false; scene.add(pts);
    return pts;
  }
  function buildSwarm(scene) {
    const n = 90, arr = new Float32Array(n * 3);
    const geo = new T.BufferGeometry(); geo.setAttribute("position", new T.BufferAttribute(arr, 3));
    const pts = new T.Points(geo, new T.PointsMaterial({ color: 0xffd23f, size: 4 * Math.min(window.devicePixelRatio || 1, 2), sizeAttenuation: false }));
    pts.visible = false; pts.frustumCulled = false; pts.userData.seed = [...Array(n)].map(() => [Math.random() * 6.3, Math.random() * 6.3, 0.5 + Math.random()]);
    scene.add(pts);
    return pts;
  }
  function buildCrate(scene) {
    const g = new T.Group();
    const crate = box(1.2, 1.2, 1.2, 0xc8963c); g.add(crate);
    const band = box(1.25, 0.2, 1.25, 0x8a5a24); g.add(band);
    const chute = new T.Mesh(new T.SphereGeometry(2, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshLambertMaterial({ color: 0xff8a3d, side: T.DoubleSide, flatShading: true }));
    chute.position.y = 4; g.add(chute);
    g.userData.chute = chute;
    g.visible = false; scene.add(g);
    return g;
  }

  // ---------- La vie de l'île : nuages, crabes, oiseaux, poissons, lucioles ----------
  function buildLife(scene, r) {
    const cloudMat = new T.MeshLambertMaterial({ color: 0xffffff, flatShading: true, transparent: true, opacity: 0.92 });
    const clouds = [];
    for (let i = 0; i < 9; i++) {
      const c = new T.Group();
      for (let j = 0; j < 4; j++) { const m = new T.Mesh(new T.IcosahedronGeometry(1.8 + r() * 1.6, 0), cloudMat); m.position.set(j * 2.1 - 3, r() * 0.8, (r() - 0.5) * 2); m.scale.y = 0.55; m.castShadow = true; c.add(m); }
      c.position.set((r() - 0.5) * 180 * S, 22 + r() * 6, (r() - 0.5) * 110 * S);
      c.userData.speed = 0.5 + r() * 0.8;
      scene.add(c); clouds.push(c);
    }
    // crabes sur le sable
    const crabs = [];
    for (let k = 0; k < 400 && crabs.length < 9; k++) {
      const x = (r() - 0.5) * 70 * S, z = (18 + r() * 18) * S, h = height(x, z);
      if (h < 0.35 || h > 0.9) continue;
      const g = new T.Group();
      g.add(box(0.5, 0.18, 0.36, 0xe0582c));
      for (const s of [-1, 1]) { const cl = box(0.16, 0.12, 0.14, 0xf06a3a); cl.position.set(s * 0.32, 0.05, 0.22); g.add(cl); }
      for (const s of [-1, 1]) { const e = new T.Mesh(new T.SphereGeometry(0.05, 4, 3), mat(0x111111)); e.position.set(s * 0.1, 0.16, 0.15); g.add(e); }
      g.position.set(x, h + 0.08, z);
      g.userData = { home: new T.Vector3(x, h + 0.08, z), ph: r() * 6, sp: 0.6 + r() };
      scene.add(g); crabs.push(g);
    }
    // oiseaux de mer
    const birds = [];
    const wingGeo = new T.BoxGeometry(0.9, 0.05, 0.3).translate(0.45, 0, 0);
    for (let f = 0; f < 2; f++) for (let i = 0; i < 6; i++) {
      const g = new T.Group();
      g.add(box(0.2, 0.15, 0.5, 0xf2f2f2));
      const wl = new T.Mesh(wingGeo, mat(0xe9eef0)), wr = new T.Mesh(wingGeo, mat(0xe9eef0));
      wr.rotation.y = Math.PI;
      g.add(wl, wr);
      g.userData = { f, i, wl, wr };
      scene.add(g); birds.push(g);
    }
    // poissons qui sautent
    const fish = new T.Mesh(new T.ConeGeometry(0.18, 0.7, 5).rotateX(Math.PI / 2), mat(0xbfd8e0));
    fish.visible = false; scene.add(fish);
    const ripple = new T.Mesh(new T.RingGeometry(0.3, 0.42, 16), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: T.DoubleSide }));
    ripple.rotation.x = -Math.PI / 2; scene.add(ripple);
    const seaSpots = [];
    for (let k = 0; k < 600 && seaSpots.length < 30; k++) { const x = (r() - 0.5) * 110 * S, z = (r() - 0.5) * 90 * S, h = height(x, z); if (h < -1.5 && h > -3.6) seaSpots.push([x, z]); }
    let jump = null;
    // lucioles dans la jungle, la nuit
    const nF = 70, fArr = new Float32Array(nF * 3), fSeed = [];
    for (let i = 0; i < nF; i++) { let x, z, tries = 0; do { x = (-14 + r() * 26) * S; z = (-8 + r() * 24) * S; } while (height(x, z) < 0.6 && tries++ < 20); fSeed.push([x, height(x, z) + 1 + r() * 2.5, z, r() * 6]); }
    const fGeo = new T.BufferGeometry(); fGeo.setAttribute("position", new T.BufferAttribute(fArr, 3));
    const flies = new T.Points(fGeo, new T.PointsMaterial({ color: 0xfff08a, size: 3 * Math.min(window.devicePixelRatio || 1, 2), sizeAttenuation: false, transparent: true, opacity: 0.9 }));
    flies.frustumCulled = false; scene.add(flies);

    return function update(dt, time, light, storm) {
      cloudMat.color.setHex(storm ? 0x7a8890 : light < 0.4 ? 0x3a4a5a : 0xffffff);
      cloudMat.opacity = light < 0.4 ? 0.6 : 0.92;
      for (const c of clouds) { c.position.x += dt * c.userData.speed * (storm ? 3 : 1); if (c.position.x > 95 * S) c.position.x = -95 * S; }
      for (const c of crabs) { const u = c.userData, k = Math.sin(time * u.sp + u.ph); c.position.x = u.home.x + k * 1.2; c.position.z = u.home.z - k * 0.4; c.children[1].rotation.z = Math.sin(time * 9 + u.ph) * 0.4; c.children[2].rotation.z = -Math.sin(time * 9 + u.ph) * 0.4; c.position.y = height(c.position.x, c.position.z) + 0.08; }
      for (const b of birds) {
        const u = b.userData, a = time * (0.12 + u.f * 0.05) + u.f * 3, R0 = (26 + u.f * 12) * S;
        const cx = Math.cos(a) * R0, cz = Math.sin(a) * R0 * 0.8;
        const side = (u.i % 2 ? 1 : -1) * Math.ceil(u.i / 2) * 1.4, back = Math.ceil(u.i / 2) * 1.2;
        const dir = new T.Vector3(-Math.sin(a), 0, Math.cos(a) * 0.8).normalize();
        b.position.set(cx - dir.x * back + dir.z * side, 17 + u.f * 3 + Math.sin(time + u.i) * 0.3, cz - dir.z * back - dir.x * side);
        b.rotation.y = Math.atan2(dir.x, dir.z);
        const flap = Math.sin(time * 6 + u.i) * 0.5; u.wl.rotation.z = flap; u.wr.rotation.z = -flap;
        b.visible = light > 0.35;
      }
      if (!jump && seaSpots.length && Math.random() < dt * 0.4) { const [x, z] = seaSpots[Math.floor(Math.random() * seaSpots.length)]; jump = { x, z, t: 0, a: Math.random() * 6.28 }; }
      if (jump) {
        jump.t += dt;
        const k = jump.t / 0.9;
        fish.visible = k < 1;
        fish.position.set(jump.x + Math.cos(jump.a) * (k - 0.5) * 2, Math.sin(Math.min(1, k) * Math.PI) * 1.4, jump.z + Math.sin(jump.a) * (k - 0.5) * 2);
        fish.rotation.set(-Math.cos(Math.min(1, k) * Math.PI) * 0.9, -jump.a + Math.PI / 2, 0);
        ripple.position.set(jump.x + Math.cos(jump.a), 0.12, jump.z + Math.sin(jump.a));
        ripple.scale.setScalar(1 + Math.max(0, k - 0.9) * 4);
        ripple.material.opacity = k > 0.9 ? Math.max(0, 0.7 - (k - 0.9) * 0.9) : 0;
        if (k > 1.7) jump = null;
      }
      flies.visible = light < 0.4;
      if (flies.visible) { fSeed.forEach(([x, y, z, ph], i) => { fArr[i * 3] = x + Math.sin(time * 0.7 + ph) * 0.8; fArr[i * 3 + 1] = y + Math.sin(time * 1.3 + ph) * 0.4; fArr[i * 3 + 2] = z + Math.cos(time * 0.6 + ph) * 0.8; }); fGeo.attributes.position.needsUpdate = true; flies.material.opacity = 0.6 + Math.sin(time * 5) * 0.3; }
    };
  }

  // ---------- Ciel et lumière selon l'heure ----------
  const SKY = [
    [0, 0x0b1820, 0.18], [5, 0x14283a, 0.25], [6.5, 0xf0a070, 0.6], [8, 0x8fd0e0, 1], [17, 0x8fd0e0, 1],
    [19, 0xf08a5a, 0.7], [20.5, 0x2a2a50, 0.35], [22, 0x0b1820, 0.18], [24, 0x0b1820, 0.18],
  ];
  function skyAt(hour) {
    for (let i = 0; i < SKY.length - 1; i++) {
      const [h0, c0, l0] = SKY[i], [h1, c1, l1] = SKY[i + 1];
      if (hour >= h0 && hour <= h1) { const t = (hour - h0) / (h1 - h0); return [new T.Color(c0).lerp(new T.Color(c1), t), lerp(l0, l1, t)]; }
    }
    return [new T.Color(0x0b1820), 0.18];
  }

  // =====================================================================
  function init(canvas, D, opts = {}) {
    const isSmall = Math.min(window.innerWidth, window.innerHeight) < 700;
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmall ? 1.75 : 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    const scene = new T.Scene();
    scene.fog = new T.Fog(0x0b1820, 120 * S, 260 * S);
    const r = rng(2026);

    // Caméra isométrique orthographique
    const camera = new T.OrthographicCamera(-1, 1, 1, -1, -200, 600);
    camera.position.set(70, 62, 70);
    const controls = new T.OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minZoom = 0.8;
    controls.maxZoom = 9 * S;
    controls.maxPolarAngle = 1.25;
    controls.minPolarAngle = 0.35;
    controls.screenSpacePanning = true;
    controls.target.set(0, 0, 0);
    const VIEW = 64 * S;
    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      const aspect = w / h;
      const span = aspect < 1 ? VIEW / aspect : VIEW;
      camera.left = (-span * aspect) / 2; camera.right = (span * aspect) / 2;
      camera.top = span / 2; camera.bottom = -span / 2;
      camera.updateProjectionMatrix();
    }
    new ResizeObserver(resize).observe(canvas);
    resize();

    // Lumières
    const hemi = new T.HemisphereLight(0xcfefff, 0x3a5a3a, 0.6);
    scene.add(hemi);
    const sun = new T.DirectionalLight(0xfff1d6, 0.9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(isSmall ? 1024 : 2048, isSmall ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -60 * S, right: 60 * S, top: 60 * S, bottom: -60 * S, near: 1, far: 300 });
    sun.shadow.bias = -0.0008;
    scene.add(sun, sun.target);

    buildTerrain(scene, r);
    const water = buildWater(scene);
    buildRiver(scene);
    const falls = buildWaterfall(scene);
    buildVegetation(scene, r);
    const marks = buildLandmarks(scene, r);
    const rain = buildRain(scene);
    const swarm = buildSwarm(scene);
    const crate = buildCrate(scene);

    const life = buildLife(scene, r);

    // Candidats
    const people = {};
    for (const c of D.cast) { const p = makePerson(c); people[c.id] = p; p.visible = false; scene.add(p); }

    // Étiquettes HTML (prénom du suivi, noms des zones)
    const host = canvas.parentElement;
    const label = document.createElement("div");
    label.className = "w3-label";
    host.appendChild(label);
    const zoneLabels = Object.entries(ZONES).map(([id, [x, z]]) => {
      const el = document.createElement("div");
      el.className = "w3-zone";
      el.textContent = D.arena.zones.find((zz) => zz.id === id).name.replace(/^(la |le |les |l')/, "");
      host.appendChild(el);
      return { el, v: new T.Vector3(x, height(x, z) + 3, z) };
    });

    // ---------- état piloté par l'interface ----------
    let tick = 0, me = null, mode = "director", holdUntil = 0, flashUntil = 0, heat = false;
    const camGoal = { target: new T.Vector3(0, 0, 0), zoom: 1, active: true };
    const snapAt = (t) => { const s = D.snapshots; return s[Math.max(0, Math.min(s.length - 1, t - s[0][0]))][1]; };
    const clock = new T.Clock();

    // La mise en scène (scenes.js)
    const director = window.World3DScenes.create({
      scene, camera, canvas, host, D, people, ZONES, height, riverDist, mat, box, makeDrone,
      snapAt, S, me: () => me, tick: () => tick, camTarget: () => controls.target,
      live: (text, kind) => opts.onLive?.(text, kind),
      lightning: () => { flashUntil = clock.elapsedTime + 0.12; opts.onSfx?.("bonk"); },
      sfx: (name) => opts.onSfx?.(name),
      music: (mode) => opts.onMusic?.(mode),
    });
    // Le projecteur des drones, pour filmer la nuit
    const spot = new T.PointLight(0xfff2d8, 0, 26, 1.4);
    scene.add(spot);

    function setTick(t, animate, speed = 1, only = null) {
      director.flush();
      const ppl = snapAt(t);
      const byZone = {};
      for (const id of Object.keys(ppl)) (byZone[ppl[id][0]] ??= []).push(id);
      for (const [zone, ids] of Object.entries(byZone)) {
        ids.sort();
        const s = slots(zone, ids.length);
        ids.forEach((id, i) => people[id].userData.target.set(s[i][0], s[i][1], s[i][2]));
      }
      const day = Math.floor(t / 24), hour = t % 24;
      const immune = D.events.find((e) => e.type === "challenge" && Math.floor(e.t / 24) === day && e.t < t && hour <= D.voteHour);
      for (const c of D.cast) {
        const p = people[c.id], u = p.userData, here = !!ppl[c.id];
        if (here && !p.visible) { p.visible = true; u.pos.copy(u.target); p.position.copy(u.pos); }
        if (!animate) { u.pos.copy(u.target); p.position.copy(u.pos); }
        if (!here && p.visible) {
          // l'évacuation se joue en scène si on avance d'une heure
          const ev = animate && D.events.find((e) => e.type === "evacuated" && e.a[0] === c.id && e.t === t);
          if (ev) u.keep = true; else p.visible = false;
        }
        u.necklace.visible = !!immune && immune.a[0] === c.id;
        p.rotation.x = 0;
      }
      // effets de l'heure
      const recent = (type, kind, hours) => D.events.find((e) => e.type === type && (!kind || e.d?.kind === kind) && e.t <= t && t - e.t < hours);
      rain.visible = !!recent("showrunner", "storm", 3);
      const sw = recent("showrunner", "wasp_swarm", 4);
      swarm.visible = !!sw;
      if (sw) { const z = sw.z || "jungle"; swarm.userData.center = new T.Vector3(ZONES[z][0], height(...ZONES[z]) + 2.5, ZONES[z][1]); }
      const drop = recent("showrunner", "supply_drop", 5);
      crate.visible = !!drop && t > drop.t; // le largage lui-même est mis en scène
      if (drop) { const z = drop.z; crate.userData.base = new T.Vector3(ZONES[z][0] + 2, height(ZONES[z][0] + 2, ZONES[z][1] + 2), ZONES[z][1] + 2); }
      heat = !!recent("showrunner", "heatwave", 6);
      tick = t;
      return director.onTick(t, animate, speed, only);
    }

    function setFollow(id) {
      for (const p of Object.values(people)) { p.userData.ring.visible = false; p.userData.arrow.visible = false; }
      me = id;
      if (me && people[me]) { people[me].userData.ring.visible = true; people[me].userData.arrow.visible = true; }
    }
    function view(m) {
      mode = m;
      holdUntil = 0;
      camGoal.active = true;
      camGoal.zoomLocked = false;
      if (m === "island") { camGoal.target.set(0, 0, 2); camGoal.zoom = 1; }
      if (m === "zone" && me) { const z = snapAt(tick)[me]?.[0] || "beach"; camGoal.target.set(ZONES[z][0], height(...ZONES[z]), ZONES[z][1]); camGoal.zoom = 2.2 * S; }
      if (m === "follow" && me) camGoal.zoom = 3.4 * S;
    }
    controls.addEventListener("start", () => {
      if (mode === "director") holdUntil = performance.now() + 7000;
      else if (mode !== "follow") camGoal.active = false;
      else camGoal.zoomLocked = true;
    });

    // Toucher un personnage pour le suivre
    const ray = new T.Raycaster(), ndc = new T.Vector2();
    let down = null;
    canvas.addEventListener("pointerdown", (e) => { down = [e.clientX, e.clientY]; });
    canvas.addEventListener("pointerup", (e) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
      const rect = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(Object.values(people).filter((p) => p.visible), true);
      if (hits.length) {
        let o = hits[0].object;
        while (o && !o.userData.id) o = o.parent;
        if (o && opts.onPick) opts.onPick(o.userData.id);
      }
    });

    // ---------- boucle d'animation ----------
    const v = new T.Vector3(), camDir = new T.Vector3(1, 0.886, 1).normalize();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function frame() {
      const dt = Math.min(clock.getDelta(), 0.1), time = clock.elapsedTime;
      const hour = (tick % 24) + 0.5;
      const [sky, light] = skyAt(hour);
      if (heat && light > 0.6) sky.lerp(new T.Color(0xf0b070), 0.35);
      if (rain.visible) sky.lerp(new T.Color(0x3a4a55), 0.6);
      if (rain.visible && Math.random() < dt * 0.25) flashUntil = time + 0.1;
      const flashing = time < flashUntil;
      if (flashing) sky.lerp(new T.Color(0xe8f4ff), 0.7);
      scene.background = sky;
      scene.fog.color.copy(sky);
      const night = light < 0.4;
      hemi.intensity = 0.25 + light * 0.45 + (flashing ? 1.2 : 0);
      sun.intensity = rain.visible ? light * 0.35 : light * 0.85;
      const sa = ((hour - 6) / 12) * Math.PI;
      sun.position.set(Math.cos(sa) * 60 * S, Math.max(12, Math.sin(sa) * 70 * S), 30 * S);
      sun.color.set(light < 0.75 ? 0xffb080 : 0xfff1d6);
      marks.fire.light.intensity = night || hour > 19 ? 2.2 + Math.sin(time * 13) * 0.4 : 0;
      marks.fire.flame.scale.y = 1 + Math.sin(time * 11) * 0.15;
      marks.fire.flame2.scale.y = 1 + Math.cos(time * 15) * 0.2;
      marks.lamp.material.color.setHex(Math.sin(time * 3) > 0 ? 0xff5b6b : 0x6a1f2a);
      marks.idol.rotation.y = time * 0.6;
      for (const m of marks.steam) { const u = m.userData, k = ((time * 0.4 + u.ph) % 1); m.position.y = u.y0 + k * 2.2; m.material.opacity = 0.5 * (1 - k); m.scale.setScalar(0.6 + k); }
      life(dt, time, light, rain.visible);

      if (!reduced) {
        // vagues
        const a = water.mesh.geometry.attributes.position, b = water.base;
        for (let i = 0; i < a.count; i++) {
          const x = b[i * 3], z = b[i * 3 + 2];
          a.array[i * 3 + 1] = Math.sin(x * 0.22 + time * 1.1) * 0.16 + Math.cos(z * 0.19 + time * 0.8) * 0.14;
        }
        a.needsUpdate = true;
        if ((frame.n = (frame.n || 0) + 1) % 4 === 0) water.mesh.geometry.computeVertexNormals();
        water.foam.material.opacity = 0.25 + Math.sin(time * 1.5) * 0.1;
        falls.tex.offset.y = (falls.tex.offset.y + dt * 1.6) % 1;
        falls.mist.children.forEach((m) => { m.position.y = 0.3 + ((time * 0.6 + m.userData.phase) % 1.6); m.material.opacity = 0.6 - ((time * 0.6 + m.userData.phase) % 1.6) / 3; });
        const fp = marks.flag.mesh.geometry.attributes.position;
        for (let i = 0; i < fp.count; i++) { const x = marks.flag.base[i * 3]; fp.array[i * 3 + 2] = Math.sin(x * 2.5 + time * 5) * 0.15 * (x + 0.9); }
        fp.needsUpdate = true;
        marks.boat.position.y = 0.35 + Math.sin(time * 1.2) * 0.12;
        marks.boat.rotation.z = Math.sin(time * 0.9) * 0.04;
      }
      // pluie
      if (rain.visible) {
        const p = rain.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) { p.array[i * 3 + 1] -= dt * 28; if (p.array[i * 3 + 1] < 0) p.array[i * 3 + 1] = 30; }
        p.needsUpdate = true;
      }
      // guêpes
      if (swarm.visible && swarm.userData.center) {
        const p = swarm.geometry.attributes.position, c = swarm.userData.center;
        swarm.userData.seed.forEach(([a1, a2, rr], i) => {
          p.array[i * 3] = c.x + Math.cos(time * 3 * rr + a1) * 2.4 * rr;
          p.array[i * 3 + 1] = c.y + Math.sin(time * 4 + a2) * 1.2;
          p.array[i * 3 + 2] = c.z + Math.sin(time * 2.6 * rr + a2) * 2.4 * rr;
        });
        p.needsUpdate = true;
      }
      // colis posé au sol après un largage
      if (crate.visible && crate.userData.base) { crate.position.copy(crate.userData.base).add(v.set(0, 0.6, 0)); crate.userData.chute.visible = false; }

      // scènes, vie des candidats, drones de secours
      director.update(dt, time, night);

      // caméra « réalisateur » : elle va d'elle-même vers l'action la plus forte
      const f = director.focus();
      const k = 1 - Math.exp(-dt * 3);
      if (mode === "director") {
        const free = performance.now() > holdUntil;
        controls.autoRotate = !reduced && free && f.drift;
        controls.autoRotateSpeed = 0.35;
        if (free) {
          const portrait = canvas.clientWidth < canvas.clientHeight; // sur téléphone, on filme plus serré
          camGoal.target.copy(f.target); camGoal.zoom = f.zoom * S * (portrait ? 1.3 : 1); camGoal.active = true; camGoal.zoomLocked = false;
          if (f.scene) { // on revient à l'angle de la scène
            const o = v.copy(camera.position).sub(controls.target), len = o.length();
            o.lerp(camDir.clone().multiplyScalar(len), k * 0.8).setLength(len);
            camera.position.copy(controls.target).add(o);
          }
        } else camGoal.active = false;
      } else controls.autoRotate = false;
      if (mode === "follow" && me && people[me]?.visible) { camGoal.target.copy(people[me].position); camGoal.active = true; }
      if (camGoal.active) {
        controls.target.lerp(camGoal.target, k);
        if (!camGoal.zoomLocked) camera.zoom = lerp(camera.zoom, camGoal.zoom, k);
        camera.updateProjectionMatrix();
        if (mode !== "follow" && mode !== "director" && controls.target.distanceTo(camGoal.target) < 0.05 && Math.abs(camera.zoom - camGoal.zoom) < 0.01) camGoal.active = false;
      }
      controls.update();
      // les drones caméras : l'un d'eux suit l'action et l'éclaire la nuit
      if (!reduced) marks.cams.forEach((d, i) => {
        const u = d.userData;
        if (i === 0) { v.copy(f.target).add(new T.Vector3(5, 6 + Math.sin(time * 2) * 0.3, 5)); d.position.lerp(v, k); d.lookAt(f.target.x, d.position.y, f.target.z); }
        else d.position.set(Math.cos(time * u.s + u.p) * u.r, u.y + Math.sin(time * 2 + u.p) * 0.3, Math.sin(time * u.s + u.p) * u.r * 0.8);
      });
      spot.position.copy(f.target).add(v.set(2, 7, 2));
      spot.intensity = night ? 1.5 : 0;
      renderer.render(scene, camera);

      // étiquettes
      const rect = canvas.getBoundingClientRect();
      const project = (vec, el, below) => {
        v.copy(vec).project(camera);
        const off = v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05;
        el.style.display = off ? "none" : "";
        el.style.transform = `translate(${((v.x + 1) / 2) * rect.width}px, ${((1 - v.y) / 2) * rect.height}px) translate(-50%, ${below ? "6px" : "-100%"})`;
      };
      if (me && people[me]?.visible) { label.textContent = D.cast.find((c) => c.id === me).name; project(people[me].position, label, true); }
      else label.style.display = "none";
      const showZones = camera.zoom < 1.6 * S;
      if (++occFrame % 8 === 0) clearView(controls.target, camera.position, showZones ? 0 : mode === "follow" ? 3.2 : 4.5);
      for (const z of zoneLabels) { if (showZones) project(z.v, z.el); else z.el.style.display = "none"; }
      director.drawOverlays();
      requestAnimationFrame(frame);
    }
    let occFrame = 0;
    requestAnimationFrame(frame);

    return {
      setTick, setFollow, view,
      peek: (id) => { if (mode !== "director") view("director"); holdUntil = 0; director.peek(id); },
      get mode() { return mode; },
      get busy() { return director.busy; },
      resetZoomLock() { camGoal.zoomLocked = false; },
      gift: (id, item, label) => { if (mode !== "director") view("director"); holdUntil = 0; return director.viewerGift(id, item, label); },
    };
  }

  window.World3D = { init };
})();
