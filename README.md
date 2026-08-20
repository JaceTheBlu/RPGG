# RPGG

Un CRM statique pour gérer mon RPG. Objectif à terme : suivi des joueurs, des
personnages, des campagnes, etc. On commence par la brique la plus simple :
un éditeur/publisher de pages Markdown, en ligne, sans backend — avec un
login et deux rôles (MJ / joueur).

## Comment ça marche

Le site est 100% statique (HTML/CSS/JS vanilla, aucun build) et pensé pour
être hébergé sur **GitHub Pages**, sur un dépôt **public** (le privé coûte
sur ce plan). Il n'y a pas de serveur : le dépôt Git sert lui-même de base
de données.

- Les pages publiées sont des fichiers Markdown dans `content/pages/public/`
  (visibles par tout le monde) ou `content/pages/gm/` (réservées au MJ),
  chacune avec un petit front-matter `title` / `visibility` / `updated`.
- **`login.html`** : identifiant + mot de passe, vérifiés contre
  `content/users.json` (hash SHA-256, généré avec `hash.html`). Selon le
  rôle associé (`gm` ou `player`), l'interface change.
- **`index.html`** liste les pages (les pages MJ n'apparaissent que pour le
  rôle `gm`).
- **`editor.html`** (accessible seulement au rôle `gm`) : Markdown à gauche,
  aperçu en direct à droite, sélecteur de visibilité, "Publier" commite le
  fichier `.md` via l'API GitHub.
- **`view.html?slug=...&v=public|gm`** affiche une page rendue en HTML.
- **`hash.html`** : petit outil local pour générer une entrée
  `content/users.json` (identifiant/mot de passe/rôle → hash) à copier
  toi-même dans le fichier.

### Modèle de sécurité — à lire avant d'y mettre des vrais secrets

Le dépôt est **public**, donc tout fichier `.md` — y compris ceux dans
`content/pages/gm/` — reste consultable directement par quiconque connaît
ou devine l'URL brute GitHub (`raw.githubusercontent.com/...` ou l'API),
mot de passe ou pas. **Le login ne protège rien contre quelqu'un de
déterminé.**

Ce que fait vraiment le mot de passe : c'est un filtre côté interface pour
l'usage normal du site — chaque personne obtient l'écran qui correspond à
son rôle, sans avoir à fouiller dans du JSON. Ne mets rien dans
`content/pages/gm/` que tu ne tolérerais pas qu'un joueur curieux trouve un
jour.

Seul le rôle `gm` peut créer/modifier/supprimer des pages, donc c'est le
seul compte qui a besoin d'un vrai token GitHub personnel (entré à la
connexion, jamais stocké dans le dépôt — seul le hash du mot de passe l'est,
dans `content/users.json`, lui aussi public).

Si un jour tu veux une vraie confidentialité, il faudra soit passer le
dépôt en privé (payant ici), soit chiffrer le contenu sensible côté
client avec une clé que seuls les bonnes personnes connaissent — aucune des
deux n'est en place actuellement.

## Mise en route

1. Dans **Settings → Pages → Build and deployment → Source : GitHub
   Actions**. Le workflow `.github/workflows/pages.yml` déploie le site à
   chaque push sur `main`.
2. Change le mot de passe MJ par défaut (`mj` / `changeme`) : ouvre
   `hash.html`, génère un nouveau hash, et remplace l'entrée dans
   `content/users.json`.
3. Ajoute tes joueurs dans `content/users.json` via `hash.html` (rôle
   `player`, pas besoin de token GitHub pour eux).
4. Le MJ génère un token GitHub fine-grained scopé à ce dépôt (permission
   "Contents: Read and write") et le saisit à chaque connexion sur
   `login.html`.

## Structure

```
login.html                connexion (identifiant/mot de passe -> rôle)
hash.html                   génère une entrée content/users.json
index.html                   liste des pages (filtrée par rôle)
editor.html                   éditeur / publisher Markdown (MJ uniquement)
view.html                      affichage d'une page
css/style.css                  styles
js/app.js                       logique (API GitHub, session, rendu Markdown…)
js/vendor/marked.min.js         parseur Markdown (vendored, pas de dépendance CDN)
content/users.json               comptes (identifiant + hash + rôle)
content/pages/public/*.md        pages visibles par tous
content/pages/gm/*.md             pages réservées au MJ
.github/workflows/pages.yml      déploiement GitHub Pages
```
