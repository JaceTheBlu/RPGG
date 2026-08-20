# RPGG

Un CRM statique pour gérer mon RPG. Objectif à terme : suivi des joueurs, des
personnages, des campagnes, etc. On commence par la brique la plus simple :
un éditeur/publisher de pages Markdown, en ligne, sans backend.

## Comment ça marche

Le site est 100% statique (HTML/CSS/JS vanilla, aucun build) et pensé pour
être hébergé sur **GitHub Pages**. Il n'y a pas de serveur : le dépôt Git
sert lui-même de base de données.

- Les pages publiées sont des fichiers Markdown dans `content/pages/*.md`
  (avec un petit front-matter `title` / `updated`).
- **`index.html`** liste les pages publiées.
- **`editor.html`** est l'éditeur : Markdown à gauche, aperçu en direct à
  droite. "Publier" commite le fichier `.md` dans le dépôt via l'API GitHub
  (`PUT /repos/.../contents/...`), directement depuis le navigateur.
- **`view.html?slug=...`** affiche une page rendue en HTML.

Comme il n'y a aucun backend, la publication a besoin d'un **token GitHub**
(fine-grained, permission "Contents: Read and write" sur ce dépôt) que tu
entres une fois dans les réglages (⚙, dans l'éditeur). Il est stocké
uniquement en `localStorage` sur ton navigateur et n'est envoyé qu'à
`api.github.com`. Adapté à un usage perso/mono-utilisateur — ne partage pas
ce token.

## Mise en route

1. Dans les paramètres du dépôt GitHub : **Settings → Pages → Build and
   deployment → Source : GitHub Actions**. Le workflow
   `.github/workflows/pages.yml` déploie le site à chaque push sur `main`.
2. Ouvre le site publié, va dans l'éditeur, clique sur **⚙ Réglages** et
   renseigne owner / repo / branche (par défaut `jacetheblu` / `rpgg` /
   `main`) ainsi qu'un token GitHub.
3. Écris ta page, donne-lui un titre, clique sur **Publier**.

## Structure

```
index.html            liste des pages
editor.html            éditeur / publisher Markdown
view.html               affichage d'une page
css/style.css           styles
js/app.js                logique (API GitHub, rendu Markdown, slugify…)
js/vendor/marked.min.js  parseur Markdown (vendored, pas de dépendance CDN)
content/pages/*.md       les pages publiées (front-matter + contenu)
.github/workflows/pages.yml  déploiement GitHub Pages
```
