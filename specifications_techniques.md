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
| Lecture audio | élément natif HTML `<audio>` (MP3 par chapitre) |
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
| `components/Layout.tsx` | Registre double page et cinématique 3D; l'onglet Bibliothèque utilise une branche pleine largeur sans flipbook |
| `components/LeftPage.tsx` | Frontispice + onglets de cuir + ruban « Quitter l'atelier » |
| `components/RightPage.tsx` | Accueil : hôte du creuset (clic = abréger la coulée) |
| `components/GoldCrucible.tsx` | Creuset de fonderie de la lettrine « A » (§5) |
| `components/InfoView.tsx` | `InfoIdentityPanel` (Feuillet I) / `InfoEditionPanel` (Feuillet II) |
| `components/MenuFlipBook.tsx` / `MenuPage.tsx` | Livre virtuel des onglets, routage des vues |
| `components/StudioContext.tsx` | Contexte applicatif consommé par les pages |
| `components/LibraryView.tsx`, `Bookshelf.tsx`, `BookSpine.tsx` | Bibliothèque pleine largeur, rayons, badges de format et accès au Registre |
| `components/LibraryBookDetail.tsx` | Registre du Livre, sélection de format, lecture audio et Studio Audio |
| `components/AudioSetupDialog.tsx` / `AudioTrackPlayer.tsx` | Assistant XTTS de premier lancement et pupitre HTMLAudioElement par chapitre |
| `components/LibraryDeleteDialog.tsx` | Confirmation de suppression physique des exports associés |
| `components/cover/*`, `CoverPlate.tsx`, `CoverCalibration.tsx` | Cover Studio v1.2.0 (marbre 2D/3D, calibrage, inspection, pré-export) |
| `components/WritingStudio.tsx` | Banc III L’Écritoire : édition Markdown et épreuve de lecture synchronisées |
| `utils/*` | Ponts Tauri, projet (`.danoe`), sources, correcteur, arrêt propre |

`MenuPage` est créé une fois (référence stable) : le contenu reste vivant via le
contexte, sans réinitialiser le flipbook. L'onglet Bibliothèque est rendu dans
`Layout.fullWidthContent`; la page gauche ne conserve que le ruban latéral et le
flipbook est démonté pour ce parcours. Les autres onglets gardent le diptyque.

### 4.2 Backend `src-tauri/src/`

| Module | Rôle |
|---|---|
| `kdp.rs` | Spécifications physiques KDP (source unique de vérité) |
| `project.rs` | Désérialisation du payload projet, estimation paginée |
| `markdown.rs` | AST Markdown, notes, glossaire, frontmatter |
| `export.rs` / `export/*` | Moteur Word (`docx-rs`) |
| `pdf/*` | Moteur PDF Typst (`generator.rs`, `compiler.rs`) |
| `epub.rs` | Moteur EPUB 3 (`epub-builder`) |
| `commands.rs` | Commandes Tauri (exports, `render_pdf`, gestion des fichiers sources Markdown, sortie) |
| `cover/*` | Cover Studio côté natif (géométrie, inspection, couleurs, Typst) |
| `corrector/*` | Client LanguageTool, options, dictionnaires |
| `library.rs` / `library/metadata.rs` | Scan/agrégation EPUB-PDF-DOCX, statistiques et persistance `library.json` |
| `library/audio.rs` | Extraction narrative, lancement lazy du moteur embarqué Windows et orchestration séquentielle des pistes |
| `tauri.sidecar.conf.json` / `scripts/build_windows_audio_sidecars.ps1` | Overlay WiX MSI Windows et préparation des sidecars PyInstaller/FFmpeg en CI |
| `library/deletion.rs` | Suppression bornée au dossier d'export, restauration si persistance en échec |

**Principes transverses** : découpage sans coupe de mot/UTF-8, écritures
atomiques (`.tmp` + `rename`), « tolérance zéro » (toute erreur remontée en
`Result::Err`), chemins résolus via le projet persistant.

### 4.3 Banc V — Studio Audio (extension de la Bibliothèque)

#### Modèle et commandes Tauri

`Book.audio` dans `library.json` est absent tant qu'aucune édition audio n'a été
générée. Une édition persistée contient le moteur local, `voiceId`, `voiceName`,
un horodatage et une liste ordonnée de pistes `{ index, title, path }`. Le
format AUDIO du frontend est dérivé de cette liste; il ne s'agit pas d'un
fichier importé dans `Book.files`.

| Commande | Contrat |
|---|---|
| `list_audio_voices()` | Interroge le moteur local et renvoie uniquement les voix explicitement identifiées en langue `fr*`. |
| `list_book_audio_chapters(book_id)` | Extrait l'ouvrage avec le même moteur que la génération et renvoie la liste ordonnée `{ index, title }` (index 1-based). |
| `generate_book_audio(book_id, export_directory, voice_id, chapter_index)` | `chapter_index: u32` est obligatoire et doit désigner un chapitre existant; chaque appel ne synthétise qu'un chapitre. La fusion remplace le même index et conserve les autres pistes. `Book.audio` est persisté après succès de l'opération demandée. |
| événement `audio-generation-progress` | `{ bookId, chapterIndex, chapterCount, chapterTitle, progress, status, segmentIndex?, segmentCount? }`, émis avant/après chaque segment, à l'assemblage et à la fin ou à l'échec. |

Le Studio impose un chapitre extrait et n'expose aucun mode de synthèse globale;
le bouton reste désactivé tant que l'extraction et la sélection d'un index valide
n'ont pas abouti. La fiche expose des métadonnées `{ wordCount, pageCount,
estimatedDurationSeconds }`, calculées à 250 mots/page et 135 mots/minute. Le
progrès conserve l'index réel dans `chapterIndex` et affiche le titre. La
suppression unitaire valide que le MP3 se trouve sous le dossier `Audio`
configuré, préserve les références partagées, supprime le fichier et met à jour
`library.json` de façon atomique. Le lecteur et le formulaire restent
disponibles ensemble pour écouter ou remplacer une piste.

Chaque chapitre est découpé à **240 caractères maximum**, en privilégiant les
frontières de phrases et de paragraphes. Rust envoie les segments
séquentiellement à `/synthesize`; le wrapper impose lui aussi cette limite et
renvoie HTTP 422 au lieu de laisser XTTS tronquer un texte trop long. Les MP3
temporaires sont assemblés par FFmpeg en une piste unique par chapitre, puis
supprimés. Le client reqwest applique un timeout de connexion de 10 s et un
timeout total de 900 s par segment. Les erreurs incluent le chapitre, le
segment et, si présent, le statut HTTP et le corps de réponse du wrapper.

`tauri-plugin-log` écrit les niveaux Rust dans stdout et dans
`%LOCALAPPDATA%\\net.danoe.aldus\\logs\\Aldus.log`. Les erreurs de connexion
et timeout nomment leur catégorie et l'URL; les HTTP 4xx sont des warnings et
les 5xx des erreurs avec corps brut. Le texte du manuscrit n'est jamais consigné.
Le wrapper journalise le contexte du segment, sa durée et les exceptions avec
traceback. Les erreurs d'inférence génériques retournent HTTP 500; les erreurs
de mémoire CUDA/hôte HTTP 503; les refus de validation restent des 4xx.

#### Traçabilité et erreurs

`tauri-plugin-log` écrit les niveaux Rust dans stdout et dans
`%LOCALAPPDATA%\\net.danoe.aldus\\logs\\Aldus.log`. Un refus de connexion et un
timeout indiquent l'URL et la catégorie; les réponses HTTP 4xx sont des
warnings, les 5xx des erreurs avec statut et corps brut. Le message remonté à
l'IHM distingue un wrapper arrêté d'une erreur d'inférence. Les logs ne
contiennent jamais le texte narratif, uniquement sa longueur et le contexte
livre/chapitre/segment.

Le wrapper FastAPI journalise début, fin, durée et octets de chaque segment.
Une erreur d'inférence ou de conversion MP3 produit un traceback console et
HTTP 500 avec `detail`; CUDA OOM et `MemoryError` sont signalés en HTTP 503.
Les refus de format, de langue ou de voix sont journalisés en warning. Un
segment dépassant 240 caractères est refusé avant l'inférence en HTTP 422.

La commande privilégie les sources dans l'ordre **EPUB → DOCX → PDF**. Pour un
EPUB, elle suit le `spine` OPF, ignore les documents non linéaires, la couverture,
le titre, la navigation/table des matières et les sections identifiées comme
liminaires ou légales; les balises de navigation XHTML/NCX ne sont jamais
narrées. Pour un DOCX, elle regroupe les paragraphes sous les styles de niveau 1
(`Heading 1` / `Titre 1` et styles Word de nom équivalent). En l'absence de tels
styles, le texte lisible devient un chapitre unique. Les PDF utilisent
`lopdf::Document::extract_text`; sans couche texte (PDF scanné), l'extraction
échoue explicitement et nécessite un OCR préalable.

Le nettoyage enlève lignes vides, numéros de page isolés, URL, ISBN et mentions
« Tous droits réservés » / « All rights reserved ». Les pistes finales sont
écrites sous `<export_directory>/Audio/<titre>-<bookId>-<timestamp>/NNN-<chapitre>.mp3`.
Les fragments et le manifeste FFmpeg résident sous
`%LOCALAPPDATA%\net.danoe.aldus\temp\audio\` puis sont supprimés. Un échec
supprime le répertoire de sortie incomplet et laisse l'édition audio
précédemment persistée intacte. La suppression d'un livre supprime également ses
pistes MP3/M4B référencées dans le dossier d'export.

#### Adaptateur TTS local et MSI Windows

Le mode développement et macOS/Linux conservent un wrapper localhost configurable
par `ALDUS_TTS_URL` (défaut `http://127.0.0.1:8020`). Le client refuse tout hôte
autre que `localhost`, `127.0.0.1` ou `::1` en HTTP. Le MSI Windows 1.4.5
embarque un sidecar `aldus-audio-server` gelé par PyInstaller `--onefile`
(Python 3.10.11, PyTorch CPU 2.2.2, Coqui TTS 0.22.0, Transformers 4.41.2) et
un sidecar FFmpeg 8.1.3 statique LGPL. Le texte LGPL accompagne l'application.

`src-tauri/tauri.sidecar.conf.json` est appliqué uniquement par le job release
Windows : `bundle.targets` vaut `msi`, `externalBin` déclare les deux exécutables
et WiX embarque le runtime Visual C++. Le `tauri.conf.json` commun conserve les
cibles macOS/Linux. GitHub Actions installe Python 3.10.11, prépare Torch CPU,
fige le wrapper, télécharge FFmpeg versionné et vérifie son SHA-256 avant le
build Tauri; `tauri-action` attache le MSI aux assets de la release.

Le sidecar est démarré paresseusement au premier `list_audio_voices()` ou
`generate_book_audio()`. L'assistant ferme sa modale dès l'acceptation, puis
attend la persistance avant de démarrer le moteur. Rust conserve l'objet `audio`
(`cpml_accepted`, `cpml_accepted_at`, `engine_mode`) dans
`%LOCALAPPDATA%\\net.danoe.aldus\\config.json`; la mise à jour préserve les
autres clés JSON et écrit `config.json.tmp` avant un renommage atomique vers
`config.json`. Le consentement est relu au lancement suivant, et Rust transmet
`COQUI_TOS_AGREED=1` uniquement si l'accord est enregistré. Le premier
téléchargement des poids requiert une connexion réseau. Rust attend `GET
/health`, relaie stdout/stderr au logger Tauri et arrête l'arbre du processus
Windows à `RunEvent::Exit`. En développement, l'interface garde le parcours du
wrapper externe.

Le wrapper expose la phase d'initialisation par `GET /status` (`status` vaut
`initializing`, `ready` ou `error`, avec `percent`, `stage`, `model_loaded` et
`error`). Dès `status == "error"`, Rust arrête le sidecar et remonte l'erreur
sans attendre le timeout de 60 s. Le build PyInstaller collecte explicitement
les modules, données et binaires de `inflect`, `typeguard` et `gruut`, ainsi
que les métadonnées de distribution Gruut (`--copy-metadata gruut`); il inspecte
ensuite l'archive et échoue si `gruut/VERSION` est absent. Rust publie
`audio:init-progress` avec `percent`, `stage`,
`isReady` et `error`; `App.tsx` écoute cet événement et
alimente l'état de progression partagé par `Layout` et le composant `TopBar`.
Cette barre reste visible quel que soit le panneau ouvert. L'initialisation
signale les étapes Python/PyTorch, chargement du modèle, indexation des voix et
disponibilité, puis revient au repos à la fin ou en cas d'erreur.

TTS (`TTS_HOME`), Hugging Face, Transformers, Torch, Matplotlib, Numba et XDG
sont redirigés vers `%LOCALAPPDATA%\net.danoe.aldus\models|cache|config`.
`TEMP`, `TMP`, `TMPDIR` et l'extraction PyInstaller utilisent le même root.
FFmpeg est résolu par chemin sidecar absolu, sans dépendre du `PATH` système.
Le logger Tauri écrit dans stdout et
`%LOCALAPPDATA%\net.danoe.aldus\logs\Aldus.log`; aucun processus ne doit écrire
dans `C:\Program Files\Aldus`.

- `GET /voices` : tableau de voix ou `{ "voices": [...] }`, chaque entrée
  portant `id`, `name` et éventuellement `language`.
- `POST /synthesize` : JSON `{ "text", "voiceId", "language": "fr",
  "outputFormat": "mp3" }`; réponse : octets MP3 bruts.
- Timeout client : 900 secondes par chapitre. La qualité prosodique, la
  ponctuation et les liaisons françaises relèvent du modèle/wrapper sélectionné.

Le contrat d'intégration et un exemple de requêtes sont détaillés dans
`docs/studio-audio-local-engine.md`.

#### Vérification des releases

Au démarrage, `updater::check_update_status` est lancé dans une tâche Tauri
détachée. `UpdateChecker` sérialise ce contrôle avec la commande frontend
`check_for_updates`; `config.json.system` conserve `last_update_check`,
`latest_known_version`, `update_url`, les notes et l'état de disponibilité. Le
GET `/repos/danoe78210/aldus/releases/latest` porte `User-Agent: Aldus-App`,
utilise des timeouts bornés et est ignoré pendant 24 heures après un contrôle.
Le bloc `system` est fusionné aux autres clés puis persisté par `.tmp` et
`rename`. Les erreurs réseau ne remontent pas à l'UI et sont consignées en
DEBUG. La commande `open_external` n'accepte que les pages HTTPS des releases
du dépôt Aldus et lance le navigateur par défaut (`cmd.exe start` sans fenêtre
sur Windows, `open` sur macOS, `xdg-open` sur Linux). La modale React ferme son
élément `<dialog>` à la demande explicite, sur `cancel` (Échap) et au clic
direct sur le fond, sans propager les clics venant du panneau. `bronzeGlowPulse`
anime en CSS uniquement la plaque quand une mise à jour est disponible; la règle
`prefers-reduced-motion` remplace l'animation par un halo statique.
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

Consommé par `src/components/ImpositionPanel.tsx` (Feuillet VI, page de droite
de l'onglet Organisation) et par `OrganizationView` (rangs romains des lignes).

### 8.2 Pupitre supérieur & journal d'atelier

| Élément | Traitement |
|---|---|
| `TopBar.tsx` (pupitre) | `bg-[#141210] border-b border-[#382f22] text-[#e2dbce]` ; statut `text-[#9e9587]` + accent or `#d4af37` ; réglette `bg-[#1c1814] border-[#2e261b] h-3 rounded-xs` ; curseur `bg-linear-to-r from-[#8f6e2b] via-[#c5a059] to-[#8f6e2b]` ; tirets millimétriques tous les 10 % en filigrane. Au repos (`running === false`) : devise `~ OFFICINA ALDINA · COMPOSITIO LIBRORUM ~` et graduations `opacity-30`. |
| `StatusBar.tsx` (journal) | `bg-[#12100e] border-t border-[#382f22]` ; horodatage `text-[#786c59] font-mono text-[11px]` ; logs `text-[#bda888] font-serif text-xs` ; succès `text-[#c5a059]` ; avertissement `#c8a06a` ; erreur `text-[#a83232]` (aucun vert néon) ; témoin d'enregistrement = **sceau de laiton poli** `bg-[#d4af37] shadow-[0_0_6px_rgba(212,175,55,0.4)]`. **Au repos** : barre d'**une seule ligne** (`h-8`, ~32 px) — statut courant + dernier log tronqué ; **volet déroulant** (`absolute bottom-full z-40`, en surimpression) révélant l'historique complet (`h-40`) sans écraser l'établi. |

### 8.3 Module Couverture (Feuillets VII & VIII)

- `src/data/coverMetrics.ts` — miroir frontend des métriques de reliure
  (`src-tauri/src/cover/geometry.rs`) : `BLEED_MM = 3.2` (norme KDP 3,175 mm /
  0,125 po), `BARCODE_WIDTH_MM = 50.8`, `BARCODE_HEIGHT_MM = 30.5`,
  `BARCODE_SAFETY_MARGIN_MM = 6.4`; fonctions `coverMetrics`, `trimToMm`,
  `blurbFit` (contrôle d'empiètement de la prière d'insérer sur la zone de
  code-barres).
- `src/components/CoverCalibration.tsx` (Feuillet VIII) : pagination, papier,
  **pelliculage** (`cover.finish`, `CoverFinish = 'mat' | 'glossy'`), visuels des
  plats + inspection DPI, métriques temps réel, texte du dos et plat IV
  (`cover.blurb`, contrôle d'empiètement sur la réserve ISBN).
- `src/components/CoverPlate.tsx` (Feuillet VII) : marbre, bascule 2D/3D
  (`SUB_TABS`), repères, bannière de dérive, checklist et dialogue pré-export ;
  génération par `export_kdp_cover_pdf`.
- `cover.finish` et `cover.blurb` sont **optionnels** dans `CoverStudioState`
  (compatibilité des fichiers `.danoe` antérieurs). La finition est un choix de
  projet et n'est pas matérialisée par un profil de pelliculage dans le PDF.

Références géométriques : fond perdu `3,2 mm` (norme KDP nominale `3,175 mm`),
réserve code-barres `50,8 × 30,5 mm` avec marge `6,4 mm`, tranche calculée par
page et coefficient papier. Le repère de préparation des plats `2138 × 3076 px`
à `305,43 DPI` n'est pas une contrainte codée : l'inspecteur mesure la résolution
effective depuis le fichier et le format de coupe sélectionné, avec validation à
partir de `300 DPI`. Le DPI d'une image raster ne peut être relevé par l'export.

### 8.4 Module Correcteur (Feuillets IX & X)

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
  **bascule d'en-tête** `[ IX. Indice de Pureté ] | [ X. Le Banc d'Épreuve ]`
  (état `proofTab` partagé avec la page droite) et déploie le Feuillet IX
  (jauge circulaire d'indice de pureté, synthèse mots/anomalies/gravités,
  cartouches d'inventaire par famille, `[ Imposer l'Usage Typographique Aldin › ]`
  et consignation au registre) ou le Feuillet X (pupitre de lecture : sélecteur
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
  diptyques IX & X (modèle du marbre de couverture).
- `onNotify(level, message)` (contexte) alimente le journal inférieur
  (`StatusBar`) depuis n'importe quelle page.

### 8.5 Banc III — L’Écritoire (Feuillets III & IV)

- `src/components/WritingStudio.tsx` : éditeur Markdown sur la page gauche,
  réglet typographique, sélecteur/création de chapitres et dialogue « Manuel du
  Scribe » ; la page droite rend une épreuve Markdown live avec les réglages de
  corps, de justification et de lettrine du manuscrit.
- `StudioContext` partage `writingChapter`, `writingText` et les états de
  lecture/sauvegarde entre les deux pages. L’écriture différée est sérialisée et
  passe par `save_chapter_file`.
- Commandes natives : `list_source_files` énumère les `.md` du dossier source
  configuré ; `create_chapter_file` crée un fichier sans écrasement et refuse
  les noms contenant un chemin ou une extension différente de `.md`. La lecture
  utilise `read_chapter_file`. `list_chapter_files` et `write_chapter_file`
  restent disponibles comme alias de compatibilité.

### 8.6 Banc X — persistance des corrections

`save_chapter_content(app, chapter_file, content)` résout le nom dans le dossier
Sources configuré (aucun chemin arbitraire fourni par le frontend), écrit le
texte complet dans un temporaire voisin `<fichier>.md.tmp`, puis remplace la
source par `rename`. Les échecs de lecture, d'écriture ou de renommage sont
retournés au frontend et journalisés dans `Aldus.log`; le log de succès est
spécifique aux corrections validées. `proofDirty` reste actif si la commande
échoue; un rechargement ou changement de chapitre non enregistré exige une
confirmation explicite avant lecture d'un autre texte.

## 9. Évolutions v1.2.0 — Commandes, état partagé & styles

### 9.1 Commandes Rust (Tauri v2)

| Commande | Comportement |
|---|---|
| `open_proofs_directory(app, path)` | Crée le dossier s'il n'existe pas (`std::fs::create_dir_all`) puis l'ouvre dans le gestionnaire natif (« explorer » / « open » / « xdg-open »). Destinataire : bouton `[ OUVRIR LE DOSSIER DES ÉPREUVES ]` (Feuillet XII). |
| `open_author_website()` | Lance le navigateur du système vers `https://danoeecrivain.net/` (`rundll32 url.dll,FileProtocolHandler` / « open » / « xdg-open »). Destinataire : **Ex-Libris de l'Auteur** (tranche gauche). |

### 9.2 État partagé — `StudioContext`

Centralisation de l'état des diptyques de l’Écritoire, du Correcteur et de l'Export :
`proofTab`, `proofEnabledRules`, `proofChapter`, `proofText`, `proofPage`,
`proofOnlyAnomalies`, `activeAnomalyId` (commande « Localiser »), `pressDone`
(sceau d'achevé d'imprimer) et `exportDirectory` (dossier de fabrication) —
synchronisation **bidirectionnelle** entre la page gauche et la page droite du
livre (les feuillets de droite lisent le même contexte que la page gauche). Le
texte de l’Écritoire et son état de sauvegarde sont partagés de la même manière.

### 9.3 Styles & performance

- Classes utilitaires intégrées : `.font-cinzel` (Cinzel éditoriale),
  `.proof-scroll-dark` / `.proof-scroll-light` (ascenseurs feutrés sombre et
  clair), `.animate-fade-in` + `.animate-ping` (sceau de presse).
- **Nettoyage des overflow** : chaque page tient en hauteur sans barre de
  défilement blanche parasite (`overflow-hidden` / `overflow-y-auto` stylisé) ;
  colonne unique paginée des règles du Feuillet VII et compactage du Feuillet IX
  pour un rendu responsive fluide.

### 9.4 Redimensionnement, rendu et plein écran

- `src/utils/windowResizeGuard.ts` installe une écoute `resize` idempotente et
  passive. La classe `is-resizing` est posée sur `<body>` pendant les événements,
  puis retirée **150 ms après le dernier** (temporisateur réinitialisé à chaque
  événement). L'écouteur n'effectue aucune mesure DOM ni mise à jour React.
- `src/index.css` gèle transitions et animations sous `body.is-resizing`. Le
  conteneur maître `.atelier-container` reçoit `translateZ(0)`,
  `will-change: transform, width, height` et `backface-visibility: hidden`.
  Les scènes internes utilisent `backface-visibility` sans promotion par
  `transform`, pour ne pas transformer les ancres des modales `position: fixed`.
- `MenuFlipBook` mesure ses dimensions par `ResizeObserver`; le lecteur PDF
  `PreviewFlipbook` coalesce ses mesures dans `requestAnimationFrame` et annule
  l'observation/la frame au démontage. Cela limite les recalculs superflus et
  stabilise l'affichage lors des changements de taille.
- La fenêtre Tauri principale est configurée `fullscreen: true` (1440 × 900,
  redimensionnable). `utils/fullscreen.ts` fournit aussi le basculement natif
  Tauri et un repli via l'API plein écran du navigateur.

### 9.5 Formes proposées et pipeline réel

Le pupitre propose quatre formes (`src/utils/exportEngine.ts`) : PDF intérieur,
EPUB étiqueté 3.2 dans l'interface, couverture PDF 300 DPI et DOCX révisé. Le
routage Rust actuel est :

1. Projet → AST Markdown / enrichissements → générateur Typst et compilateur
   Typst embarqué pour le PDF intérieur.
2. Projet → générateur de couverture Rust/Typst pour le PDF pleine jaquette;
   dimensions de coupe, fond perdu, tranche, images et réserve ISBN sont
   injectés dans le document Typst.
3. Projet → `epub-builder` pour le scaffold EPUB reflowable. Le code ne fixe pas
   explicitement la version 3.2; les commentaires du module signalent que les
   images et notes restent à traiter.
4. Projet → `docx-rs` pour le document DOCX.

Le dépôt ne référence **ni pandoc ni scripts externes d'imposition PDF/X**. Le
choix d'interface « PDF/X KDP », les assertions marketing de PDF/X ou de noir
100 % K ne prouvent pas une validation de norme : aucun profil/output intent,
contrôle PDF/X dédié ou préflight correspondant n'est présent dans le pipeline
audité. Documenter ces étapes comme implémentées serait inexact; elles relèvent
d'un chantier distinct si une certification PDF/X est requise.

---

## 9. Persistance

- `app_data_dir/project.danoe` (JSON) — **jamais purgé**.
- `app_data_dir/library.json` — rayons, livres, fichiers/statistiques par format
  et métadonnées des pistes audio générées.
- `<export_directory>/Audio/` — MP3 chapitrés; seule la commande explicite de
  suppression d'un ouvrage efface ses pistes référencées.
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