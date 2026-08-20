# RPGG

Un CRM statique pour gérer mon RPG. Objectif à terme : suivi des joueurs, des
personnages, des campagnes, etc. On commence par la brique la plus simple :
un éditeur/publisher de pages Markdown, en ligne, sans backend — avec un
login et deux rôles (MJ / joueur).

## Comment ça marche

Le site est 100% statique (HTML/CSS/JS vanilla, aucun build) et pensé pour
être hébergé sur **GitHub Pages**. Il n'y a pas de serveur : le dépôt Git
sert lui-même de base de données, et l'API GitHub sert de backend
d'authentification/autorisation.

- Les pages publiées sont des fichiers Markdown dans `content/pages/public/`
  (visibles par tout le monde) ou `content/pages/gm/` (réservées au MJ),
  chacune avec un petit front-matter `title` / `visibility` / `updated`.
- **`login.html`** : chaque personne entre son propre token GitHub
  personnel. Le token est vérifié auprès de `content/users.json`, qui
  associe un login GitHub à un rôle (`gm` ou `player`).
- **`index.html`** liste les pages (les pages MJ n'apparaissent que pour le
  rôle `gm`).
- **`editor.html`** (accessible seulement au rôle `gm`) : Markdown à gauche,
  aperçu en direct à droite, sélecteur de visibilité, "Publier" commite le
  fichier `.md` via l'API GitHub.
- **`view.html?slug=...&v=public|gm`** affiche une page rendue en HTML.

### Modèle de sécurité — à lire avant d'y mettre des vrais secrets

Il n'y a pas de serveur, donc pas de session côté serveur : la protection
réelle est celle que GitHub applique à son API.

1. **Le dépôt doit être privé** pour qu'un login ait un sens. Sur un dépôt
   public, n'importe qui peut lire `content/pages/gm/*.md` directement via
   `api.github.com`, token ou pas.
2. GitHub Pages continue de servir la coquille du site (HTML/CSS/JS) à
   l'URL publique même si le dépôt est privé — c'est normal et sans risque,
   car cette coquille ne contient aucun contenu sans un token valide.
   (Rendre l'URL de la Page elle-même privée demande GitHub Enterprise
   Cloud + dépôt d'organisation ; pas nécessaire ici.)
3. Le rôle `gm` / `player` et le dossier `public` / `gm` sont un filtrage
   **côté UI**, pas une vraie ACL par fichier — GitHub ne sait pas
   restreindre un collaborateur à certains chemins d'un dépôt. Un joueur
   invité comme collaborateur pourrait techniquement appeler l'API
   GitHub lui-même pour lire un fichier `gm/`. Pour un usage familial/entre
   amis c'est un compromis raisonnable ; ce n'est pas conçu pour résister à
   quelqu'un de malveillant.
4. Chaque token est stocké uniquement en `localStorage`, sur l'appareil de
   la personne, et n'est envoyé qu'à `api.github.com`.

## Mise en route

1. Passe le dépôt en **privé** (Settings → General → Danger Zone →
   Change repository visibility), sinon le login n'apporte aucune
   protection réelle (voir ci-dessus).
2. Dans **Settings → Pages → Build and deployment → Source : GitHub
   Actions**. Le workflow `.github/workflows/pages.yml` déploie le site à
   chaque push sur `main`.
3. Édite `content/users.json` pour ajouter les comptes GitHub de tes
   joueurs, avec leur rôle :
   ```json
   [
     { "username": "JaceTheBlu", "role": "gm", "displayName": "MJ" },
     { "username": "pseudo-joueur", "role": "player", "displayName": "Joueur 1" }
   ]
   ```
4. Chaque personne génère un token GitHub fine-grained scopé à ce dépôt
   (permission "Contents": lecture seule pour un joueur, lecture/écriture
   pour le MJ) et se connecte avec sur `login.html`.

## Structure

```
login.html                connexion (token GitHub -> rôle)
index.html                 liste des pages (filtrée par rôle)
editor.html                 éditeur / publisher Markdown (MJ uniquement)
view.html                    affichage d'une page
css/style.css                styles
js/app.js                     logique (API GitHub, session, rendu Markdown…)
js/vendor/marked.min.js       parseur Markdown (vendored, pas de dépendance CDN)
content/users.json             comptes GitHub autorisés + rôle
content/pages/public/*.md      pages visibles par tous
content/pages/gm/*.md           pages réservées au MJ
.github/workflows/pages.yml    déploiement GitHub Pages
```
