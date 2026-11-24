// The Last - Arena Battle : le catalogue des arènes (données partagées par le moteur et la 3D).
// Chaque arène a des lieux nommés (x, z en mètres, centre de l'arène en 0,0), reliés entre eux.
// kind : loot (caisses), hide (cachettes), danger (piège naturel), open (terrain dégagé).
// Les pièges posés par les candidats et les dangers de l'arène sont propres à chaque décor.
// Tout reste humoristique : boue, mousse, neige, gelée, carton. Personne n'est blessé.
(function (root) {
  "use strict";
  const t = (s, v) => (root.t ? root.t(s, v) : s.replace(/\{(\w+)\}/g, (m, k) => (v && k in v ? v[k] : m)));
  const at = (deg, r) => [Math.round(Math.cos((deg * Math.PI) / 180) * r * 10) / 10, Math.round(-Math.sin((deg * Math.PI) / 180) * r * 10) / 10];

  // liens : le centre relie tout le monde, puis chaque lieu du pourtour à ses deux voisins
  function ring(places) {
    const [c, ...rest] = places;
    rest.forEach((p, i) => { p.links = [c.id, rest[(i + 1) % rest.length].id, rest[(i - 1 + rest.length) % rest.length].id]; });
    c.links = rest.map((p) => p.id);
    return places;
  }
  const P = (id, name, kind, xz, extra = {}) => ({ id, name, kind, x: xz[0], z: xz[1], ...extra });

  const ARENAS = {
    colisee: {
      name: t("Le Colisée d'acier"), short: t("Colisée"),
      pitch: t("Un stade futuriste, des gradins pleins à craquer et un sol truffé de mécanismes."),
      palette: { ground: 0x3d4454, ground2: 0x474f61, accent: 0xffd166, sky: 0x7fb6d9, fog: 0xff9ad5 },
      walls: "stadium",
      places: ring([
        P("coeur", t("le Cœur"), "loot", [0, 0]),
        P("forges", t("les Forges"), "hide", at(15, 15), { props: ["furnace", "furnace", "crate", "crate", "pipe"] }),
        P("colonnes", t("les Colonnes"), "hide", at(75, 16), { props: ["column", "column", "column", "column", "column"] }),
        P("labyrinthe", t("le Labyrinthe"), "hide", at(130, 15), { props: ["mazewall", "mazewall", "mazewall", "mazewall"] }),
        P("toboggan", t("le Grand Toboggan"), "danger", at(190, 16), { props: ["ramp", "ramp", "foampit"] }),
        P("tonneaux", t("les Tonneaux"), "hide", at(245, 15), { props: ["barrel", "barrel", "barrel", "barrel", "barrel", "barrel"] }),
        P("pont", t("le Pont suspendu"), "danger", at(300, 16), { props: ["bridge", "foampit"] }),
      ]),
      traps: [
        { id: "net", name: t("un filet à ressort"), hit: t("{v} marche sur le filet à ressort de {a} et se retrouve suspendu·e la tête en bas.") },
        { id: "banana", name: t("une peau de banane"), hit: t("{v} glisse sur la peau de banane cachée par {a}. Atterrissage en douceur… ou presque.") },
        { id: "spring", name: t("une plaque à ressort"), hit: t("BOING ! La plaque à ressort de {a} envoie {v} voler dans la fosse à mousse.") },
      ],
      hazards: [
        { id: "steam", name: t("des jets de vapeur colorée"), fx: "burst", color: 0xff9ad5, hit: t("Pfffiou ! Les jets de vapeur colorée repeignent {v} en violet.") },
        { id: "tilt", name: t("le sol qui bascule"), fx: "shake", color: 0x8a93a6, hit: t("Le sol bascule sous les pieds de {v}, qui glisse jusqu'au mur.") },
        { id: "balls", name: t("une pluie de balles en mousse"), fx: "fall", color: 0xffd166, hit: t("Une pluie de balles en mousse s'abat sur {v}. Bonk, bonk, bonk !") },
      ],
    },
    foret: {
      name: t("La Forêt des géants"), short: t("Forêt"),
      pitch: t("Des champignons hauts comme des immeubles, des toiles collantes, des terriers et un ruisseau de sirop."),
      palette: { ground: 0x4a3f5c, ground2: 0x5a4d6e, accent: 0xff6fd8, sky: 0x9a8fd0, fog: 0xd6ff7a },
      walls: "forest",
      water: [[-24, 6], [-14, 9], [-4, 7], [6, 11], [16, 8], [26, 10]],
      waterColor: 0xa8662a,
      places: ring([
        P("chene", t("le Vieux Chêne creux"), "loot", [0, -2], { props: ["hollowtree"] }),
        P("champignons", t("le Bois des champignons"), "hide", at(20, 17), { props: ["mushroom", "mushroom", "mushroom", "mushroom"] }),
        P("ronces", t("les Ronces"), "hide", at(70, 16), { props: ["bramble", "bramble", "bramble", "fern"] }),
        P("toiles", t("le Bois des toiles"), "danger", at(120, 16), { props: ["web", "web", "stump"] }),
        P("sirop", t("l'Étang de sirop"), "danger", at(170, 15), { props: ["syrup", "reed", "reed"] }),
        P("terriers", t("les Terriers"), "hide", at(225, 14), { props: ["burrow", "burrow", "rock"] }),
        P("prairie", t("la Prairie des pollens"), "open", at(270, 16), { props: ["flower", "flower", "flower", "stump"] }),
        P("souches", t("les Souches géantes"), "hide", at(320, 16), { props: ["bigstump", "bigstump", "mushroom"] }),
      ]),
      traps: [
        { id: "snare", name: t("un lasso de lierre"), hit: t("{v} se prend le pied dans le lasso de lierre de {a} et se retrouve pendu·e à une branche comme un jambon.") },
        { id: "pit", name: t("un faux terrier"), hit: t("PLOUF ! {v} marche sur le faux terrier creusé par {a} et tombe dans un trou de boue.") },
        { id: "acorn", name: t("un gland géant en équilibre"), hit: t("Le gland géant posé en équilibre par {a} tombe pile sur la tête de {v}. Bonk.") },
      ],
      hazards: [
        { id: "spores", name: t("un nuage de spores qui font éternuer"), fx: "burst", color: 0xd6ff7a, hit: t("ATCHOUM ! Le nuage de spores fait éternuer {v} si fort qu'il·elle recule de dix mètres.") },
        { id: "fireflies", name: t("une nuée de lucioles chatouilleuses"), fx: "swarm", color: 0xfff27a, hit: t("Une nuée de lucioles chatouilleuses attaque {v}, qui se roule par terre de rire.") },
        { id: "syrupflood", name: t("le ruisseau de sirop qui déborde"), fx: "rise", color: 0xd9902f, hit: t("Le ruisseau de sirop déborde : {v} reste collé·e au sol comme une crêpe.") },
      ],
    },
    glacier: {
      name: t("Le Glacier de verre"), short: t("Glacier"),
      pitch: t("Une banquise qui craque, des grottes de glace et des blizzards qui surgissent de nulle part."),
      palette: { ground: 0xdfeaf2, ground2: 0xc8dbe8, accent: 0x7fd0ff, sky: 0xb8d8f0, fog: 0xffffff },
      walls: "icecliffs",
      places: ring([
        P("igloo", t("le Grand Igloo"), "loot", [0, 0], { props: ["igloo"] }),
        P("grottes", t("les Grottes de glace"), "hide", at(25, 16), { props: ["icecave", "icespike", "icespike"] }),
        P("sapins", t("la Forêt de sapins"), "hide", at(80, 16), { props: ["pine", "pine", "pine", "pine", "pine"] }),
        P("banquise", t("la Banquise"), "danger", at(135, 15), { props: ["crack", "floe", "floe"] }),
        P("patinoire", t("la Patinoire"), "open", at(185, 15), { props: ["rink"] }),
        P("crevasse", t("la Crevasse"), "danger", at(235, 16), { props: ["chasm", "icespike"] }),
        P("pics", t("les Pics gelés"), "hide", at(290, 16), { props: ["icespike", "icespike", "icespike", "rock"] }),
      ]),
      traps: [
        { id: "ice", name: t("une plaque de verglas"), hit: t("{v} pose le pied sur le verglas de {a} et fait trois tours sur les fesses.") },
        { id: "snowball", name: t("une boule de neige géante"), hit: t("Une boule de neige géante lâchée par {a} roule sur {v}. Il n'en dépasse plus que les bottes.") },
        { id: "hole", name: t("un trou dans la glace"), hit: t("{v} passe à travers le trou creusé par {a} et ressort dans une baignoire d'eau tiède.") },
      ],
      hazards: [
        { id: "blizzard", name: t("un blizzard"), fx: "fall", color: 0xffffff, hit: t("Le blizzard souffle {v} jusqu'au bout de la patinoire.") },
        { id: "avalanche", name: t("une avalanche de neige poudreuse"), fx: "fall", color: 0xf2f8ff, hit: t("Une avalanche de poudreuse ensevelit {v}. On ne voit plus que son bonnet.") },
        { id: "crack", name: t("la glace qui craque"), fx: "shake", color: 0x7fd0ff, hit: t("La glace craque sous {v}, qui part à la dérive sur un glaçon.") },
      ],
    },
    cite: {
      name: t("La Cité désertée"), short: t("Cité"),
      pitch: t("Une ville abandonnée : toits, ruelles, égouts et immeubles en carton prêts à s'effondrer."),
      palette: { ground: 0x5d5a58, ground2: 0x6b6764, accent: 0xff8a3d, sky: 0xc9b8a6, fog: 0xb0ff9a },
      walls: "buildings",
      places: ring([
        P("place", t("la Grand-Place"), "loot", [0, 0], { props: ["fountain"] }),
        P("toits", t("les Toits"), "hide", at(20, 16), { props: ["building", "building", "antenna", "chimney"] }),
        P("marche", t("le Marché"), "hide", at(75, 15), { props: ["stall", "stall", "stall", "crate", "crate"] }),
        P("tour", t("la Tour penchée"), "danger", at(125, 16), { props: ["leaning"] }),
        P("egouts", t("les Égouts"), "hide", at(175, 15), { props: ["manhole", "manhole", "pipe", "dumpster"] }),
        P("parc", t("le Parc"), "open", at(225, 16), { props: ["tree", "tree", "bench", "bench"] }),
        P("chantier", t("le Chantier"), "danger", at(275, 15), { props: ["crane", "scaffold", "crate"] }),
        P("ruelle", t("la Ruelle"), "hide", at(325, 16), { props: ["dumpster", "dumpster", "building"] }),
      ]),
      traps: [
        { id: "bucket", name: t("un seau de peinture au-dessus d'une porte"), hit: t("SPLASH ! {v} pousse la porte et reçoit le seau de peinture de {a} sur la tête.") },
        { id: "manhole", name: t("une fausse bouche d'égout"), hit: t("{v} marche sur la fausse bouche d'égout de {a} et disparaît dans un toboggan de mousse.") },
        { id: "marbles", name: t("un tapis de billes"), hit: t("{v} roule sur le tapis de billes de {a} et termine dans une poubelle.") },
      ],
      hazards: [
        { id: "collapse", name: t("un immeuble en carton qui s'effondre"), fx: "fall", color: 0xc49a6c, hit: t("L'immeuble en carton s'effondre sur {v}, qui ressort coiffé·e d'une boîte à chaussures.") },
        { id: "blackout", name: t("une coupure de courant"), fx: "dark", color: 0x111111, hit: t("Coupure de courant ! Dans le noir, {v} fonce droit dans un lampadaire.") },
        { id: "sewer", name: t("les égouts qui débordent de mousse verte"), fx: "rise", color: 0x9be564, hit: t("Les égouts débordent : {v} surfe sur une vague de mousse verte.") },
      ],
    },
    volcan: {
      name: t("L'Archipel du volcan"), short: t("Volcan"),
      pitch: t("Des îlots reliés par des ponts de cordes, des geysers et un volcan qui crache de la gelée."),
      palette: { ground: 0x3b3433, ground2: 0x4a403d, accent: 0xff7a2f, sky: 0xd9a37e, fog: 0xffb35c },
      walls: "sea",
      places: ring([
        P("cratere", t("le Cratère"), "loot", [0, 0], { props: ["volcano"] }),
        P("palmiers", t("l'Îlot des palmiers"), "hide", at(30, 16), { props: ["palm", "palm", "palm", "bush"] }),
        P("ponts", t("les Ponts de cordes"), "danger", at(85, 15), { props: ["ropebridge"] }),
        P("grotte", t("la Grotte de lave"), "hide", at(140, 16), { props: ["lavacave", "rock", "rock"] }),
        P("geysers", t("les Geysers"), "danger", at(195, 15), { props: ["geyser", "geyser", "geyser"] }),
        P("plage", t("la Plage noire"), "open", at(250, 16), { props: ["parasol", "rock"] }),
        P("cabane", t("la Cabane du pêcheur"), "hide", at(305, 16), { props: ["hut", "crate", "barrel"] }),
      ]),
      traps: [
        { id: "jelly", name: t("une fosse de gelée orange"), hit: t("{v} s'enfonce jusqu'à la taille dans la fosse de gelée de {a}. Ça tremble, ça colle.") },
        { id: "crab", name: t("un crabe dressé"), hit: t("Le crabe dressé par {a} pince les fesses de {v}, qui bondit à deux mètres.") },
        { id: "rope", name: t("une corde de pont sabotée"), hit: t("La corde sabotée par {a} lâche : {v} se retrouve suspendu·e au-dessus de la gelée.") },
      ],
      hazards: [
        { id: "eruption", name: t("une éruption de gelée"), fx: "burst", color: 0xff7a2f, hit: t("Le volcan crache de la gelée orange : {v} est recouvert·e de la tête aux pieds.") },
        { id: "geyser", name: t("un geyser de mousse"), fx: "burst", color: 0xffffff, hit: t("Un geyser de mousse propulse {v} dans les airs. Atterrissage dans un palmier.") },
        { id: "wave", name: t("une vague de bulles"), fx: "rise", color: 0x7fd8ff, hit: t("Une vague de bulles géantes emporte {v} jusqu'à la plage.") },
      ],
    },
  };
  const LIST = Object.keys(ARENAS);
  root.ARENAS = { ...ARENAS };
  root.ARENA_LIST = LIST;
  if (typeof module !== "undefined") module.exports = { ARENAS, LIST };
})(typeof window !== "undefined" ? window : globalThis);
