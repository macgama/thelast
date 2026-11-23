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
  const names = titles[String(seed)] ?? [];
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

const people = pool.map((c) => {
  const k = careerOf(c, results[c.id] ?? []);
  return {
    id: c.id, name: c.name, age: c.age, gender: c.gender, job: c.job.fr, origin: c.origin.fr,
    bio: c.backstory.fr, motivation: c.motivation.fr, catchphrase: c.catchphrase.fr,
    traits: c.traits, skills: c.skills, phobia: c.phobia, signature: looks[c.id]?.signature ?? "",
    season: inS1.has(c.id), featured: !!featured[c.id],
    career: { xp: k.xp, level: k.level, next: k.next, bonus: k.bonus, learned: k.learned, cosmetics: k.cosmetics, titles: k.titles, results: k.results },
  };
});
writeFileSync("demo/personnages.json", JSON.stringify(people));

const podium = pilotRank.slice(0, 3).map((x) => x.id);
const shows = [
  {
    id: "survivor", name: "The Last - Survivor", tagline: "50 naufragés, une île, 7 jours. Un seul restera.",
    text: "Survivre sur une île déserte : trouver de l'eau, construire un abri, former un clan et tenir face aux catastrophes. Chaque soir, le public vote pour sauver ses favoris. Les éliminés sont évacués par drone.",
    genres: ["Survie", "Stratégie", "Alliances"], status: "live",
    seasons: [
      { n: 1, label: "Saison 1 · L'Île aux Échos", status: "live", cast: s1.cast.length, play: "survivor.html", episodes: episodes(s1, config.seed, true) },
      { n: 0, label: "Saison pilote", status: "done", cast: pilot.cast.length, winner: pilot.winner, podium, note: "Saison d'essai, simulée pour lancer les carrières des personnages.", episodes: episodes(pilot, PILOT_SEED, false) },
    ],
  },
  {
    id: "arena", name: "The Last - Arena Battle", tagline: "Une arène, des duels, un seul debout.",
    text: "La deuxième émission de The Last, en préparation. Des duels chaque jour et une mêlée finale, avec des armes cartoon. Les candidats viennent du même vivier de 100 personnages.",
    genres: ["Combat", "Duels", "Trahisons"], status: "casting",
    seasons: [{ n: 1, label: "Saison 1", status: "casting", cast: 50, voted: 30, episodes: [] }],
  },
  {
    id: "treasure", name: "The Last - Chasse au trésor", tagline: "Des indices, une carte immense, un seul trésor.",
    text: "Des indices cachés sur une carte immense. Les candidats fouillent, se méfient et se volent les pistes. Le premier au trésor gagne. Nom provisoire.",
    genres: ["Énigmes", "Exploration"], status: "soon", seasons: [],
  },
];
writeFileSync("demo/emissions.json", JSON.stringify({ shows, top: [...people].sort((a, b) => b.career.xp - a.career.xp).slice(0, 10).map((p) => p.id) }));
console.log(`demo/emissions.json : ${shows.length} émissions · demo/personnages.json : ${people.length} fiches · pilote gagné par ${C[pilot.winner!]?.name}`);
