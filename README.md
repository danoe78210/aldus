# Aldus — Atelier du Livre Moderne

> *Venise, c. 1500.* Un atelier humaniste de composition et de reliure, hommage à
> **Alde Manuce**. L'application simule un **grand registre d'ébène, d'or et de
> reliure d'art** : construction de la structure d'un roman (Actes / Chapitres /
> Images / Pages spéciales), paramétrage typographique **KDP**, atelier de
> couverture, relecture linguistique, et export **Word (`.docx`)** / **PDF** /
> **EPUB** prêts pour Amazon KDP.

## Stack

- **Frontend** : React 19 + TypeScript + Vite, Tailwind CSS v4, Framer Motion, `@dnd-kit`.
- **Backend de bureau** : **Tauri v2** + **Rust** (`src-tauri/`) — moteurs d'export
  (`.docx` via `docx-rs`, **PDF** via Typst embarqué, **EPUB 3** via `epub-builder`).

L'interface fonctionne **dans le navigateur** (SPA, export simulé) **et** en
**application de bureau** (Tauri, export réel). Les utilitaires détectent
`window.__TAURI__` et retombent proprement.

## Prérequis

- **Node.js** ≥ 20 et **npm**.
- **Rust** (stable) + **cargo** — pour compiler le backend de bureau.

## Développement

```bash
npm install            # dépendances frontend (inclut @tauri-apps/cli)

# SPA dans le navigateur (Vite)
npm run dev            # http://localhost:5173  — export simulé

# Application de bureau (Vite + fenêtre Tauri)
npm run tauri dev
```

## Build

```bash
npm run build          # build du frontend dans dist/
npm run tauri build    # installeur / exécutable de bureau (dist + binaire Rust)
```

## Structure

```
aldus/
├─ src/                 # Frontend (voir specifications_fonctionnelles.md)
│  ├─ components/       # Registre, onglets, creuset, modules
│  ├─ components/cover/ # Atelier de couverture (Cover Studio v1.2.0)
│  └─ utils/            # Ponts Tauri, projet (.danoe), sources, correcteur
└─ src-tauri/           # Backend Tauri v2 + Rust
   ├─ Cargo.toml        # tauri, serde/serde_json, docx-rs, typst, epub-builder
   ├─ tauri.conf.json   # productName "Aldus", withGlobalTauri, assetProtocol
   ├─ capabilities/     # permissions de la fenêtre
   ├─ src/kdp.rs        # source unique de vérité KDP
   ├─ src/lib.rs        # handshake natif, commandes, sortie propre
   ├─ src/cover/        # géométrie & génération Typst de la couverture
   ├─ icons/            # icônes d'application (générées par `tauri icon`)
   └─ assets/           # ressources empaquetées — voir assets/README.md
```

## Identité & accueil

- **Page gauche** : frontispice ébène, médaillon laiton, lettrine « A ».
- **Page droite** : **creuset de fonderie** — la matrice du « A » orné se remplit
  d'or en fusion (9,5 s), entretenue par la lueur d'un foyer de forge, puis
  dévoile le bouton `[ Entrer dans l'atelier › ]`.
- **Onglets** : Réglages → Informations → Organisation → Correcteur → Couverture
  → Export, sur cuir patiné et or.

## Statut de l'export

- **Word (`.docx`)** — **fonctionnel** : fichier intérieur KDP (couverture exclue),
  pages liminaires (faux-titre, copyright, page de titre avec saga), table des
  matières native, corps du texte (Markdown étendu : titres, séparateurs de scène,
  citations, listes, images, gras/italique), lettrines, glossaire et notes,
  achevé d'imprimer, en-têtes dynamiques, marges **miroir** KDP et gouttière
  calculée. La commande `generate_docx` ouvre une boîte de dialogue
  d'enregistrement et émet `export-progress` (jauge UI + notification).
- **Ebook (`.epub`)** — **fonctionnel** : page de titre + un XHTML par
  chapitre/page (Markdown → HTML), métadonnées et sommaire (`epub-builder`).
- **PDF** — **fonctionnel** : compilation Typst embarquée (polices incluses,
  aucune dépendance système), aperçu paginé via `pdf.js` + `react-pageflip`.
- Hors application empaquetée (navigateur), l'export reste **simulé**.

## Documentation

- `specifications_fonctionnelles.md` — référence produit (identité, parcours, recette).
- `specifications_techniques.md` — référence d'implémentation (stack, charte, composants).
- `SPECIFICATIONS_COVER_STUDIO_v1.2.0.md` — module Atelier de Couverture.
- `specifications_roman_kdp.md` — cahier des charges fonctionnel KDP.
- `archive/` — documents v0 (univers « Danoë Studio »), conservés pour traçabilité.

## Validation

```bash
npx tsc --noEmit -p tsconfig.app.json
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```