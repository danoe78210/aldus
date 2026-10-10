# Aldus — Spécifications techniques

> Document de référence d'implémentation du dépôt **Aldus**
> (*Atelier du Livre Moderne* — Venise, c. 1500).
> Il décrit **l'état réellement implémenté** du code.

---

## 1. Stack & outils

| Couche | Technologie |
|---|---|
| Shell applicatif | **Tauri v2** (Rust stable ≥ 1.77) |
| Frontend | **React 19** + **TypeScript** (strict, `noUnusedLocals`) |
| Bundler | **Vite** (+ `@vitejs/plugin-react`) |
| Styles | **Tailwind CSS v4** (PostCSS `@tailwindcss/postcss`) |
| Icônes | `lucide-react` · Animations UI : `framer-motion` |
| DnD | `@dnd-kit/core` + `@dnd-kit/sortable` |
| Aperçu PDF | `pdfjs-dist` + `react-pageflip` |
| Rendu Markdown | `react-markdown` |
| Tests | **Vitest** (jsdom) + `cargo test` |

**Règle Tailwind v4** : les dégradés s'écrivent `bg-linear-to-*`
(`bg-gradient-to-*` n'existe pas dans cette version).

### 1.1 Commandes

```bash
npm install
npm run dev                          # SPA Vite (http://localhost:5173)
npm run tauri dev                    # fenêtre de bureau
npm run build                        # tsc -b && vite build
npx tsc --noEmit -p tsconfig.app.json
npx vitest run
cargo check --manifest-path src-tauri/Cargo.toml
cargo test  --manifest-path src-tauri/Cargo.toml
```

---

## 2. Identifiants & configuration (rebranding)

| Fichier | Clé | Valeur |
|---|---|---|
| `package.json` | `name` | `aldus` |
| `package.json` | `productName` | `Aldus` |
| `package.json` | `description` | `Atelier du Livre Moderne — Composition & Reliure Humaniste` |
| `src-tauri/tauri.conf.json` | `productName` | `Aldus` |
| `src-tauri/tauri.conf.json` | `identifier` | `net.danoe.aldus` |
| `src-tauri/tauri.conf.json` | `app.windows[0].title` | `Aldus — Atelier du Livre Moderne` |
| `src-tauri/Cargo.toml` | `[package] name` | `aldus` |
| `src-tauri/Cargo.toml` | `[lib] name` | `aldus_lib` (consommé par `main.rs`) |
| `index.html` | `<title>` | `Aldus — Atelier du Livre Moderne` |

Sécurité Tauri : `withGlobalTauri: true`, `assetProtocol` activé
(scope `**`) pour l'affichage des couvertures locales via `convertFileSrc`.

> **Conservé volontairement** : l'extension du fichier de projet `.danoe`
> (`project.danoe`) — renommage = rupture de compatibilité des projets existants.

---

## 3. Charte graphique « Dark Atelier »

**Élimination complète** de la palette néon / cyan et du monospace d'interface.

| Rôle | Valeur |
|---|---|
| Fond de registre (ébène) | `#181614` |
| Fond de page / feuillet | `#141210` |
| Sous-main de l'atelier | `#12100e` |
| Ébène des champs | `#13110f` |
| Or antique | `#d4af37` |
| Or bruni | `#c5a059` |
| Laiton patiné | `#8f6e2b` |
| Liseré des onglets | `#b89355` (50 %) |
| Ivoire chaud (texte) | `#e2dbce` |
| Sable doux (texte secondaire) | `#a89f91` |
| Ivoire de champ | `#f5efe4` |
| Placeholder | `#5a5040` (italique) |
| Braise (foyer) | `#ff5500` |
| Or incandescent (fusion) | `#ffe57f` → `#ff6600` |
| Or satiné (refroidi) | `#f3e7c4` → `#aa832d` |

**Typographie** : UI en sans-serif humaniste neutre (`Plus Jakarta Sans`),
titres et formulaire en serif éditoriale (`Cormorant Garamond`), replis système.
Fichiers : `src/index.css` (tokens `@theme`), `index.html` (webfonts).

---

## 4. Architecture

### 4.1 Frontend `src/`

| Élément | Rôle |
|---|---|
| `App.tsx` | État global, orchestration des onglets, export, fermeture animée |
| `components/Layout.tsx` | Registre double page, sous-main ébène, cinématique 3D |
| `components/LeftPage.tsx` | Frontispice + onglets de cuir + ruban « Quitter l'atelier » |
| `components/RightPage.tsx` | Accueil : hôte du creuset (clic = abréger la coulée) |
| `components/GoldCrucible.tsx` | Creuset de fonderie de la lettrine « A » (§5) |
| `components/InfoView.tsx` | `InfoIdentityPanel` (Feuillet I) / `InfoEditionPanel` (Feuillet II) |
| `components/MenuFlipBook.tsx` / `MenuPage.tsx` | Livre virtuel des onglets, routage des vues |
| `components/StudioContext.tsx` | Contexte applicatif consommé par les pages |
| `components/cover/*` | Cover Studio v1.2.0 (canvas, 3D, inspection, pré-export) |
| `utils/*` | Ponts Tauri, projet (`.danoe`), sources, correcteur, arrêt propre |

`MenuPage` est créé une fois (référence stable) : le contenu reste vivant via le
contexte, sans réinitialiser le flipbook.

### 4.2 Backend `src-tauri/src/`

| Module | Rôle |
|---|---|
| `kdp.rs` | Spécifications physiques KDP (source unique de vérité) |
| `project.rs` | Désérialisation du payload projet, estimation paginée |
| `markdown.rs` | AST Markdown, notes, glossaire, frontmatter |
| `export.rs` / `export/*` | Moteur Word (`docx-rs`) |
| `pdf/*` | Moteur PDF Typst (`generator.rs`, `compiler.rs`) |
| `epub.rs` | Moteur EPUB 3 (`epub-builder`) |
| `commands.rs` | Commandes Tauri (exports, `render_pdf`, fichiers, sortie) |
| `cover/*` | Cover Studio côté natif (géométrie, inspection, couleurs, Typst) |
| `corrector/*` | Client LanguageTool, options, dictionnaires |

**Principes transverses** : découpage sans coupe de mot/UTF-8, écritures
atomiques (`.tmp` + `rename`), « tolérance zéro » (toute erreur remontée en
`Result::Err`), chemins résolus via le projet persistant.
---

## 5. Composant `GoldCrucible.tsx` (spécification impérative)

### 5.1 Structure

- **Creuset** : cadre carré fonte sombre
  `bg-[#12100e] border border-[#2b241c] rounded-xs shadow-2xl p-8`,
  repères laiton (`#c5a059`/60) aux quatre angles, filet `#8f6e2b`/40 en retrait.
- **Lettrine « A »** : tracé vectoriel Renaissance (fûts évasés, traverse à
  losange, volutes sommitales, patins d'appui), utilisé **à la fois** comme
  silhouette de découpe et comme contour gravé.
- **Masque SVG** : `<clipPath id="renaissance-a-mask">`.
- **Aucun libellé textuel** au-dessus ou sous le creuset (ni titre, ni auteur).

### 5.2 Phase `filling`

- Démarrage **automatique** au montage, `START_DELAY_MS = 500`.
- `POUR_DURATION_MS = 9500` ; cinématique `@keyframes moltenGoldFill`
  (4 paliers : 0–15 % amorçage, 15–50 % montée visqueuse, 50–80 % traverse,
  80–100 % décélération sommitale) — course réelle 220 px, easings par segment.
- Ménisque liquide : onde SVG animée (`@keyframes meniscusWave`) à la crête.
- Gerbes d'étincelles et micro-gouttes projetées pendant la coulée.

### 5.3 Phase `ready` — foyer vivant

- **Interdiction formelle** : aucun rayon lumineux diagonal, aucun balayage
  rectiligne, aucun trait transversal (effet *shimmer* proscrit).
- **Lueur de foyer** : deux oscillations **asynchrones** croisées —
  `fireFlickerA` (**2,1 s**, opacité 0,35→0,70→0,45, `blur(20px→26px→18px)`)
  et `fireFlickerB` (**3,7 s**, opacité 0,30→0,65, `brightness(1→1,2)` +
  `drop-shadow(16px rgba(255,90,0,0.4))`) — teintes `#d4af37` / `#ff5500`,
  placées **derrière** la matrice pour ne pas voiler l'or.
- **Étincelles** : 5 particules (`@keyframes emberDrift`), ascension lente
  (4,8–7,2 s), dérives latérales asymétriques via `--drift-x`.
- **Scintillements** : `@keyframes goldGlint` (0/90/100 % invisibles, 95 %
  visible) sur 3 points saillants — pointe sommitale, nœud de traverse, volute.
- **Or satiné** : fondu `opacity` de 1500 ms vers le dégradé `nobleGold`.

### 5.4 Interaction

`skip` (clic sur la zone du creuset) → `instant = true` + `phase = "ready"` :
l'animation est retirée et la position finale est reprise en style inline
(aucun saut visuel). Le bouton `[ Entrer dans l'atelier › ]` apparaît en
`opacity-0 translate-y-3 → opacity-100 translate-y-0`, `duration-700`,
hover or vif + `shadow-[0_0_24px_rgba(212,175,55,0.25)]`.

### 5.5 Keyframes (dans `src/index.css`)

`moltenGoldFill`, `fireFlickerA`, `fireFlickerB`, `emberDrift`, `goldGlint`,
`meniscusWave`, `sparkBurst`, `sparkStreak`, `heatPulse`, `goldDrop` —
toutes désactivées sous `@media (prefers-reduced-motion: reduce)`.

---

## 6. Layout du registre

- Emprise : `w-[90vw] max-w-[1720px]`, gouttière gauche `pl-28` (les onglets
  débordent de `-left-28`, soit 7 rem → **aucune troncature** à toute largeur).
- Sous-main : `bg-[#12100e]` + dégradé radial `#1b1613 → #12100e`.
- Onglets : `min-w-[7.5rem] px-3 py-2.5 rounded-l-sm border-l-2
  border-[#b89355]/50`, `font-serif text-[11px] tracking-widest uppercase
  text-[#e2d5bd]`, état actif `-translate-x-1.5 text-[#ffd700]
  shadow-[-4px_0_12px_rgba(184,147,85,0.25)]`.
- Palette des onglets : havane `#2c1a0e/#1c1209`, lapis `#121c26/#0b1219`,
  sauge `#122117/#0a140e`, cire `#332408/#1f1604`, garance `#300d0d/#1f0808`,
  noix de galle `#1c1421/#110c14` (tous `bg-linear-to-r`).

---

## 7. Formulaire Informations — styles normalisés

| Élément | Classes |
|---|---|
| Label | `block text-xs font-serif tracking-wider text-[#c9bea9] mb-1.5 uppercase` |
| Input | `w-full bg-[#13110f] border border-[#3a3022] text-[#f5efe4] text-sm rounded-xs px-3 py-2 transition-colors focus:border-[#d4af37] focus:outline-none placeholder:text-[#5a5040] placeholder:italic` |
| Input « vedette » (Titre) | `text-base font-serif text-[#fbf6ea] border-[#3e3425] px-3.5 py-2.5` |
| Input « sous-titre » | `text-sm text-[#e8dcc4]` |
| Textarea (Apparat) | `rows={5} text-sm text-[#e8dcc4] bg-[#13110f] border-[#3e3425] p-3` |
| En-tête de feuillet | `font-serif uppercase tracking-[0.25em] text-[#d4af37]` |

---

## 8. Persistance

- `app_data_dir/project.danoe` (JSON) — **jamais purgé**.
- `app_data_dir/{ignored_words,places,corrector_options}.json`.
- `app_cache_dir/volatile` — purge synchrone à la fermeture.
- Toute écriture passe par `.tmp` + `rename`.

---

## 9. Qualité & politique

```bash
npx tsc --noEmit -p tsconfig.app.json   # 0 erreur (strict + noUnusedLocals)
npm run build                           # build de production
cargo check --manifest-path src-tauri/Cargo.toml
npx vitest run                          # tests front (cover, canvas, 3D)
cargo test  --manifest-path src-tauri/Cargo.toml   # parité tri-format, PDF, cover
```

**Politique** : aucune régression tolérée — 0 erreur TypeScript, 0 warning
Rust, tests verts. Toute animation est purement décorative (jamais porteuse
d'information) et respecte `prefers-reduced-motion`.

---

## 10. Renvois

- **Spécifications fonctionnelles** : `specifications_fonctionnelles.md`
- **Module Couverture** : `SPECIFICATIONS_COVER_STUDIO_v1.2.0.md`
- **Cahier KDP** : `specifications_roman_kdp.md`
- **Historique** : `archive/` (univers « Danoë Studio », v0)