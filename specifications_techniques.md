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

### 6.1 Transition d'entrée (états & minutage)

Exposés par `StudioContext` (`isAtelierOpen`, `isTransitioning`, `onEnterAtelier`)
et pilotés par `App.tsx` :

- `ATELIER_TRANSITION_MS = 450` — durée du voile d'encre avant bascule (le fondu
  sortant dure 400 ms, `duration-400`).
- `enterAtelier()` : `isTransitioning = true` → garde `enteringRef` (anti double
  déclenchement) → après 550 ms : `isAtelierOpen = true`,
  `activeMenu = 'reglages'`, `isTransitioning = false`.
- Styles associés : `transition-all duration-400 ease-out delay-150` (retrait du
  sas), `animate-finale-pulse` (impulsion du creuset), `animate-ink-reveal`
  (révélation des feuillets).

- Arborescence : `header` (pupitre supérieur, `TopBar`) / `main` (établi) /
  `footer` (registre inférieur, `StatusBar`) — bandeaux **continus sur toute la
  largeur**, jamais cisaillés par la reliure.
- Établi : `flex-1`, registre `w-full max-w-[1560px] max-h-[860px]`, gouttière
  gauche `pl-40` (les onglets débordent de `-translate-x-full`, soit 9 rem →
  **aucune troncature** à toute largeur).
- Gouttière centrale : **strictement contenue dans le livre**
  (`absolute left-1/2 top-0 bottom-0 w-8`, dégradé `from-black/80 via-black/40
  to-black/80`) — aucun débordement sur les pupitres haut et bas.
- Sous-main : `bg-[#0e0c0a]` + dégradé radial `#1b1613 → #0e0c0a`.
- Pages : gauche `bg-[#181614]`, droite `bg-linear-to-b from-[#1c1a17] to-[#141210]`.
- Onglets : `w-36 px-3 py-2.5 rounded-l-sm border-l-2 border-[#b89355]/60`,
  `font-serif text-[11px] tracking-widest uppercase` + **encre propre à chaque
  cuir** (havane `#ecd8b0`, lapis `#d6e3f0`, sauge `#d0e5d6`, cire `#f2e2be`,
  garance `#eed0d0`, noix de galle `#e0d2e8`) ; état actif
  `-translate-x-1.5 border-l-[#ffd700] text-[#ffd700]
  shadow-[-4px_0_12px_rgba(184,147,85,0.25)]`.

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

## 8. Modules techniques du registre

### 8.1 `src/data/imposition.ts` — miroir frontend du backend

Source de vérité : `src-tauri/src/kdp.rs` (`MIN_PAGES = 24`, `MAX_PAGES = 828`)
et `src-tauri/src/cover/geometry.rs` (coefficients papier `0,05720` blanc ·
`0,06350` crème · `0,05960` couleur ; fond perdu 3,2 mm).

Fonctions pures exportées : `romanNumeral`, `estimateKdpPages`
(`24 + 20 × chapitres`, bornée), `spineThicknessMm` (Pages × coefficient),
`sheetsOf`, `planCahiers` (16/20/24), `placeChapters` (liminaires puis
répartition uniforme ; belle page = page impaire), `misplacedChapters`,
`paginationDrift`. Couvertes par `src/data/__tests__/imposition.test.ts`.

Consommé par `src/components/ImpositionPanel.tsx` (Feuillet IV, page de droite
de l'onglet Organisation) et par `OrganizationView` (rangs romains des lignes).

### 8.2 Pupitre supérieur & journal d'atelier

| Élément | Traitement |
|---|---|
| `TopBar.tsx` (pupitre) | `bg-[#141210] border-b border-[#382f22] text-[#e2dbce]` ; statut `text-[#9e9587]` + accent or `#d4af37` ; réglette `bg-[#1c1814] border-[#2e261b] h-3 rounded-xs` ; curseur `bg-linear-to-r from-[#8f6e2b] via-[#c5a059] to-[#8f6e2b]` ; tirets millimétriques tous les 10 % en filigrane. Au repos (`running === false`) : devise `~ OFFICINA ALDINA · COMPOSITIO LIBRORUM ~` et graduations `opacity-30`. |
| `StatusBar.tsx` (journal) | `bg-[#12100e] border-t border-[#382f22]` ; horodatage `text-[#786c59] font-mono text-[11px]` ; logs `text-[#bda888] font-serif text-xs` ; succès `text-[#c5a059]` ; avertissement `#c8a06a` ; erreur `text-[#a83232]` (aucun vert néon) ; témoin d'enregistrement = **sceau de laiton poli** `bg-[#d4af37] shadow-[0_0_6px_rgba(212,175,55,0.4)]`. **Au repos** : barre d'**une seule ligne** (`h-8`, ~32 px) — statut courant + dernier log tronqué ; **volet déroulant** (`absolute bottom-full z-40`, en surimpression) révélant l'historique complet (`h-40`) sans écraser l'établi. |

### 8.3 Module Couverture (Feuillets V & VI)

- `src/data/coverMetrics.ts` — miroir frontend des métriques de reliure
  (`src-tauri/src/cover/geometry.rs`) : `BLEED_MM = 3.2` (norme KDP 3,175 mm /
  0,125 po), `BARCODE_WIDTH_MM = 50.8`, `BARCODE_HEIGHT_MM = 30.5`,
  `BARCODE_SAFETY_MARGIN_MM = 6.4`; fonctions `coverMetrics`, `trimToMm`,
  `blurbFit` (contrôle d'empiètement de la prière d'insérer sur la zone de
  code-barres).
- `src/components/CoverBindingPanel.tsx` (Feuillet V) : pagination, papier,
  **pelliculage** (`cover.finish`, `CoverFinish = 'mat' | 'glossy'`), visuels des
  plats (`pick_cover_image`) + inspection DPI (`inspect_cover_images`), texte de
  tranche, dégradé, métriques temps réel, `SpineGauge`, **plat IV** (`cover.blurb`).
- `src/components/cover/CoverStudioView.tsx` (Feuillet VI) : marbre
  `bg-[#121316] border-[#2a2c33]`, bascule 2D/3D (`SUB_TABS`), bannière de dérive,
  audit pré-export, export Typst (`export_kdp_cover_pdf`).
- `cover.finish` et `cover.blurb` sont **optionnels** dans `CoverStudioState`
  (compatibilité des fichiers `.danoe` antérieurs) ; `CoverSettingsPanel` a été
  remplacé par `CoverBindingPanel`.

### 8.4 Module Correcteur (Feuillets VII & VIII)

- `src/utils/typographyEngine.ts` — moteur **Usage Aldin** pur et testé
  (`src/utils/__tests__/typographyEngine.test.ts`) : 18 règles du *Code
  typographique* et du *Lexique de l'Imprimerie nationale*, réparties en 5
  familles — ponctuation haute (insécable `U+00A0` avant `:`, fine `U+202F` avant
  `; ! ?`, ellipse `U+2026`), guillemets & dialogues (guillemets français,
  anglais courbes en citation imbriquée, cadratin de réplique `^[-–]\s+`,
  demi-cadratin d'incise), apostrophe courbe `U+2019`, ligatures `œ/æ` (liste
  d'usage : cœur, œuvre, mœurs, manœuvre, ex æquo, curriculum vitæ… + faux amis
  préservés), majuscules accentuées et accents omis, tranches de mille, siècles,
  civilités (`M.`, `chap.`, `n°`, `p.`), hygiène spatiale. Exports :
  `analyzeTypography(text, enabled?)` → anomalies **positionnées**
  (offset/longueur/ligne/gravité/replacement) + indice de pureté,
  `applyAldineUsage` (ordre majeur, substitutions de la fin vers le début),
  `applyAnomaly` (occurrence isolée).
- `src/components/ProofExaminer.tsx` (page gauche du Correcteur) : porte la
  **bascule d'en-tête** `[ VII. Indice de Pureté ] | [ VIII. Le Banc d'Épreuve ]`
  (état `proofTab` partagé avec la page droite) et déploie le Feuillet VII
  (jauge circulaire d'indice de pureté, synthèse mots/anomalies/gravités,
  cartouches d'inventaire par famille, `[ Imposer l'Usage Typographique Aldin › ]`
  et consignation au registre) ou le Feuillet VIII (pupitre de lecture : sélecteur
  de chapitre, `[ Recharger ]`, pagination, filtre « feuillets à anomalies » et
  **grand feuillet vélin** — `proof/ProofReader.tsx`, Garamond 16 px aéré).
- `src/components/ProofWorkbench.tsx` (page droite du Correcteur) : même bascule
  d'en-tête, puis la page droite du diptyque actif — « Les Règles Analysées »
  (grille aérée à deux colonnes des règles activables, coche or/ébène/bistre,
  filtre partagé `proofEnabledRules`) ou « Conseils de l'Imprimeur » (liste
  défilante sombre des signalements du feuillet actif, `[ Corriger ]`,
  explication `[ Règle ]`, bascule `[ Relecture linguistique ]` vers
  `CorrectorView`).
- `src/utils/proofLayout.ts` : gabarit du banc (découpe des feuillets,
  pagination, filtre « feuillets à anomalies », rendu des espaces) partagé entre
  les deux pages du diptyque.
- `src/components/proof/ProofTabToggle.tsx` : commutateur d'en-tête des
  diptyques VII & VIII (modèle du marbre de couverture).
- `onNotify(level, message)` (contexte) alimente le journal inférieur
  (`StatusBar`) depuis n'importe quelle page.

---

## 9. Persistance

- `app_data_dir/project.danoe` (JSON) — **jamais purgé**.
- `app_data_dir/{ignored_words,places,corrector_options}.json`.
- `app_cache_dir/volatile` — purge synchrone à la fermeture.
- Toute écriture passe par `.tmp` + `rename`.

---

## 10. Qualité & politique

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

## 11. Renvois

- **Spécifications fonctionnelles** : `specifications_fonctionnelles.md`
- **Module Couverture** : `SPECIFICATIONS_COVER_STUDIO_v1.2.0.md`
- **Cahier KDP** : `specifications_roman_kdp.md`
- **Historique** : `archive/` (univers « Danoë Studio », v0)