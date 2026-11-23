// Banques de données bilingues pour générer le pool de personnages.
// Les concepteurs pourront ensuite retoucher chaque fiche à la main (ou l'enrichir par IA).
import type { I18n, Phobia } from "../engine/types";

const t = (fr: string, en: string): I18n => ({ fr, en });

export const FIRST_NAMES: { name: string; gender: "f" | "m" | "x" }[] = [
  ["Inès", "f"], ["Malik", "m"], ["Jade", "f"], ["Hugo", "m"], ["Amara", "f"], ["Kenji", "m"],
  ["Lucía", "f"], ["Tomasz", "m"], ["Noor", "f"], ["Elias", "m"], ["Sofia", "f"], ["Kwame", "m"],
  ["Léa", "f"], ["Rafael", "m"], ["Aiko", "f"], ["Dmitri", "m"], ["Zara", "f"], ["Oscar", "m"],
  ["Priya", "f"], ["Mateo", "m"], ["Freya", "f"], ["Yusuf", "m"], ["Chloé", "f"], ["Liam", "m"],
  ["Mei", "f"], ["Bastien", "m"], ["Aaliyah", "f"], ["Nils", "m"], ["Camille", "x"], ["Sacha", "x"],
  ["Ingrid", "f"], ["Diego", "m"], ["Fatou", "f"], ["Arjun", "m"], ["Margaux", "f"], ["Theo", "m"],
  ["Yara", "f"], ["Ivan", "m"], ["Nadia", "f"], ["Samuel", "m"], ["Elif", "f"], ["Jonas", "m"],
  ["Rosa", "f"], ["Kofi", "m"], ["Hana", "f"], ["Pablo", "m"], ["Maëlle", "f"], ["Ali", "m"],
  ["Charlie", "x"], ["Alex", "x"], ["Olga", "f"], ["Bruno", "m"], ["Leila", "f"], ["Finn", "m"],
  ["Ayumi", "f"], ["Tariq", "m"], ["Giulia", "f"], ["Lucas", "m"], ["Anouk", "f"], ["Omar", "m"],
  ["Sienna", "f"], ["Victor", "m"], ["Keira", "f"], ["Rémi", "m"], ["Tala", "f"], ["Andrés", "m"],
  ["Morgan", "x"], ["Robin", "x"], ["Esther", "f"], ["Gabriel", "m"], ["Ilona", "f"], ["Sven", "m"],
  ["Adèle", "f"], ["Moussa", "m"], ["Vera", "f"], ["Hiroshi", "m"], ["Paloma", "f"], ["Ethan", "m"],
  ["Selin", "f"], ["Joaquim", "m"], ["Lina", "f"], ["Axel", "m"], ["Zoé", "f"], ["Nikolai", "m"],
  ["Ayla", "f"], ["Bilal", "m"], ["Clara", "f"], ["Emeka", "m"], ["Sana", "f"], ["Louis", "m"],
  ["Mila", "f"], ["Raphaël", "m"], ["Eden", "x"], ["Noa", "x"], ["Greta", "f"], ["Hamza", "m"],
  ["Iris", "f"], ["Matthias", "m"], ["Luna", "f"], ["Kai", "m"], ["Alma", "f"], ["Youssef", "m"],
].map(([name, gender]) => ({ name, gender: gender as "f" | "m" | "x" }));

export const ORIGINS: I18n[] = [
  t("Marseille, France", "Marseille, France"), t("Lyon, France", "Lyon, France"),
  t("Genève, Suisse", "Geneva, Switzerland"), t("Lausanne, Suisse", "Lausanne, Switzerland"),
  t("Bruxelles, Belgique", "Brussels, Belgium"), t("Montréal, Canada", "Montreal, Canada"),
  t("Dakar, Sénégal", "Dakar, Senegal"), t("Abidjan, Côte d'Ivoire", "Abidjan, Ivory Coast"),
  t("Casablanca, Maroc", "Casablanca, Morocco"), t("Tunis, Tunisie", "Tunis, Tunisia"),
  t("Lisbonne, Portugal", "Lisbon, Portugal"), t("Barcelone, Espagne", "Barcelona, Spain"),
  t("Naples, Italie", "Naples, Italy"), t("Berlin, Allemagne", "Berlin, Germany"),
  t("Cracovie, Pologne", "Kraków, Poland"), t("Stockholm, Suède", "Stockholm, Sweden"),
  t("Dublin, Irlande", "Dublin, Ireland"), t("Manchester, Royaume-Uni", "Manchester, UK"),
  t("New York, États-Unis", "New York, USA"), t("La Nouvelle-Orléans, États-Unis", "New Orleans, USA"),
  t("Mexico, Mexique", "Mexico City, Mexico"), t("Buenos Aires, Argentine", "Buenos Aires, Argentina"),
  t("São Paulo, Brésil", "São Paulo, Brazil"), t("Lagos, Nigeria", "Lagos, Nigeria"),
  t("Accra, Ghana", "Accra, Ghana"), t("Istanbul, Turquie", "Istanbul, Turkey"),
  t("Mumbai, Inde", "Mumbai, India"), t("Osaka, Japon", "Osaka, Japan"),
  t("Séoul, Corée du Sud", "Seoul, South Korea"), t("Melbourne, Australie", "Melbourne, Australia"),
  t("Reykjavik, Islande", "Reykjavik, Iceland"), t("Nouméa, Nouvelle-Calédonie", "Nouméa, New Caledonia"),
];

export const JOBS: I18n[] = [
  t("ambulancier|ambulancière", "paramedic"), t("boulanger|boulangère", "baker"), t("prof de sport", "PE teacher"),
  t("pompier volontaire|pompière volontaire", "volunteer firefighter"), t("guide de montagne", "mountain guide"),
  t("comptable", "accountant"), t("étudiant en médecine|étudiante en médecine", "medical student"), t("chauffeur de taxi|chauffeuse de taxi", "taxi driver"),
  t("influenceur voyage|influenceuse voyage", "travel influencer"), t("ancien militaire|ancienne militaire", "army veteran"),
  t("biologiste marin|biologiste marine", "marine biologist"), t("chef cuisinier|cheffe cuisinière", "head chef"),
  t("développeur de jeux vidéo|développeuse de jeux vidéo", "video game developer"), t("infirmier de nuit|infirmière de nuit", "night nurse"),
  t("pêcheur|pêcheuse", "fisherman"), t("avocat|avocate", "lawyer"), t("DJ", "DJ"), t("charpentier|charpentière", "carpenter"),
  t("vétérinaire|vétérinaire", "veterinarian"), t("maître-nageur|maître-nageuse", "lifeguard"), t("agent immobilier|agente immobilière", "real estate agent"),
  t("artiste de rue", "street artist"), t("ingénieur|ingénieure", "engineer"), t("fermier|fermière", "farmer"),
  t("coach de boxe", "boxing coach"), t("bibliothécaire|bibliothécaire", "librarian"), t("photographe animalier|photographe animalière", "wildlife photographer"),
  t("serveur|serveuse", "waitress"), t("mécanicien|mécanicienne", "mechanic"), t("danseur|danseuse", "dancer"),
  t("youtubeur bricolage|youtubeuse bricolage", "DIY YouTuber"), t("archéologue", "archaeologist"), t("pilote de drone", "drone pilot"),
  t("instituteur|institutrice", "primary school teacher"), t("garde forestier|garde forestière", "park ranger"), t("cascadeur|cascadeuse", "stunt performer"),
  t("psychologue", "psychologist"), t("livreur à vélo|livreuse à vélo", "bike courier"), t("joueur de poker|joueuse de poker", "poker player"),
  t("apiculteur|apicultrice", "beekeeper"),
];

export const CHILDHOOD: I18n[] = [
  t("A grandi dans une famille nombreuse où il fallait se battre pour tout.", "Grew up in a big family where you had to fight for everything."),
  t("Enfant unique, élevé{e} par une grand-mère très stricte.", "An only child, raised by a very strict grandmother."),
  t("A passé son enfance à déménager tous les deux ans.", "Spent childhood moving house every two years."),
  t("A grandi au bord de la mer, entre bateaux et tempêtes.", "Grew up by the sea, among boats and storms."),
  t("Fils ou fille de commerçants, toujours derrière le comptoir.", "Child of shopkeepers, always behind the counter."),
  t("A été placé{e} en famille d'accueil à 8 ans.", "Was placed in foster care at age 8."),
  t("A grandi dans une ferme isolée, sans internet.", "Grew up on a remote farm, with no internet."),
  t("Enfant prodige du piano, a tout arrêté à 15 ans.", "Former child piano prodigy who quit everything at 15."),
  t("A grandi dans une cité où la débrouille était une règle de survie.", "Grew up in a housing estate where getting by was a survival rule."),
  t("Élevé{e} par un père aventurier qui l'emmenait camper partout.", "Raised by an adventurous father who took them camping everywhere."),
  t("A été harcelé{e} à l'école et s'est réfugié{e} dans les livres.", "Was bullied at school and found refuge in books."),
  t("A grandi au milieu d'une fratrie de sportifs de haut niveau.", "The youngest in a family of elite athletes."),
];

export const TURNING_POINT: I18n[] = [
  t("A perdu un frère en mer et ne s'en est jamais remis.", "Lost a brother at sea and never got over it."),
  t("A tout quitté du jour au lendemain pour faire le tour du monde.", "Left everything overnight to travel the world."),
  t("A survécu à un grave accident de voiture.", "Survived a serious car accident."),
  t("A fait faillite après avoir ouvert son propre restaurant.", "Went bankrupt after opening a restaurant."),
  t("A sauvé un inconnu de la noyade et en est sorti{e} héros du quartier.", "Saved a stranger from drowning and became a local hero."),
  t("A été trahi{e} par son meilleur ami lors d'une affaire d'argent.", "Was betrayed by a best friend over money."),
  t("A gagné un concours télé il y a dix ans, puis a été oublié{e}.", "Won a TV contest ten years ago, then was forgotten."),
  t("A élevé seul{e} ses deux petites sœurs après le départ de ses parents.", "Raised two little sisters alone after the parents left."),
  t("A passé six mois seul{e} dans une cabane en Laponie.", "Spent six months alone in a cabin in Lapland."),
  t("A été licencié{e} publiquement après une vidéo devenue virale.", "Was publicly fired after a video went viral."),
  t("A traversé l'Atlantique à la voile en solitaire.", "Sailed solo across the Atlantic."),
  t("A rompu des fiançailles le jour du mariage.", "Called off an engagement on the wedding day."),
];

export const SECRETS: I18n[] = [
  t("Cache une dette de jeu importante.", "Hides a large gambling debt."),
  t("Ne sait pas nager, mais ne l'a jamais avoué.", "Can't swim, but has never admitted it."),
  t("A menti sur son âge pour participer.", "Lied about their age to take part."),
  t("Connaît déjà un autre candidat, et le déteste.", "Already knows another contestant, and hates them."),
  t("Est venu{e} pour retrouver quelqu'un parmi les candidats.", "Came to find someone among the contestants."),
  t("Cache un diplôme de médecine pour ne pas être sollicité{e}.", "Has a medical degree they hide so nobody asks for help."),
  t("Fait des crises de panique la nuit.", "Has panic attacks at night."),
  t("A été recalé{e} trois fois au casting avant d'être pris.", "Was rejected three times at casting before getting in."),
  t("Écrit un livre sur l'émission en secret.", "Is secretly writing a book about the show."),
  t("Est en réalité millionnaire.", "Is actually a millionaire."),
  t("A promis à sa fille de gagner.", "Promised their daughter they would win."),
  t("Voit encore son ex, qui ignore tout de sa participation.", "Still sees an ex who knows nothing about this."),
];

export const MOTIVATIONS: I18n[] = [
  t("Rembourser ses dettes et repartir de zéro.", "Pay off debts and start again."),
  t("Ouvrir un refuge pour animaux.", "Open an animal shelter."),
  t("Prouver à sa famille sa vraie valeur.", "Prove to their family they are worth something."),
  t("Devenir célèbre, tout simplement.", "Become famous, plain and simple."),
  t("Financer l'opération de sa mère.", "Pay for their mother's surgery."),
  t("Se tester et voir jusqu'où aller.", "Test themselves and see how far they can go."),
  t("Venger l'honneur de son quartier.", "Restore the honour of their neighbourhood."),
  t("Rencontrer des gens hors du commun.", "Meet extraordinary people."),
  t("Racheter la maison familiale.", "Buy back the family home."),
  t("Montrer que la gentillesse peut gagner.", "Show that kindness can win."),
  t("Oublier une rupture douloureuse.", "Get over a painful breakup."),
  t("Lancer son entreprise grâce à la notoriété.", "Use the fame to launch a business."),
];

export const CATCHPHRASES: I18n[] = [
  t("On ne laisse personne derrière.", "We leave no one behind."),
  t("Chacun pour soi, et moi pour moi.", "Every one for themselves, and me for me."),
  t("Pas de panique, j'ai un plan.", "Don't panic, I've got a plan."),
  t("Si ça ne me tue pas, ça me rend célèbre.", "What doesn't kill me makes me famous."),
  t("Je souris, mais je note tout.", "I smile, but I remember everything."),
  t("Doucement, mais sûrement.", "Slow and steady."),
  t("Qui a faim ? Moi, toujours.", "Who's hungry? Me, always."),
  t("La confiance, ça se mérite.", "Trust is earned."),
  t("On verra bien.", "We'll see."),
  t("Je suis là pour gagner, pas pour me faire des amis.", "I'm here to win, not to make friends."),
  t("Respire. Observe. Agis.", "Breathe. Watch. Act."),
  t("Tout le monde a un prix.", "Everyone has a price."),
  t("Moi, j'y crois.", "I believe it."),
  t("C'est pas la taille qui compte, c'est la ruse.", "It's not size that counts, it's cunning."),
  t("Un pas après l'autre.", "One step at a time."),
  t("Ça va bien se passer.", "It's going to be fine."),
];

export const PHOBIAS: Phobia[] = ["insects", "heights", "water", "darkness", "solitude"];

export const PHOBIA_LABEL: Record<Phobia, I18n> = {
  insects: t("les insectes", "insects"),
  heights: t("le vide", "heights"),
  water: t("l'eau profonde", "deep water"),
  darkness: t("le noir", "the dark"),
  solitude: t("la solitude", "being alone"),
};
