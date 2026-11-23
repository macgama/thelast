// Fan-club : suivre un personnage partout, d'une émission à l'autre.
// Les badges de fidélité sont gratuits : ils se gagnent en revenant, jamais en payant.
// Démo : tout est gardé dans le navigateur du spectateur (localStorage).
(function () {
  const KEY = "thelast-fans";
  const today = () => new Date().toISOString().slice(0, 10);
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null") || { fans: {}, days: [] }; } catch { return { fans: {}, days: [] }; } };
  const save = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };
  const hash = (s) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };

  // une visite par jour suffit à faire avancer la fidélité
  const st = load();
  if (!st.days.includes(today())) { st.days.push(today()); st.days = st.days.slice(-60); save(st); }

  const BADGES = [
    { id: "supporter", icon: "💛", name: "Supporter", need: 1, text: "Tu as rejoint son fan-club." },
    { id: "fidele", icon: "🔥", name: "Fidèle", need: 3, text: "3 jours de visite depuis ton adhésion." },
    { id: "inconditionnel", icon: "💎", name: "Inconditionnel·le", need: 7, text: "7 jours de visite depuis ton adhésion." },
    { id: "globe", icon: "🌍", name: "Globe-trotter", need: 0, text: "Son parcours compte au moins deux émissions ou saisons." },
  ];

  window.TheLastFans = {
    BADGES,
    isFan: (id) => !!load().fans[id],
    list: () => Object.keys(load().fans),
    toggle(id) {
      const s = load();
      if (s.fans[id]) delete s.fans[id]; else s.fans[id] = { since: today() };
      save(s);
      return !!s.fans[id];
    },
    /** Nombre de membres du fan-club : simulé pour la démo, plus ton adhésion. */
    members(c) {
      const base = Math.round(800 + hash(c.id + "fans") * 9000 + c.career.level * 1500 + (c.featured ? 12000 : 0) + (c.career.legend ? 30000 : 0) + c.career.wins * 6000);
      return base + (load().fans[c.id] ? 1 : 0);
    },
    /** Badges gagnés pour ce personnage, et le prochain à décrocher. */
    badges(c) {
      const s = load(), f = s.fans[c.id];
      if (!f) return { got: [], next: null, days: 0 };
      const days = s.days.filter((d) => d >= f.since).length;
      const shows = (c.career.played || []).length;
      const got = BADGES.filter((b) => (b.id === "globe" ? shows >= 2 : days >= b.need));
      const next = BADGES.find((b) => b.id !== "globe" && days < b.need);
      return { got, next: next ? { ...next, left: next.need - days } : null, days };
    },
  };
})();
