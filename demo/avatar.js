// Fabrique le personnage low poly à partir de sa fiche visuelle (data/looks.json).
// Utilisé par l'île (world3d.js) et par la planche des personnages (casting.html).
(function () {
  const cache = new WeakMap();
  function geos(T) {
    if (cache.has(T)) return cache.get(T);
    const G = {
      pants: new T.BoxGeometry(0.46, 0.7, 0.3).translate(0, 0.35, 0),
      shortsTop: new T.BoxGeometry(0.47, 0.32, 0.31).translate(0, 0.54, 0),
      shin: new T.BoxGeometry(0.17, 0.4, 0.2).translate(0, 0.2, 0),
      skirt: new T.CylinderGeometry(0.3, 0.42, 0.5, 7).translate(0, 0.5, 0),
      body: new T.CylinderGeometry(0.3, 0.36, 0.8, 6).translate(0, 1.1, 0),
      coatTail: new T.CylinderGeometry(0.36, 0.42, 0.5, 6).translate(0, 0.62, 0),
      arm: new T.BoxGeometry(0.14, 0.62, 0.14).translate(0, -0.28, 0),
      sleeve: new T.BoxGeometry(0.17, 0.24, 0.17).translate(0, -0.1, 0),
      hand: new T.BoxGeometry(0.13, 0.12, 0.13).translate(0, -0.62, 0),
      head: new T.IcosahedronGeometry(0.28, 1).translate(0, 1.76, 0),
      eye: new T.BoxGeometry(0.05, 0.07, 0.02),
      // cheveux
      cap: new T.SphereGeometry(0.31, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.8, 0),
      long: new T.BoxGeometry(0.52, 0.62, 0.16).translate(0, 1.58, -0.2),
      bob: new T.BoxGeometry(0.62, 0.32, 0.44).translate(0, 1.74, -0.06),
      tail: new T.CylinderGeometry(0.07, 0.11, 0.5, 5).rotateX(0.5).translate(0, 1.72, -0.36),
      bun: new T.IcosahedronGeometry(0.15, 0).translate(0, 2.12, -0.05),
      afro: new T.IcosahedronGeometry(0.43, 0).translate(0, 1.9, -0.03),
      braid: new T.CylinderGeometry(0.035, 0.035, 0.62, 4).translate(0, 1.5, 0),
      curl: new T.IcosahedronGeometry(0.12, 0),
      mohawk: new T.BoxGeometry(0.09, 0.2, 0.48).translate(0, 2.07, -0.02),
      beard: new T.BoxGeometry(0.44, 0.24, 0.2).translate(0, 1.6, 0.14),
      mustache: new T.BoxGeometry(0.22, 0.05, 0.06).translate(0, 1.68, 0.26),
      // chapeaux
      dome: new T.SphereGeometry(0.33, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.84, 0),
      peak: new T.BoxGeometry(0.36, 0.04, 0.24).translate(0, 1.86, 0.3),
      brim: new T.CylinderGeometry(0.42, 0.42, 0.04, 8).translate(0, 1.95, 0),
      bigBrim: new T.CylinderGeometry(0.62, 0.62, 0.03, 10).translate(0, 1.95, 0),
      crown: new T.CylinderGeometry(0.24, 0.28, 0.24, 7).translate(0, 2.08, 0),
      band: new T.CylinderGeometry(0.285, 0.285, 0.06, 7).translate(0, 1.99, 0),
      bucket: new T.CylinderGeometry(0.3, 0.4, 0.26, 8).translate(0, 2.0, 0),
      toque: new T.CylinderGeometry(0.3, 0.26, 0.42, 8).translate(0, 2.16, 0),
      toqueTop: new T.IcosahedronGeometry(0.33, 0).scale(1, 0.6, 1).translate(0, 2.42, 0),
      helmetBack: new T.BoxGeometry(0.5, 0.04, 0.32).translate(0, 1.86, -0.3),
      headband: new T.TorusGeometry(0.29, 0.04, 4, 12).rotateX(Math.PI / 2).translate(0, 1.88, 0),
      visorBand: new T.TorusGeometry(0.3, 0.03, 4, 12).rotateX(Math.PI / 2).translate(0, 1.88, 0),
      visorPeak: new T.BoxGeometry(0.42, 0.03, 0.3).translate(0, 1.88, 0.33),
      veil: new T.CylinderGeometry(0.5, 0.5, 0.45, 10, 1, true).translate(0, 1.74, 0),
      knot: new T.BoxGeometry(0.12, 0.1, 0.1).translate(0, 1.92, -0.3),
      // vêtements
      collar: new T.BoxGeometry(0.34, 0.08, 0.1).translate(0, 1.47, 0.24),
      shirtFront: new T.BoxGeometry(0.16, 0.5, 0.05).translate(0, 1.22, 0.33),
      lapel: new T.BoxGeometry(0.2, 0.36, 0.05).translate(0, 1.3, 0.33),
      apron: new T.BoxGeometry(0.5, 0.78, 0.04).translate(0, 0.98, 0.34),
      bib: new T.BoxGeometry(0.36, 0.34, 0.05).translate(0, 1.18, 0.33),
      strap: new T.BoxGeometry(0.06, 0.4, 0.05),
      stripe: new T.CylinderGeometry(0.335, 0.345, 0.07, 6).translate(0, 1.0, 0),
      zip: new T.BoxGeometry(0.04, 0.72, 0.04).translate(0, 1.1, 0.34),
      hood: new T.TorusGeometry(0.2, 0.08, 4, 8).translate(0, 1.5, -0.2),
      // accessoires
      bag: new T.BoxGeometry(0.34, 0.26, 0.14).translate(0.3, 0.8, 0.18),
      sash: new T.BoxGeometry(0.06, 0.95, 0.05).rotateZ(0.75).translate(0, 1.15, 0.33),
      pack: new T.BoxGeometry(0.42, 0.52, 0.22).translate(0, 1.15, -0.32),
      tie: new T.BoxGeometry(0.09, 0.45, 0.04).translate(0, 1.2, 0.35),
      phones: new T.TorusGeometry(0.33, 0.045, 4, 12, Math.PI).translate(0, 1.78, 0),
      cup: new T.CylinderGeometry(0.11, 0.11, 0.08, 8).rotateZ(Math.PI / 2),
      camera: new T.BoxGeometry(0.24, 0.16, 0.12).translate(0, 1.05, 0.38),
      lens: new T.CylinderGeometry(0.06, 0.06, 0.12, 6).rotateX(Math.PI / 2).translate(0, 1.05, 0.48),
      lanyard: new T.TorusGeometry(0.22, 0.02, 3, 10).rotateX(1.2).translate(0, 1.34, 0.15),
      whistle: new T.CylinderGeometry(0.04, 0.04, 0.1, 5).rotateZ(Math.PI / 2).translate(0, 1.16, 0.36),
      steth: new T.TorusGeometry(0.27, 0.03, 3, 12).rotateX(1.3).translate(0, 1.38, 0.1),
      rope: new T.TorusGeometry(0.28, 0.07, 4, 10).rotateY(Math.PI / 2).rotateX(0.5).translate(-0.05, 1.3, 0),
      belt: new T.TorusGeometry(0.37, 0.05, 4, 10).rotateX(Math.PI / 2).translate(0, 0.74, 0),
      pouch: new T.BoxGeometry(0.14, 0.18, 0.1),
      glove: new T.IcosahedronGeometry(0.13, 0),
      mask: new T.BoxGeometry(0.42, 0.14, 0.1).translate(0, 1.98, 0.2),
      mic: new T.BoxGeometry(0.03, 0.03, 0.22).translate(0.2, 1.68, 0.18),
      medkit: new T.BoxGeometry(0.3, 0.24, 0.16).translate(-0.34, 0.8, 0.05),
      scarf: new T.TorusGeometry(0.24, 0.08, 4, 10).rotateX(Math.PI / 2).translate(0, 1.5, 0),
      tag: new T.BoxGeometry(0.07, 0.1, 0.02).translate(0, 1.26, 0.36),
      wrench: new T.BoxGeometry(0.06, 0.4, 0.04).translate(0, -0.78, 0.06),
      notebook: new T.BoxGeometry(0.18, 0.22, 0.05).translate(0, -0.7, 0.08),
      spray: new T.CylinderGeometry(0.05, 0.05, 0.2, 6).translate(0, -0.72, 0.05),
      roundLens: new T.TorusGeometry(0.07, 0.018, 3, 8),
      squareFrame: new T.BoxGeometry(0.42, 0.08, 0.04).translate(0, 1.79, 0.27),
    };
    cache.set(T, G);
    return G;
  }

  // look : couleurs déjà en hexadécimal. mat(hex, opts) fournit les matériaux partagés.
  function build(T, look, mat) {
    const G = geos(T);
    const g = new T.Group();
    const L = look;
    // mise à l'échelle autour de la base de la pièce (les géométries sont déjà décalées en hauteur)
    const sc = (m, x, y, z, base) => { m.scale.set(x, y, z); m.position.y += base * (1 - y); return m; };
    const add = (geo, hex, parent = g) => { const m = new T.Mesh(geo, mat(hex)); m.castShadow = true; parent.add(m); return m; };
    const skin = L.skin, top = L.top.color, bottom = L.bottom.color, hair = L.hair.color;
    const light = new T.Color(top).getHSL({}).l > 0.8;
    const tee = ["overalls", "apron", "vest"].includes(L.top.type) ? (light ? "#7fb0ff" : "#f2f2f2") : top;

    // jambes
    if (L.bottom.type === "pants") add(G.pants, bottom);
    else if (L.bottom.type === "shorts") { add(G.shortsTop, bottom); for (const s of [-1, 1]) add(G.shin, skin).position.x = s * 0.12; }
    else { add(G.skirt, bottom); for (const s of [-1, 1]) add(G.shin, skin).position.x = s * 0.12; }
    if (L.top.type === "overalls") add(G.pants, top).scale.set(1.02, 1, 1.03);

    // buste, selon la carrure
    const bodyColor = L.top.type === "apron" ? tee : L.top.type === "vest" ? tee : top;
    const body = add(G.body, bodyColor);
    const bx = { slim: 0.88, average: 1, broad: 1.16, round: 1.2 }[L.build] || 1;
    body.scale.set(bx, 1, L.build === "round" ? 1.18 : 1);
    if (L.top.type === "coat" || L.top.type === "raincoat") add(G.coatTail, top).scale.set(bx, 1, 1);

    // bras : manches longues ou courtes
    const longSleeves = ["jacket", "hoodie", "coat", "suit", "raincoat", "cardigan", "wetsuit"].includes(L.top.type);
    const bare = L.top.type === "tank";
    const arms = [-1, 1].map((s) => {
      const a = add(G.arm, longSleeves ? top : skin);
      a.position.set(s * 0.38 * bx, 1.45, 0);
      if (!longSleeves && !bare) add(G.sleeve, L.top.type === "overalls" || L.top.type === "apron" || L.top.type === "vest" ? tee : top, a);
      if (longSleeves) add(G.hand, skin, a);
      return a;
    });

    // détails du haut
    switch (L.top.type) {
      case "shirt": add(G.collar, top); break;
      case "suit": add(G.lapel, "#f2f2f2"); break;
      case "cardigan": add(G.shirtFront, "#f4ead2"); break;
      case "apron": add(G.apron, top); break;
      case "overalls": add(G.bib, top); for (const s of [-1, 1]) add(G.strap, top).position.set(s * 0.14, 1.45, 0.3); break;
      case "vest": sc(add(G.body, top), bx * 1.04, 0.92, 1.04, 1.1); if (top.toLowerCase() === "#e8ff3d" || top.toLowerCase() === "#ff8a3d") add(G.stripe, "#d9d9d9").scale.set(bx * 1.1, 1, 1.1); break;
      case "jacket": add(G.zip, "#d9d9d9"); break;
      case "hoodie": add(G.hood, top); break;
      case "raincoat": add(G.hood, top); add(G.zip, "#18181c"); break;
      case "wetsuit": add(G.stripe, L.item.color).scale.set(bx * 1.05, 1, 1.05); break;
      case "coat": add(G.shirtFront, "#d9d9d9"); break;
    }

    // tête et visage
    add(G.head, skin);
    for (const s of [-1, 1]) { const e = add(G.eye, "#1b1b1b"); e.position.set(s * 0.1, 1.79, 0.265); }
    if (L.facial === "beard") add(G.beard, hair);
    else if (L.facial === "mustache") add(G.mustache, hair);
    else if (L.facial === "stubble") sc(add(G.beard, shade(T, skin, -0.12)), 1, 0.6, 0.9, 1.72);

    // cheveux
    const st = L.hair.style;
    if (st !== "bald") {
      if (st === "afro") add(G.afro, hair);
      else if (st === "mohawk") { sc(add(G.cap, shade(T, hair, 0.08)), 1, 0.6, 1, 1.8); add(G.mohawk, hair); }
      else {
        const c = add(G.cap, hair); if (st === "buzz") sc(c, 0.98, 0.7, 0.98, 1.8);
        if (st === "long") add(G.long, hair);
        if (st === "bob") add(G.bob, hair);
        if (st === "ponytail") add(G.tail, hair);
        if (st === "bun") add(G.bun, hair);
        if (st === "braids") for (let i = 0; i < 6; i++) { const b = add(G.braid, hair); const a = Math.PI * (0.15 + i * 0.14); b.position.set(Math.cos(a) * 0.27, 0, -Math.sin(a) * 0.22); }
        if (st === "curly") for (let i = 0; i < 9; i++) { const b = add(G.curl, hair); const a = (i / 9) * Math.PI * 2; b.position.set(Math.cos(a) * 0.29, 1.86 + (i % 2) * 0.08, Math.sin(a) * 0.27 - 0.03); }
      }
    }

    // lunettes
    if (L.glasses === "sun") add(G.squareFrame, "#111111");
    else if (L.glasses === "square") sc(add(G.squareFrame, "#3a2a1a"), 1, 0.8, 1, 1.79);
    else if (L.glasses === "round") for (const s of [-1, 1]) add(G.roundLens, "#222222").position.set(s * 0.1, 1.79, 0.28);

    // chapeau
    const hc = L.hat.color;
    switch (L.hat.type) {
      case "cap": sc(add(G.dome, hc), 1, 0.7, 1, 1.84); add(G.peak, hc); break;
      case "beanie": sc(add(G.dome, hc), 1, 1.15, 1, 1.84); break;
      case "straw": add(G.bigBrim, hc); add(G.crown, hc); add(G.band, "#7a1f2b"); break;
      case "fedora": add(G.brim, hc).scale.set(1.15, 1, 1.15); add(G.crown, hc); add(G.band, "#18181c"); break;
      case "bucket": add(G.bucket, hc); break;
      case "toque": add(G.toque, hc); add(G.toqueTop, hc); break;
      case "hardhat": add(G.dome, hc); add(G.brim, hc).scale.set(0.9, 1, 0.9); break;
      case "helmet": sc(add(G.dome, hc), 1.05, 1.05, 1.05, 1.84); add(G.helmetBack, hc); break;
      case "headband": add(G.headband, hc); break;
      case "bandana": sc(add(G.dome, hc), 1, 0.55, 1, 1.84); add(G.knot, hc); break;
      case "visor": add(G.visorBand, hc); add(G.visorPeak, hc); break;
      case "flatcap": sc(add(G.dome, hc), 1.06, 0.5, 1.12, 1.84); add(G.peak, hc).scale.set(1, 1, 0.8); break;
      case "beekeeper": add(G.bigBrim, hc); add(G.crown, hc); { const v = new T.Mesh(G.veil, mat("#222222", { transparent: true, opacity: 0.35, side: T.DoubleSide })); g.add(v); } break;
    }

    // accessoire signature
    const ic = L.item.color;
    switch (L.item.type) {
      case "bag": add(G.sash, ic); add(G.bag, ic); break;
      case "backpack": add(G.pack, ic); break;
      case "tie": add(G.tie, ic); break;
      case "headphones": add(G.phones, "#222222"); for (const s of [-1, 1]) add(G.cup, ic).position.set(s * 0.32, 1.76, 0); break;
      case "camera": add(G.camera, "#222222"); add(G.lens, "#444444"); add(G.lanyard, ic); break;
      case "whistle": add(G.lanyard, ic); add(G.whistle, "#cfcfcf"); break;
      case "stethoscope": add(G.steth, "#222222"); break;
      case "rope": add(G.rope, ic); break;
      case "toolbelt": add(G.belt, "#6b4a2e"); for (const s of [-1, 1]) add(G.pouch, "#8a6a44").position.set(s * 0.3, 0.68, 0.2); break;
      case "gloves": for (const s of [-1, 1]) add(G.glove, ic).position.set(s * 0.12, 1.08, 0.38); add(G.lanyard, "#f2f2f2"); break;
      case "mask": add(G.mask, ic); break;
      case "headset": add(G.phones, "#222222"); for (const s of [-1, 1]) add(G.cup, ic).position.set(s * 0.32, 1.76, 0); add(G.mic, "#222222"); break;
      case "medkit": add(G.medkit, ic); add(G.sash, ic).scale.x = -1; break;
      case "scarf": add(G.scarf, ic); break;
      case "dogtags": add(G.lanyard, "#bbbbbb"); add(G.tag, "#cfcfcf"); break;
      case "wrench": add(G.wrench, "#9aa3ad", arms[1]); break;
      case "notebook": add(G.notebook, ic, arms[0]); break;
      case "spray": add(G.spray, ic, arms[1]); break;
    }
    return { group: g, armL: arms[0], armR: arms[1], height: L.height || 1 };
  }

  function shade(T, hex, d) { return "#" + new T.Color(hex).offsetHSL(0, 0, d).getHexString(); }

  window.TheLastAvatar = { build };
})();
