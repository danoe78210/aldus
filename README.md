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
- **Banc III — L'Écritoire :** sélection de chapitres Markdown existants ou création de nouveaux
  fichiers `.md` dans le dossier source du projet, avec sauvegarde automatique.
- **Diptyque d'écriture :** éditeur Markdown épuré sur le feuillet gauche et prévisualisation
  typographique instantanée sur le feuillet droit, selon les réglages du manuscrit.
- **Réglet & Manuel du Scribe :** insertion rapide de guillemets français (`« »`), espaces
  insécables, cadratins (`—`), apostrophes courbes (`’`) et ligatures (`œ/Œ`) ; aide intégrée pour
  les titres, dialogues, exergues, notes de bas de page et séparateurs de scène.
- **Correcteur Humaniste :** traitement conforme au *Code typographique* et au *Lexique des règles
  typographiques en usage à l'Imprimerie nationale* (espaces insécables et fines insécables, tirets
  cadratins, apostrophes courbes, ligatures `œ`/`æ`, majuscules accentuées, gloses marginales).
- **Le Pressoir Final :** tirage cérémoniel en trois temps (encrage, serrage, massicotage) et export
  vers les formes d'édition validées — PDF d'impression prêt-à-imprimer (gabarit KDP), ePub 3
  reflowable, gabarit de jaquette.

---

## ✨ Nouveautés de la version 1.3.0 — Banc III : L'Écritoire

- **Studio d'écriture Markdown natif :** création et sélection précise de chapitres `.md`
  directement dans le dossier source du projet, avec sauvegarde automatique.
- **Diptyque de rédaction :** éditeur Markdown épuré aux tons ébène et or de la charte *Dark Atelier*
  sur le feuillet gauche ; prévisualisation typographique en temps réel sur le feuillet droit.
- **Réglet typographique :** insertion au curseur des guillemets français (`« »`), espaces
  insécables, tirets cadratins (`—`), apostrophes courbes (`’`) et ligatures (`œ/Œ`).
- **Manuel du Scribe :** aide intégrée à la syntaxe Markdown romanesque, avec exemples de titres,
  dialogues, exergues, notes de bas de page et séparateurs de scène.

---

## 📥 Téléchargements & Installation (v1.3.0)

Téléchargez Aldus depuis la [Release GitHub v1.3.0](https://github.com/danoe78210/aldus/releases/tag/v1.3.0) :

- **Windows (64 bits) :** [Installateur `.exe`](https://github.com/danoe78210/aldus/releases/download/v1.3.0/Aldus_1.3.0_x64-setup.exe) ou [paquet `.msi`](https://github.com/danoe78210/aldus/releases/download/v1.3.0/Aldus_1.3.0_x64_en-US.msi). La commande prévue est `winget install Danoe.Aldus`, mais le manifeste Winget v1.3.0 n'est pas encore publié ; utilisez les installateurs ci-dessus en attendant.
- **macOS (Intel et Apple Silicon) :** [Image disque universelle `.dmg`](https://github.com/danoe78210/aldus/releases/download/v1.3.0/Aldus_1.3.0_universal.dmg).
- **Linux (amd64) :** [`.AppImage`](https://github.com/danoe78210/aldus/releases/download/v1.3.0/Aldus_1.3.0_amd64.AppImage), [paquet Debian/Ubuntu `.deb`](https://github.com/danoe78210/aldus/releases/download/v1.3.0/Aldus_1.3.0_amd64.deb) ou [paquet Fedora/RHEL `.rpm`](https://github.com/danoe78210/aldus/releases/download/v1.3.0/Aldus-1.3.0-1.x86_64.rpm).

Les empreintes SHA-256 de chaque fichier sont affichées dans la page des Releases.

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