// Phrases bilingues du narrateur « sans IA ». Ton sobre : aucune violence graphique, on parle d'évacuation.
import type { EliminationCause, HazardId, I18n, Item, Lang } from "../engine/types";
import type { ShowrunnerKind } from "../engine/season";

const t = (fr: string, en: string): I18n => ({ fr, en });

export const ITEM: Record<Item, I18n> = {
  flask: t("une gourde", "a water flask"),
  medkit: t("une trousse de secours", "a first-aid kit"),
  map: t("une carte de l'île", "a map of the island"),
  rope: t("une corde", "a rope"),
  rations: t("des rations", "some rations"),
  torch: t("une lampe torche", "a torch"),
};

export const HAZARD: Record<HazardId, I18n> = {
  wasps: t("un essaim de guêpes", "a swarm of wasps"),
  fall: t("une mauvaise chute", "a bad fall"),
  drowning: t("un courant traître", "a treacherous current"),
  snake: t("une morsure de serpent", "a snake bite"),
  rockslide: t("un éboulement", "a rockslide"),
  fever: t("une forte fièvre", "a high fever"),
};

export const CAUSE: Record<EliminationCause, I18n> = {
  hazard: t("blessé{e} par {hazard}", "injured by {hazard}"),
  thirst: t("déshydraté{e}", "dehydrated"),
  hunger: t("affaibli{e} par la faim", "weakened by hunger"),
  duel: t("vaincu{e} par {by}", "defeated by {by}"),
  exhaustion: t("à bout de forces", "completely exhausted"),
  withdrawal: t("a jeté l'éponge", "threw in the towel"),
  vote: t("n'a pas été sauvé{e} par le public", "was not saved by the audience"),
  finale: t("battu{e} lors de la finale", "beaten in the finale"),
};

export const SHOWRUNNER: Record<ShowrunnerKind, I18n> = {
  wasp_swarm: t("Alerte : un essaim de guêpes tueuses s'abat sur {zone} !", "Alert: a swarm of killer wasps descends on {zone}!"),
  storm: t("Une tempête tropicale balaie l'île. Ceux qui n'ont pas d'abri vont souffrir.", "A tropical storm sweeps the island. Those without shelter will suffer."),
  drought: t("Les sources se tarissent : l'eau devient rare pour les prochaines heures.", "The springs are drying up: water will be scarce for the next few hours."),
  heatwave: t("Une vague de chaleur écrasante s'installe sur l'île.", "A crushing heatwave settles over the island."),
  supply_drop: t("Un ravitaillement est largué sur {zone}. Tout le monde accourt…", "A supply crate is dropped on {zone}. Everyone rushes in…"),
};

export const LINES: Record<string, I18n[]> = {
  season_start: [t("{n} candidats débarquent sur {arena}. Un seul en repartira vainqueur.", "{n} contestants land on {arena}. Only one will leave as the winner.")],
  found_water: [
    t("{a} trouve enfin de l'eau {at}.", "{a} finally finds water at {zone}."),
    t("{a} se désaltère {at}, soulagé{e}.", "{a} drinks at {zone}, relieved."),
  ],
  found_food: [t("{a} déniche de quoi manger {at}.", "{a} finds something to eat at {zone}.")],
  found_item: [
    t("{a} découvre {item} {at}.", "{a} discovers {item} at {zone}."),
    t("En fouillant {zone}, {a} met la main sur {item}.", "Searching {zone}, {a} gets hold of {item}."),
  ],
  alliance: [
    t("{a} et {b} se serrent la main : une alliance est née.", "{a} and {b} shake hands: an alliance is born."),
    t("{a} propose à {b} de faire équipe. Accepté.", "{a} asks {b} to team up. Accepted."),
  ],
  share: [t("{a} partage {what} avec {b}. Un geste qui ne s'oublie pas.", "{a} shares {what} with {b}. A gesture that won't be forgotten.")],
  steal_ok: [t("{a} subtilise {item} à {b} sans se faire voir.", "{a} quietly swipes {item} from {b}.")],
  steal_caught: [t("{a} tente de voler {b}… et se fait prendre la main dans le sac.", "{a} tries to rob {b}… and gets caught red-handed.")],
  betrayal: [t("Trahison ! {a} rompt son alliance avec {b}.", "Betrayal! {a} breaks the alliance with {b}.")],
  duel: [
    t("Face-à-face tendu entre {a} et {b} {at}. {a} prend le dessus.", "Tense standoff between {a} and {b} at {zone}. {a} comes out on top."),
    t("{a} et {b} se disputent le même territoire. {b} doit reculer.", "{a} and {b} fight over the same ground. {b} has to back down."),
  ],
  hazard: [t("{a} est surpris{e} par {hazard} {at}, mais tient bon.", "{a} is caught by {hazard} at {zone}, but holds on.")],
  hazard_rescued: [t("{a} est touché{e} par {hazard}. {r} lui porte secours à temps.", "{a} is hit by {hazard}. {r} comes to the rescue just in time.")],
  evacuated: [t("Le drone de secours évacue {a} ({cause}). Il reste {n} candidats.", "The rescue drone evacuates {a} ({cause}). {n} contestants remain.")],
  gift_delivered: [t("Grâce à {s} spectateurs, un colis parachuté apporte {item} à {a}.", "Thanks to {s} viewers, a parachuted crate brings {item} to {a}.")],
  gift_lost: [t("Le colis destiné à {a} se perd dans les arbres.", "The crate meant for {a} gets lost in the trees.")],
  gift_intercepted: [t("Le colis destiné à {a} tombe… dans les mains de {b} !", "The crate meant for {a} lands… in {b}'s hands!")],
  vote_threat: [t("Ce soir, {list} sont menacés. Au public de décider qui sauver.", "Tonight, {list} are under threat. The audience decides who to save.")],
  vote_saved: [t("Le public a sauvé {list}.", "The audience saved {list}.")],
  finale: [t("Grande finale : {list} s'affrontent dans l'épreuve ultime.", "Grand finale: {list} face the ultimate challenge.")],
  winner: [t("{a} remporte la saison et devient The Last !", "{a} wins the season and becomes The Last!")],
};

export const WHAT: Record<string, I18n> = { water: t("son eau", "their water"), food: t("sa nourriture", "their food") };

export const UI: Record<string, I18n> = {
  day: t("Jour", "Day"),
  feed: t("Fil en direct (abonnés)", "Live feed (subscribers)"),
  daily: t("La Quotidienne de 19h", "The 7 PM Daily"),
  prime: t("Le Prime : bilan de la saison", "The Prime: season recap"),
  highlights: t("Les moments forts", "Highlights"),
  eliminated: t("Évacués aujourd'hui", "Evacuated today"),
  standings: t("Les plus populaires", "Most popular"),
  remaining: t("Candidats restants", "Remaining contestants"),
  winnerCard: t("Le vainqueur", "The winner"),
  stats: t("La saison en chiffres", "The season in numbers"),
  route: t("Ordre des évacuations", "Order of evacuations"),
  nobody: t("Personne", "Nobody"),
  and: t("et", "and"),
};

export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? (k === "e" ? "" : `{${k}}`)));
}

/** Accord en genre du français : {e} devient « e », rien, ou « ·e » (non binaire). */
export function agree(gender: "f" | "m" | "x" | undefined, lang: Lang): string {
  if (lang !== "fr") return "";
  return gender === "f" ? "e" : gender === "x" ? "·e" : "";
}

/** « la plage » devient « à la plage », « le lagon » devient « au lagon », etc. */
export function at(zoneName: string, lang: Lang): string {
  if (lang === "en") return `at ${zoneName}`;
  if (zoneName.startsWith("le ")) return `au ${zoneName.slice(3)}`;
  if (zoneName.startsWith("les ")) return `aux ${zoneName.slice(4)}`;
  return `à ${zoneName}`;
}

export function list(names: string[], lang: Lang): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} ${UI.and[lang]} ${names[names.length - 1]}`;
}
