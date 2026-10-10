# ❦ ALDUS : Atelier du Livre Moderne

> *« Festina Lente »* — Hâte-toi lentement.

**Aldus** est un environnement d'artisanat littéraire et d'ingénierie éditoriale conçu pour les
écrivains indépendants et les typographes exigeants. Inspiré par les maîtres imprimeurs de la
Renaissance vénitienne, il unifie la rigueur millimétrique des normes Amazon KDP et l'élégance de
la typographie humaniste.

---

## ✦ Fonctionnalités Majeures

- **Ambiance Dark Atelier :** une interface feutrée d'ébène, d'or et de cuir, conçue pour éliminer
  la fatigue visuelle et honorer la noblesse du texte.
- **Creuset Typographique :** fonderie de caractères en or liquide, symbolisant l'acte premier de
  la composition du livre.
- **Réglette & Calibreur de Dos KDP :** calcul dynamique de l'épaisseur du dos (papier blanc, crème
  ou couleur) et génération du gabarit de couverture complet avec marges de fond perdu (3,2 mm).
- **Correcteur Humaniste :** traitement conforme au *Code typographique* et au *Lexique des règles
  typographiques en usage à l'Imprimerie nationale* (espaces insécables et fines insécables, tirets
  cadratins, apostrophes courbes, ligatures `œ`/`æ`, majuscules accentuées, gloses marginales).
- **Le Pressoir Final :** tirage cérémoniel en trois temps (encrage, serrage, massicotage) et export
  vers les formes d'édition validées — PDF d'impression prêt-à-imprimer (gabarit KDP), ePub 3
  reflowable, gabarit de jaquette.

---

## ✦ Stack Technique

- **Moteur :** [Tauri v2](https://tauri.app/) (Rust) — moteurs Typst (PDF), `docx-rs`, `epub-builder`
- **Interface :** React, TypeScript, Vite
- **Styles :** Tailwind CSS v4
- **Typographie :** glyphes et tracés vectoriels SVG d'artisanat

---

## ✦ Installation & Compilation

### Prérequis
- [Node.js](https://nodejs.org/) (version 20 ou supérieure)
- [Rust & Cargo](https://rustup.rs/) (version 1.75 ou supérieure)

### Démarrage en mode développement

```bash
npm install
npm run tauri dev
```

### Compilation de production locale

```bash
npm run build
npm run tauri build
```

---

## ✦ Documentation

- `specifications_fonctionnelles.md` — référence produit (identité, parcours, recette).
- `specifications_techniques.md` — référence d'implémentation (stack, charte, composants).
- `SPECIFICATIONS_COVER_STUDIO_v1.2.0.md` — atelier de reliure & marbre de montage.
- `specifications_roman_kdp.md` — cahier des charges fonctionnel KDP.
- `archive/` — documents v0, conservés pour traçabilité.

### Contrôles de validation

```bash
npx tsc --noEmit -p tsconfig.app.json
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

---

## ✦ Licence

Ce projet est distribué sous licence MIT. Consultez le fichier `LICENSE` pour plus de détails.