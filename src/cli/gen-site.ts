// Génère les données de la plateforme pour la démo :
// - demo/emissions.json : émissions, saisons et épisodes (page d'accueil façon Netflix) ;
// - demo/personnages.json : fiches publiques des 100 personnages (sans les secrets), avec leur carrière.
// Usage : npm run site   (après npm run replay, qui écrit demo/data.json)
//
// La saison 1 de Survivor est celle de la démo (graine de config/season.json) : elle est « en cours »,
// donc ses résultats ne comptent pas encore. Une saison pilote, simulée avec une autre graine,
// sert d'historique pour montrer la progression des personnages sans dévoiler la fin de la saison 1.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { island } from "../engine/arenas/island";
import { Season, dayOf } from "../engine/season";
import type { Character, SeasonConfig, SeasonResult } from "../engine/types";
import { Narrator } from "../narration/narrator";
import { careerOf, type ShowResult } from "../characters/career";

const PILOT_SEED = 7;
const pool: Character[] = JSON.parse(readFileSync("data/characters.json", "utf8"));
const config: SeasonConfig = JSON.parse(readFileSync("config/season.json", "utf8"));
const titles: Record<string, string[]> = JSON.parse(readFileSync("config/episodes.json", "utf8"));
const looks = Object.fromEntries(JSON.parse(readFileSync("data/looks.json", "utf8")).map((l: any) => [l.id, l]));
const featured = existsSync("demo/featured.json") ? JSON.parse(readFileSync("demo/featured.json", "utf8")) : {};
const C = Object.fromEntries(pool.map((c) => [c.id, c]));

/** Classement final : le vainqueur, puis les autres du dernier au premier évacué. */
function ranking(r: SeasonResult): { id: string; rank: number; day?: number; cause?: string }[] {
  const out = r.final.filter((s) => !s.alive).sort((a, b) => b.eliminatedAt! - a.eliminatedAt!);
  return [{ id: r.winner! }, ...out.map((s) => ({ id: s.id, day: dayOf(s.eliminatedAt!), cause: s.eliminationCause }))].map((x, i) => ({ ...x, rank: i + 1 }));
}

/** Les épisodes : un par jour, avec les moments forts et les évacués. */
function episodes(r: SeasonResult, seed: number, live: boolean) {
  const fr = new Narrator(r, "fr");
  const en = new Narrator(r, "en");
  const names = titles[String(seed)] ?? [];
  const namesEn = titles[`${seed}.en`] ?? [];
  return Array.from({ length: config.days }, (_, i) => {
    const day = i + 1;
    const ev = r.events.filter((e) => dayOf(e.tick) === day && e.type !== "season_start" && fr.line(e));
    const out = ev.filter((e) => e.type === "evacuated").map((e) => e.actors[0]);
    const strong = ev.filter((e) => e.type !== "evacuated").sort((a, b) => b.weight - a.weight).slice(0, 3);
    const faces = [...new Set([...strong.flatMap((e) => e.actors), ...out])].filter((id) => C[id]);
    const star = faces.filter((id) => featured[id] && live);
    return {
      n: day,
      title: names[i] ?? (day === config.days ? "Le Prime" : ""),
      moments: strong.map((e) => fr.line(e)!.replace(/^📢\s*/, "")),
      en: { title: namesEn[i] ?? (day === config.days ? "The Finale" : ""), moments: strong.map((e) => (en.line(e) ?? fr.line(e)!).replace(/^📢\s*/, "")) },
      out: out.map((id) => C[id].name),
      faces: [...star, ...faces.filter((id) => !star.includes(id))].slice(0, 3),
      left: r.cast.length - r.final.filter((s) => !s.alive && dayOf(s.eliminatedAt!) <= day).length,
    };
  });
}

const s1 = new Season(pool, island, config).run();
const pilot = new Season(pool, island, { ...config, seed: PILOT_SEED }).run();
const pilotRank = ranking(pilot);
const results: Record<string, ShowResult[]> = {};
for (const x of pilotRank) (results[x.id] ??= []).push({ show: "survivor", season: 0, rank: x.rank, of: pilot.cast.length, day: x.day, cause: x.cause });
const inS1 = new Set(s1.cast.map((c) => c.id));

// Rivalités et alliances nées pendant les saisons terminées (la saison 1 est en cours : on n'en dévoile rien)
const RIVAL: Record<string, string> = { steal: "vol", sabotage: "sabotage", suspicion: "soupçons", dispute: "dispute", conspire: "complot" };
const ALLY: Record<string, string> = { alliance: "alliance", clan_join: "même clan", share: "partage", defend: "défense" };
const links: Record<string, Record<string, { rival: number; ally: number; why: string[] }>> = {};
for (const e of pilot.events) {
  const [a, b] = e.actors;
  if (!a || !b || a === b || !(RIVAL[e.type] || ALLY[e.type])) continue;
  if (e.type === "steal" && !e.data?.caught && !e.data?.betrayal) continue; // un vol passé inaperçu ne crée pas de rivalité
  for (const [x, y] of [[a, b], [b, a]]) {
    const l = ((links[x] ??= {})[y] ??= { rival: 0, ally: 0, why: [] });
    if (RIVAL[e.type]) l.rival++; else l.ally++;
    const w = e.type === "steal" && e.data?.betrayal ? "trahison" : RIVAL[e.type] ?? ALLY[e.type];
    if (!l.why.includes(w)) l.why.push(w);
  }
}
const top = (id: string, k: "rival" | "ally") => Object.entries(links[id] ?? {}).filter(([, l]) => l[k] > 0 && (k === "ally" ? l.ally > l.rival : l.rival >= l.ally))
  .sort((x, y) => y[1][k] - x[1][k]).slice(0, 3).map(([o, l]) => ({ id: o, n: l[k], why: l.why.filter((w) => (k === "rival" ? Object.values(RIVAL).includes(w) || w === "trahison" : Object.values(ALLY).includes(w))), where: "Survivor · saison pilote" }));

// Titres de carrière en anglais (« Vainqueur · Survivor pilote » → « Winner · Survivor pilot »)
const titleEn = (t: string) => t.replace(/^Vainqueur/, "Winner").replace(/^Finaliste/, "Finalist").replace(/^Légende de The Last$/, "Legend of The Last").replace(/ pilote$/, " pilot").replace("Chasse au trésor", "Treasure Hunt");

const people = pool.map((c) => {
  const k = careerOf(c, results[c.id] ?? []);
  return {
    id: c.id, name: c.name, age: c.age, gender: c.gender, job: c.job.fr, origin: c.origin.fr,
    bio: c.backstory.fr, motivation: c.motivation.fr, catchphrase: c.catchphrase.fr,
    en: { job: c.job.en, origin: c.origin.en, bio: c.backstory.en, motivation: c.motivation.en, catchphrase: c.catchphrase.en },
    traits: c.traits, skills: c.skills, phobia: c.phobia, signature: looks[c.id]?.signature ?? "",
    season: inS1.has(c.id), featured: !!featured[c.id],
    career: { xp: k.xp, level: k.level, next: k.next, bonus: k.bonus, learned: k.learned, cosmetics: k.cosmetics, titles: k.titles, results: k.results, wins: k.wins, legend: k.legend,
      played: [...k.results.map((r) => ({ show: r.show, season: r.season, done: true })), ...(inS1.has(c.id) ? [{ show: "survivor", season: 1, done: false }] : [])],
      rivals: top(c.id, "rival"), allies: top(c.id, "ally"), titlesEn: k.titles.map(titleEn) },
  };
});
writeFileSync("demo/personnages.json", JSON.stringify(people));

const podium = pilotRank.slice(0, 3).map((x) => x.id);
const shows = [
  {
    id: "survivor", name: "The Last - Survivor", tagline: "50 naufragés, une île, 7 jours. Un seul restera.",
    text: "Survivre sur une île déserte : trouver de l'eau, construire un abri, former un clan et tenir face aux catastrophes. Chaque soir, le public vote pour sauver ses favoris. Les éliminés sont évacués par drone.",
    genres: ["Survie", "Stratégie", "Alliances"], status: "live",
    en: { tagline: "50 castaways, one island, 7 days. Only one will remain.", text: "Survive on a desert island: find water, build a shelter, form a clan and hold out against disasters. Every evening, the public votes to save its favorites. Evicted contestants are evacuated by drone.", genres: ["Survival", "Strategy", "Alliances"] },
    seasons: [
      { n: 1, label: "Saison 1 · L'Île aux Échos", en: { label: "Season 1 · Echo Island" }, status: "live", cast: s1.cast.length, play: "survivor.html", episodes: episodes(s1, config.seed, true) },
      { n: 0, label: "Saison pilote", en: { label: "Pilot season", note: "Trial season, simulated to kick off the characters' careers." }, status: "done", cast: pilot.cast.length, winner: pilot.winner, podium, note: "Saison d'essai, simulée pour lancer les carrières des personnages.", episodes: episodes(pilot, PILOT_SEED, false) },
    ],
  },
  {
    id: "arena", name: "The Last - Arena Battle", tagline: "Une arène, des duels, un seul debout.", icon: "⚔️",
    text: "La deuxième émission de The Last, en préparation. Des duels chaque jour et une mêlée finale, avec des armes cartoon. Les candidats viennent du même vivier de 100 personnages.",
    genres: ["Combat", "Duels", "Trahisons"], status: "casting",
    en: { tagline: "One arena, duels, only one left standing.", text: "The second show from The Last, in the works. Duels every day and a final free-for-all, with cartoon weapons. Contestants come from the same pool of 100 characters.", genres: ["Combat", "Duels", "Betrayals"] },
    seasons: [{ n: 1, label: "Saison 1", en: { label: "Season 1" }, status: "casting", cast: 50, voted: 30, episodes: [] }],
  },
  {
    id: "retour", name: "The Last - Le Retour", tagline: "Une seconde chance, votée par le public.", special: true, icon: "🔁",
    text: "Émission spéciale de 24 heures. Les spectateurs repêchent 10 anciens candidats évacués. Ils s'affrontent sur l'île, et le vainqueur gagne sa place dans la prochaine saison de Survivor.",
    genres: ["Spécial", "Repêchage"], status: "casting",
    en: { name: "The Last - The Return", tagline: "A second chance, voted by the public.", text: "A 24-hour special. Viewers bring back 10 former evacuated contestants. They face off on the island, and the winner earns a place in the next season of Survivor.", genres: ["Special", "Second chance"] },
    seasons: [{ n: 1, label: "Spécial 1", en: { label: "Special 1" }, status: "casting", cast: 10, voted: 10, episodes: [] }],
  },
  {
    id: "allstars", name: "The Last - All-Stars", tagline: "Les meilleurs de Survivor et d'Arena, réunis.", special: true, icon: "⭐",
    text: "Le crossover des champions : 20 personnages parmi les plus expérimentés, choisis par le public. Trois jours sur l'île, puis quatre jours dans l'arène. Le vainqueur devient une Légende s'il a déjà gagné une autre émission.",
    genres: ["Crossover", "Champions", "Survie", "Combat"], status: "casting",
    en: { tagline: "The best of Survivor and Arena, together.", text: "The champions' crossover: 20 of the most experienced characters, chosen by the public. Three days on the island, then four days in the arena. The winner becomes a Legend if they've already won another show.", genres: ["Crossover", "Champions", "Survival", "Combat"] },
    seasons: [{ n: 1, label: "Saison 1", en: { label: "Season 1" }, status: "casting", cast: 20, voted: 20, episodes: [] }],
  },
  {
    id: "treasure", name: "The Last - Chasse au trésor", tagline: "Des indices, une carte immense, un seul trésor.", icon: "🗺️",
    text: "Des indices cachés sur une carte immense. Les candidats fouillent, déchiffrent, se méfient et se volent les pistes. Le premier au trésor gagne.",
    genres: ["Énigmes", "Exploration"], status: "soon", seasons: [],
    en: { name: "The Last - Treasure Hunt", tagline: "Clues, a huge map, a single treasure.", text: "Clues hidden across a huge map. Contestants search, decode, distrust each other and steal each other's leads. First to the treasure wins.", genres: ["Puzzles", "Exploration"] },
  },
  {
    id: "course", name: "The Last - Course autour du monde", tagline: "Sept jours, sept pays, une seule ligne d'arrivée.", icon: "🌍",
    text: "Des binômes traversent le monde avec un petit budget : une étape par jour, des épreuves locales et des raccourcis risqués. Les derniers arrivés sont éliminés. Le public choisit chaque soir le pays suivant.",
    genres: ["Aventure", "Voyage", "Binômes"], status: "soon", seasons: [],
    en: { name: "The Last - Race Around the World", tagline: "Seven days, seven countries, one finish line.", text: "Pairs race around the world on a small budget: one leg a day, local challenges and risky shortcuts. The last to arrive are eliminated. Every evening, the public picks the next country.", genres: ["Adventure", "Travel", "Pairs"] },
  },
  {
    id: "manoir", name: "The Last - Huis clos", tagline: "Un manoir, des secrets, un traître parmi eux.", icon: "🕯️",
    text: "Enfermés dans un manoir, les candidats mènent l'enquête : chaque nuit, un mystère frappe. Alliances, faux indices et trahisons. Les spectateurs voient tout et votent pour démasquer le coupable avant les candidats.",
    genres: ["Enquête", "Mystère", "Trahisons"], status: "soon", seasons: [],
    en: { name: "The Last - Locked In", tagline: "A manor, secrets, a traitor among them.", text: "Locked in a manor, the contestants investigate: every night, a mystery strikes. Alliances, false clues and betrayals. Viewers see everything and vote to unmask the culprit before the contestants do.", genres: ["Investigation", "Mystery", "Betrayals"] },
  },
];
// Éligibles des votes spéciaux : les évacués de la saison terminée (repêchage), les plus expérimentés (All-Stars)
const retour = pilotRank.filter((x) => x.rank > 1).map((x) => x.id);
const allstars = [...people].sort((a, b) => b.career.xp - a.career.xp).slice(0, 30).map((p) => p.id);
writeFileSync("demo/emissions.json", JSON.stringify({ shows, eligible: { retour, allstars }, top: [...people].sort((a, b) => b.career.xp - a.career.xp).slice(0, 10).map((p) => p.id) }));
console.log(`demo/emissions.json : ${shows.length} émissions · demo/personnages.json : ${people.length} fiches · pilote gagné par ${C[pilot.winner!]?.name}`);
