# The Last

Télé-réalité 100% IA : 50 personnages IA vivent une aventure de 7 jours, suivis en temps réel par les spectateurs.

## Où en est le projet

**Étape 1 : la simulation sans écran.** Le moteur fait vivre une saison complète de 7 jours, heure par heure, et écrit les récits en français et en anglais. Il n'y a pas encore d'application à ouvrir dans le navigateur : on lit les saisons dans le dossier [`exemples/`](exemples/).

- **Démo visuelle** : [`demo/index.html`](demo/index.html), avec l'île en 3D low poly (Three.js, rotation et zoom), les 50 candidats et 5 personnages à suivre avec leurs confessionnaux. Régénérer les données avec `npm run replay`.
  - [`demo/world3d.js`](demo/world3d.js) : l'île, les personnages, la météo, les animaux, les drones et la caméra « réalisateur ».
  - [`demo/scenes.js`](demo/scenes.js) : chaque événement devient une scène cartoon de 5 à 20 secondes (accidents, vols, disputes, sabotages, épreuves, vote, évacuations), avec bulles de dialogue et bandeau EN DIRECT. Entre deux scènes, les candidats pêchent, cherchent à manger, dorment et se méfient. Les répliques sont écrites à la main dans `SAY` ; plus tard, une IA les écrira.
  - [`demo/sound.js`](demo/sound.js) : vagues, vent, oiseaux le jour, grillons la nuit, musique qui suit la scène (calme, tension, épreuve) et bruitages cartoon. Tout est généré dans le navigateur, sans fichier audio. Bouton 🔊 en haut pour couper le son.
  - Catastrophes : une cinquantaine, décrites dans [`config/catastrophes.json`](config/catastrophes.json) (zones, heure, fréquence, textes, icône, couleur). On peut en ajouter ou en modifier sans toucher au code ; plus tard, ce fichier sera édité depuis le back-office.
  - Clans : jusqu'à 5 membres, une veillée à 20h où l'on met l'eau et la nourriture en commun, un membre qui s'interpose quand on s'en prend à l'un des siens, un plaidoyer devant le public quand l'un d'eux est menacé, et le collier d'immunité que l'on peut offrir. Les trahisons s'annoncent : méfiance, puis complot à voix basse, puis passage à l'acte.
  - Intrigues suivies : le Réal repère les duos qui s'affrontent (vols, disputes, complots…), annonce « Épisode N » avant chaque nouvel accrochage et repasse sur eux entre deux scènes. L'onglet Direct liste les intrigues en cours.
  - Bouton 🎁 sur la carte : un colis par jour, parachuté sous tes yeux (dans la démo, il ne change pas la simulation).
  - « Ce que tu as raté » : après un saut de 3 heures ou plus, ou quand tu reviens (1 minute d'absence = 1 heure sur l'île), un résumé de ton candidat et de l'île, avec la rediffusion des 3 temps forts.
  - Alertes façon notification, et bouton « Gratuit » pour voir ce qu'a un spectateur sans abonnement (la Quotidienne de 19h et le vote).
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
