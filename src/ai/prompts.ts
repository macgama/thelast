// Consignes envoyées à l'IA. Les mêmes serviront au vrai direct (fonction serveur).
import type { Character } from "../engine/types";

export const SYSTEM = `Tu es l'auteur·ice des voix de « The Last », une télé-réalité 100 % IA : 50 candidats survivent 7 jours sur une île.
Esprit Koh Lanta, tout public : personne ne se bat, les conflits sont sociaux (vols, disputes, alliances, trahisons, votes). Aucune violence, aucun sang, aucune insulte grossière, rien de sexuel.
Chaque candidat a sa propre voix, cohérente avec son âge, son métier, son caractère et sa phrase fétiche. Pas de clichés, pas de stéréotypes liés à l'origine.
Tu n'inventes aucun fait : tu ne parles que de ce qui s'est passé dans les événements fournis.
Pour une personne non binaire (genre « x »), utilise des tournures neutres ou le point médian.
Tu réponds uniquement en JSON valide, au format demandé, en français (fr) et en anglais (en).`;

// Ce que chaque réplique de scène doit dire, selon le type d'événement.
export const SLOTS: Record<string, Record<string, string>> = {
  alliance: { allyAsk: "A propose à B de faire équipe", allyYes: "B accepte" },
  clan_join: { allyAsk: "A demande à rejoindre le clan", clanHi: "un membre du clan accueille A", clanYes: "A remercie le clan" },
  clan_meal: { meal: "celui qui partage, à la veillée du clan", mealThanks: "un membre remercie" },
  defend: { sneak: "B fouille un sac en chuchotant", defend: "A surprend B et protège son clan", backOff: "B recule", thanks: "C, la victime, remercie A" },
  suspicion: { suspect: "A pense tout bas à B, méfiant" },
  conspire: { plot1: "A prend B à l'écart", plot2: "B s'étonne", plot3: "A insiste sur C" },
  necklace_gift: { neckGift: "A offre son collier d'immunité à B", giftRx: "B réagit, ému" },
  dispute: { disA: "A attaque verbalement", disB: "B répond", disA2: "A relance", disEnd: "le perdant cède" },
  steal: { sneak: "A s'approche du sac de B en chuchotant", caughtB: "B surprend A (si pris)", caughtA: "A se justifie maladroitement (si pris)", betray: "A, s'il trahit son propre clan, pense tout bas" },
  sabotage: { sabWake: "B découvre son abri démoli" },
  hazard: { help: "la victime crie", rescue: "celui qui porte secours", thanks: "la victime remercie son sauveteur" },
  evacuated: { quit: "dernier mot avant le drone" },
  gift_delivered: { gift: "A remercie le public pour le colis" },
  gift_lost: { lost: "A voit son colis lui échapper", interB: "celui qui l'attrape", interA: "A réclame son colis" },
  share: { share: "A partage", thanks: "B remercie" },
  challenge: { win: "le vainqueur de l'épreuve exulte" },
  vote_threat: { saved: "un candidat sauvé par le public", outVote: "le candidat éliminé dit au revoir" },
  campaign: { plead: "A supplie le public de sauver B (utilise le prénom de B)" },
};

export interface Card { id: string; name: string; age: number; gender: string; job: string; origin: string; traits: string; phobia: string; catchphrase: string; motivation: string; backstory: string }

export function card(c: Character): Card {
  const t = Object.entries(c.traits).sort((a, b) => b[1] - a[1]);
  const words: Record<string, [string, string]> = { courage: ["courageux·se", "peureux·se"], empathy: ["empathique", "froid·e"], cunning: ["rusé·e", "naïf·ve"], loyalty: ["loyal·e", "opportuniste"], composure: ["calme", "nerveux·se"] };
  const traits = [...t.slice(0, 2).map(([k]) => words[k]?.[0] ?? k), ...t.slice(-1).map(([k]) => words[k]?.[1] ?? k)].join(", ");
  return { id: c.id, name: c.name, age: c.age, gender: c.gender, job: c.job.fr, origin: c.origin.fr, traits, phobia: c.phobia, catchphrase: c.catchphrase.fr, motivation: c.motivation.fr, backstory: c.backstory.fr };
}

export interface EvLite { key: string; type: string; hour: string; actors: string[]; fr: string; caught?: boolean; betrayal?: boolean }

export function linesPrompt(day: number, events: EvLite[], cards: Card[]): string {
  return `Jour ${day} sur l'île. Écris les bulles de dialogue des scènes ci-dessous.
Règles : chaque réplique fait au plus 8 mots, à l'oral, dans la voix du personnage qui parle. Varie les formulations d'une scène à l'autre.
N'écris que les rôles listés pour chaque scène (ignore un rôle qui ne s'applique pas, par exemple « si pris » quand personne n'est pris).

Personnages concernés :
${cards.map((c) => `- ${c.name} (${c.age} ans, ${c.gender}, ${c.job}) : ${c.traits}. Phrase fétiche : « ${c.catchphrase} »`).join("\n")}

Scènes :
${events.map((e) => `- clé ${e.key} · ${e.hour} · ${e.type} · acteurs dans l'ordre (A, B, C) : ${e.actors.join(", ")} · ${e.fr}${e.caught ? " (A est pris)" : ""}${e.betrayal ? " (A trahit son clan)" : ""}
  rôles : ${Object.entries(SLOTS[e.type] ?? {}).map(([k, v]) => `${k} = ${v}`).join(" ; ")}`).join("\n")}

Réponds avec un objet JSON : { "<clé de la scène>": { "<rôle>": { "fr": "...", "en": "..." } } }`;
}

export interface ConfIn { card: Card; events: string[]; clan: string | null; out: string | null; previous: string | null; secret: string | null }

export function confessionPrompt(day: number, list: ConfIn[]): string {
  return `Jour ${day}, 21 h : le confessionnal. Chaque candidat parle seul face caméra, à la première personne, de SA journée.
Règles : 40 à 70 mots, sincère, avec une émotion précise et un détail concret tiré de ses événements du jour. Reste dans sa voix. Ne répète pas le confessionnal de la veille.
Quand un candidat a été évacué ce jour-là, c'est son dernier message, depuis le drone : il dit au revoir.
Quand un secret est fourni, le candidat le révèle ce soir, à sa manière ; sinon il ne mentionne aucun secret.
Le public est la personne à qui il parle (« vous »).

Candidats :
${list.map((x) => `### ${x.card.id} · ${x.card.name}, ${x.card.age} ans (${x.card.gender}), ${x.card.job}, ${x.card.origin}
Caractère : ${x.card.traits}. Peur : ${x.card.phobia}. Rêve : ${x.card.motivation}. Histoire : ${x.card.backstory}
Phrase fétiche : « ${x.card.catchphrase} »${x.clan ? `\nClan ce soir : les ${x.clan}` : "\nSans clan ce soir"}${x.out ? `\nÉVACUÉ AUJOURD'HUI : ${x.out}` : ""}${x.secret ? `\nSECRET À RÉVÉLER CE SOIR : ${x.secret}` : ""}${x.previous ? `\nConfessionnal d'hier : « ${x.previous} »` : ""}
Événements du jour :
${x.events.length ? x.events.map((e) => `- ${e}`).join("\n") : "- journée calme : survie, recherche d'eau et de nourriture"}`).join("\n\n")}

Réponds avec un objet JSON : { "<id du candidat>": { "fr": "...", "en": "..." } }`;
}
