# Mettre The Last en ligne (gratuit)

Ce guide se suit dans l'ordre, sans rien installer : tout se fait dans le navigateur, en 30 à 45 minutes.
À la fin, le site est en ligne à l'adresse **https://macgama.github.io/thelast/**, les amis peuvent créer un compte, voter chaque soir et envoyer un colis, et la saison avance toute seule.

**Coût : 0 €.** Trois services gratuits travaillent ensemble :

| Service | Rôle | Limite gratuite (largement suffisante pour 20 amis) |
| --- | --- | --- |
| GitHub Pages | héberge le site | illimité pour un dépôt public |
| Supabase | comptes, votes, colis, saisons, photos | 500 Mo de base, 50 000 comptes, 1 Go de photos |
| GitHub Actions | fait avancer la saison toutes les 10 minutes | illimité pour un dépôt public |
| Google Gemini | écrit les dialogues et les confessionnaux | quota gratuit d'AI Studio |

> **Règle d'or : une clé secrète ne se colle jamais dans un message, un e-mail ou un fichier.** Elle va uniquement dans les cases « Secrets » de GitHub, comme expliqué à l'étape 4.

---

## Étape 1 : valider le code (1 minute)

1. Ouvrir la pull request de mise en ligne sur GitHub (le lien est dans le fil du projet).
2. Cliquer sur **Merge pull request**, puis **Confirm merge**.

C'est nécessaire parce que GitHub ne lance les tâches automatiques (site et moteur) que depuis la branche principale, `main`.

## Étape 2 : créer la base de données Supabase (10 minutes)

1. Aller sur **https://supabase.com**, cliquer **Start your project**, puis **Continue with GitHub** (même compte que le dépôt).
2. Créer une organisation si on le demande (nom : *The Last*, type : *Personal*, plan : **Free**).
3. Cliquer **New project** :
   - Name : `thelast`
   - Database Password : cliquer **Generate a password**, puis le noter dans un gestionnaire de mots de passe (on n'en aura pas besoin ensuite, mais il ne se récupère pas).
   - Region : **West EU (Paris)** ou la plus proche.
   - Cliquer **Create new project** et attendre 1 à 2 minutes.
4. Dans le menu de gauche, ouvrir **SQL Editor**, puis **New query**.
5. Dans le dépôt GitHub, ouvrir le fichier [`supabase/schema.sql`](../supabase/schema.sql), cliquer sur l'icône **Copy raw file** (deux carrés, en haut à droite du fichier).
6. Revenir dans Supabase, coller dans l'éditeur, cliquer **Run**. Le message attendu est *Success. No rows returned*.
   (On peut relancer ce fichier sans risque : il ne supprime rien.)

### Régler les comptes

7. Menu de gauche : **Authentication**, puis **Sign In / Providers** (ou **Providers**), ligne **Email** :
   - **Confirm email** : **désactivé** (les amis se connectent tout de suite, sans e-mail de confirmation).
   - Enregistrer (**Save**).
8. Toujours dans **Authentication**, ouvrir **URL Configuration** :
   - **Site URL** : `https://macgama.github.io/thelast/`
   - **Redirect URLs** : ajouter `https://macgama.github.io/thelast/compte.html`
   - Enregistrer.

### Récupérer l'adresse et les deux clés

9. Menu de gauche : **Project Settings** (roue dentée), puis **Data API** : copier l'**URL** du projet (elle ressemble à `https://abcdefgh.supabase.co`). Garder l'onglet ouvert.
10. **Project Settings**, puis **API Keys** :
    - la **Publishable key** (commence par `sb_publishable_`) : elle est **publique**, elle sera visible dans le site, c'est normal ;
    - la **Secret key** (commence par `sb_secret_`, cliquer sur l'œil pour la voir) : elle est **secrète**, elle permet tout. Elle ne va que dans GitHub, à l'étape 4.

## Étape 3 : la clé Gemini (2 minutes, facultatif mais conseillé)

Sans Gemini, le direct fonctionne, mais les bulles de dialogue et les confessionnaux sont des textes génériques.

1. Aller sur **https://aistudio.google.com/apikey** avec un compte Google.
2. **Create API key** (ou reprendre celle déjà créée pour le projet), puis la copier.

## Étape 4 : donner les clés à GitHub (5 minutes)

Dans le dépôt **macgama/thelast** sur GitHub : **Settings**, puis **Secrets and variables**, puis **Actions**.

**Onglet « Variables »** (visibles, non secrètes), bouton **New repository variable** :

| Name | Value |
| --- | --- |
| `SUPABASE_URL` | l'URL copiée à l'étape 2.9 |
| `SUPABASE_PUBLISHABLE_KEY` | la clé `sb_publishable_…` |

**Onglet « Secrets »**, bouton **New repository secret** :

| Name | Secret |
| --- | --- |
| `SUPABASE_SECRET_KEY` | la clé `sb_secret_…` |
| `GEMINI_API_KEY` | la clé Gemini (si étape 3 faite) |

Une fois enregistré, GitHub ne réaffiche plus jamais un secret : c'est voulu.

## Étape 5 : allumer le site (2 minutes)

1. Dans le dépôt : **Settings**, puis **Pages**.
2. **Source** : choisir **GitHub Actions**.
3. Aller dans l'onglet **Actions** du dépôt, choisir **Site en ligne** dans la liste de gauche, puis **Run workflow**, **Run workflow**.
4. Attendre la coche verte (1 à 2 minutes). Le site est en ligne sur **https://macgama.github.io/thelast/**.

Le site se remet à jour tout seul à chaque modification de la branche `main`.

## Étape 6 : créer les comptes des concepteurs (2 minutes)

1. Ouvrir **https://macgama.github.io/thelast/survivor.html** et cliquer **Se connecter**, puis **Créer un compte**.
2. **Le tout premier compte créé devient administrateur.** C'est donc Gaël (ou l'autre concepteur) qui doit s'inscrire en premier.
3. Ouvrir **https://macgama.github.io/thelast/admin.html** : c'est le back-office.
4. Le second concepteur crée son compte, puis le premier le passe en **Admin** dans l'onglet **Spectateurs** du back-office.

## Étape 7 : programmer la saison de test (3 minutes)

Dans le back-office, onglet **Saisons** :

1. **＋ Nouvelle saison** : donner un nom, choisir la date et l'heure de début (le jour 1 commence à 8h, heure de l'ordinateur).
2. Laisser les autres réglages par défaut (50 candidats, vote de 16h à 19h, 3 menacés par soir).
3. **Enregistrer**, puis **Programmer**.

Le moteur prépare la saison dans les 48 heures avant le début, puis diffuse chaque heure à son heure pendant 7 jours. Dans **Actions > Direct**, on peut lancer un passage à la main (**Run workflow**) pour vérifier que tout est vert.

Dès son premier passage (dans les 10 minutes qui suivent l'étape 4, ou tout de suite avec **Run workflow**), le moteur recopie dans la base les 100 personnages, les 50 catastrophes et les réglages : ils deviennent modifiables dans le back-office (onglets **Personnages**, **Catastrophes**, **Réglages**). Si ces onglets sont vides, c'est que le moteur n'est pas encore passé. Une saison déjà lancée garde sa distribution et son catalogue de catastrophes.

## Étape 8 : inviter les amis

Envoyer simplement le lien **https://macgama.github.io/thelast/**. Chacun crée son compte (pseudo, e-mail, mot de passe), choisit son candidat, vote chaque soir et envoie un colis par jour. Pendant le test, tout le monde a l'accès complet ; on peut passer quelqu'un en formule « Gratuit » dans le back-office pour voir ce que voit un spectateur sans abonnement.

Le bouton **EN** / **FR** en haut des pages change la langue.

---

## Si quelque chose ne marche pas

| Symptôme | Cause probable | Solution |
| --- | --- | --- |
| Le site affiche la démo au lieu du direct, sans bouton « Se connecter » | variables `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` absentes | refaire l'étape 4 (onglet Variables), puis relancer **Site en ligne** |
| Croix rouge sur **Direct** dans l'onglet Actions | clé secrète mal copiée, ou schéma pas installé | cliquer sur le passage en rouge pour lire le message ; refaire l'étape 2.6 ou 4 |
| Le back-office dit « Moteur : pas encore passé » | normal plus de 48 h avant le début | patienter, ou lancer **Direct > Run workflow** |
| « Mot de passe oublié » n'envoie rien | le service d'e-mails gratuit de Supabase est très limité (quelques e-mails par heure, parfois réservés aux membres du projet) | pour le test, un concepteur peut aider ; pour le lancement public, brancher un service d'e-mails dans **Authentication > Emails > SMTP Settings** |
| Les textes restent génériques | pas de clé Gemini, ou quota du jour épuisé | ajouter `GEMINI_API_KEY` (étape 4) ; le quota se recharge chaque jour |
| Tout recommencer | | back-office, saison, **Recommencer à zéro** (efface la diffusion, les votes et les colis de cette saison) |

Bon à savoir : un projet Supabase gratuit se met en pause après 7 jours sans activité. Pendant une saison, le moteur passe toutes les 10 minutes, donc il reste éveillé. Entre deux saisons, il suffit de cliquer **Restore project** dans Supabase.

Le dépôt est public : n'importe qui peut lire le code et les fiches des personnages (secrets compris). Ce n'est pas gênant pour un test entre amis ; pour le lancement, on rangera les fiches uniquement dans la base.
