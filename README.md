# The Last

Télé-réalité 100% IA : 50 personnages IA vivent une aventure de 7 jours, suivis en temps réel par les spectateurs.

## Où en est le projet

**Étape 1 : la simulation sans écran.** Le moteur fait vivre une saison complète de 7 jours, heure par heure, et écrit les récits en français et en anglais. Il n'y a pas encore d'application à ouvrir dans le navigateur : on lit les saisons dans le dossier [`exemples/`](exemples/).

- **Démo visuelle** : [`demo/index.html`](demo/index.html), avec l'île en 3D low poly (Three.js, rotation et zoom), les 50 candidats et 5 personnages à suivre avec leurs confessionnaux. Régénérer les données avec `npm run replay`.
- [Exemple de saison en français](exemples/saison-42.fr.md)
- [Example season in English](exemples/saison-42.en.md)

## Comment ça marche

| Élément | Fonctionnement |
| --- | --- |
| Personnages | Un pool de 100 fiches bilingues ([`data/characters.json`](data/characters.json)). 50 sont tirées au hasard à chaque saison. |
| Aventure | « Survie » sur l'Île aux Échos : 9 zones avec eau, nourriture, abris et dangers ([`src/engine/arenas/island.ts`](src/engine/arenas/island.ts)). |
| Temps | 1 tick = 1 heure. Début le jour 1 à 8h, finale le jour 7 à 19h. Le jour 7, trois épreuves (endurance à 10h, orientation à 13h, confiance à 16h) laissent 3 finalistes. |
| Éliminations | Dangers (guêpes, chutes, courants, serpents, fièvre…), soif, faim, épuisement, abandon, affrontements. À l'écran, un candidat éliminé est **évacué par un drone de secours**, jamais montré mort. |
| Showrunner | Surveille le rythme. Si la saison s'endort, il déclenche un rebondissement : essaim de guêpes, tempête, sécheresse, canicule, ravitaillement. |
| Vote du soir (19h) | Les 3 candidats les moins populaires sont menacés. Un vote gratuit par spectateur, même poids pour tous. Le public en sauve 2. |
| Colis des spectateurs | Envoyés avec une monnaie gratuite. Rendement décroissant (100 petits fans pèsent plus qu'un gros donateur), 1 colis maximum par personnage et par jour, livraison incertaine. |
| Récits | Fil heure par heure (abonnés), Quotidienne de 19h (tout le monde), Prime du jour 7. |
| Progression | Le vainqueur gagne des points de courage et de sang-froid, et une couronne visuelle pour les saisons suivantes. |

Tous les réglages (courbe d'élimination, intensité du showrunner, colis, besoins vitaux) sont dans [`config/season.json`](config/season.json). Ils seront éditables dans le back-office plus tard.

L'IA ne décide pas de qui est éliminé : ce sont des règles et des dés pondérés, rejouables avec la même « graine ». L'IA sert seulement à rendre les récits plus vivants.

## Pour les développeurs

```bash
npm install
npm run simulate -- 42      # joue la saison n°42, écrit out/saison-42/
npm run characters          # régénère le pool de 100 personnages
npm test                    # tests automatiques
```

Avec la variable d'environnement `GEMINI_API_KEY`, la Quotidienne et le Prime sont réécrits par Gemini avec un ton de présentateur. Sans clé, le texte de base est utilisé. Ne jamais mettre la clé dans le code.
