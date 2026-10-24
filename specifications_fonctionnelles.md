# Aldus — Atelier du Livre Moderne

> **Spécifications fonctionnelles** — document de référence du produit.
> Univers : atelier humaniste de la Renaissance vénitienne (Venise, c. 1500).

---

## 1. Identité & vision

**Nom officiel** : *Aldus — Atelier du Livre Moderne*.

Hommage à **Alde Manuce** (Aldus Manutius, Venise, 1500), imprimeur humaniste
inventeur du format *enchiridion* et des caractères italiques. L'application
simule un **grand registre d'ébène, d'or et de reliure d'art** : l'utilisateur
n'ouvre pas un logiciel, il **ouvre le registre de l'atelier**.

L'app abandonne toute référence au studio moderne (palette néon, cyan,
terminal rétro-futuriste, monospace d'interface).

**Proposition fonctionnelle** : transformer des chapitres (Markdown / texte /
Word) et des illustrations en un livre prêt à publier (Amazon KDP broché et
ebook), avec quatre formes proposées au pupitre de presse : **PDF prêt-à-imprimer**
(libellé « PDF Imprimeur (Haute Définition) »), **EPUB (Standard)**, **jaquette KDP PDF** et
**DOCX révisé**. Les moteurs effectivement reliés sont Rust/Typst pour les PDF,
`epub-builder` pour l'EPUB et `docx-rs` pour le DOCX ; voir les limites de conformité
dans `specifications_techniques.md`.
L'édition audio est un dérivé d'écoute, distinct de ces quatre formes de
publication imprimée/ebook et généré par un moteur vocal local facultatif.

### 1.1 Règle d'architecture fondamentale (non négociable)

Les réglages de l'application (format de coupe, corps de texte, polices,
dossiers, métadonnées…) décrivent **uniquement le manuscrit EXPORTÉ** et les
métadonnées du projet. **Ils ne modifient jamais l'interface graphique** de
l'atelier : le registre et sa charte restent figés. Exception de composition :
la Bibliothèque utilise toute la zone de travail à droite de la navigation,
sans diptyque ni reliure centrale.

> Exception typographique : l'**aperçu** d'une police dans la liste de sélection
> (`FontCard` / `FontRadioRow`) applique la police à une balise de démonstration.

---

## 2. Accueil immersif (page de droite du registre)

Au lancement, le registre s'ouvre sur un frontispice double :

| Page | Contenu |
|---|---|
| **Gauche** | Frontispice : médaillon laiton (emblème `aldus-emblem.png`), titre gravé **A L D U S**, doubles filets d'or, sous-titre *Atelier du Livre Moderne*. Aucun libellé parasite. |
| **Droite** | **Creuset de fonderie** autonome : la matrice du « A » orné se remplit d'or en fusion, réchauffée par la lueur diffuse d'un foyer de forge, puis dévoile le bouton **`[ Entrer dans l'atelier › ]`**. |

### 2.1 Comportement attendu du creuset (vue fonctionnelle)

1. **Déclenchement** : 100 % automatique au montage, après une amorce feutrée
   de **500 ms** — aucune action de l'utilisateur requise.
2. **Coulée** : **9,5 s** de remplissage lourd et graduel (4 paliers de
   viscosité), ménisque liquide concave à la crête du métal.
3. **Refroidissement** : l'or se stabilise en or satiné ; l'ambiance passe en
   **mode atelier vivant** (foyer vacillant, braises ascendantes, scintillements
   d'arêtes) — la lettrine **ne se fige jamais**.
4. **Entrée** : le bouton apparaît en fondu sous le creuset. Un **clic pendant
   la coulée** abrège l'animation et bascule instantanément à l'état prêt.
5. **Interdits esthétiques** : aucun titre de roman, aucun nom d'auteur,
   aucun rayon lumineux diagonal ni balayage rectiligne traversant la lettre.

### 2.2 Transition cinématique d'entrée (*Entrer dans l'atelier*)

Aucune rupture visuelle brute : le clic enclenche trois phases enchaînées.

| Phase | Temps | Contenu |
|---|---|---|
| **1. Impulsion & enfoncement** | 0 → 150 ms | Compression du bouton (`active:scale-[0.99]`) + **pulsation thermique finale** du creuset (surge ambrée de 320 ms). |
| **2. Voile d'encre & retrait** | 150 → 550 ms | Fondu sortant (`opacity-0 scale-[0.98]`, 400 ms, retard 150 ms) du **médaillon** (feuillet gauche) et du **creuset** (feuillet droit) — la structure du livre n'est pas déstabilisée. |
| **3. Bascule & révélation** | 550 → 1000 ms | L'onglet **Réglages** devient actif, `isAtelierOpen` est posé ; les deux feuillets se révèlent à l'**encre fraîche** (`inkReveal`, Feuillet II décalé de 90 ms). |

Pendant le sas : la bande d'onglets et le ruban **« Quitter l'atelier »** sont
**strictement absents du DOM** (`{isAtelierOpen && …}`) — le frontispice de
gauche demeure pur et vierge de toute navigation. Après l'entrée, les signets se
révèlent (`animate-ink-reveal`) greffés sur la **tranche extérieure gauche**
(`-translate-x-full`, hors de la surface d'écriture) et l'onglet Réglages
s'affiche avec son décroché `-translate-x-1.5` et sa bordure or.

---

## 3. Navigation du registre

Huit onglets de répertoire, **ordre imposé** :

`Réglages → Informations → Écritoire → Organisation → Correcteur → Couverture → Export → Bibliothèque`

- Onglets latéraux en **cuir patiné et or**, débordant sur la tranche gauche.
- **Ruban permanent « Quitter l'atelier »** sous les onglets (fermeture
  cinématique du livre, disponible depuis tout écran).
- Le passage entre les sept premiers onglets **tourne la page** du volet droit
  (navigation séquentielle, `react-pageflip`). Bibliothèque conserve le ruban
  latéral, mais remplace le diptyque par un espace pleine largeur.

### 3.1 Contenu des onglets

| Onglet | Fonction |
|---|---|
| **Réglages** | Format de coupe KDP, corps de texte, polices, interligne, alignement, lettrines, dossiers de sources, journal d'erreurs, correcteur linguistique (région, mode pointilleux, règles). |
| **Informations** | Métadonnées du roman — **dédoublé sur les deux feuillets** (§4). |
| **Écritoire** | Banc III sur deux feuillets : *Feuillet III* (éditeur Markdown, réglet typographique et création de chapitres) et *Feuillet IV — La Feuille Composée* (prévisualisation live du manuscrit) — voir §4.4. |
| **Organisation** | Registre de composition sur **deux feuillets** : *Feuillet V* (table des matières, rangs romains, réorganisation) et *Feuillet VI* (imposition & calibrage KDP) — voir §4.3. |
| **Correcteur** | Relecture sur **deux feuillets** : *Feuillet IX* (examen typographique aldin) et *Feuillet X* (épreuves annotées par le correcteur linguistique) — voir §4.4. |
| **Couverture** | Banc VI, *Atelier de reliure & marbre de montage* : *Feuillet VII* (épreuve 2D / volume 3D) et *Feuillet VIII* (matière, finitions, métriques, plat IV) — voir §4.4. |
| **Export** | Bancs VII et VIII : lancement Word / PDF / EPUB, aperçu paginé, progression, journal et tirage — Feuillets XI & XII. |
| **Bibliothèque** | Banc IV : rayons principaux et personnalisés, scan/agrégation EPUB, PDF et DOCX, Registre du Livre, choix du format, écoute d'une édition audio et suppression confirmée des exports associés. Le **Studio Audio (Banc V)** est une section du Registre, pas un onglet supplémentaire. |

---

## 4. Formulaire « Informations » dédoublé (onglet actif `infos`)

Répartition des champs sur les **deux pages** du registre : confort de saisie et
lecture continue, comme un formulaire d'imprimerie.

### 4.1 Feuillet I — page de gauche : *L'Œuvre & les Créateurs*

En-tête : **I. Identité de l'Œuvre** (petites capitales dorées).

| Section | Champs |
|---|---|
| **Titres & Saga** | Titre du livre (*champ mis en vedette*), Sous-titre, Nom de la série / Saga *(2 colonnes)*, Numéro de tome *(1 colonne)* |
| **Paternité** | Auteur principal, Traducteur / Illustrateur *(2 colonnes)* |

### 4.2 Feuillet II — page de droite : *Édition & Achevé d'Imprimer*

En-tête : **II. Édition & Mentions Légales**.

| Section | Champs |
|---|---|
| **Mentions Légales** | Nom de l'éditeur, Numéro ISBN (`978-2-…`), Date / Année de parution, Lieu d'impression *(2 colonnes)* |
| **Apparat & Bibliographie** | Autres œuvres / bibliographie — zone multiligne aérée (**5 lignes**) |

Chaque champ est validé au `blur` et **sauvegardé automatiquement** dans le
fichier de projet (journalisation de l'opération).

### 4.3 Feuillets V & VI — onglet Organisation

| Page | Feuillet | Contenu |
|---|---|---|
| **Gauche** | **V. Table des Matières & Feuillets** | Registre de composition : chaque ligne porte son **rang en chiffres romains**, une **ligne de pointillés traditionnelle** et une **poignée de réorganisation en fer forgé** (`#5a4f3f` → `#d4af37` au survol). Le glisser-déposer réordonne la structure (multi-pages), et les commandes d'ajout (Acte, Chapitre, Image, Page spéciale), de renommage, de rôle et d'import de sources restent disponibles. |
| **Droite** | **VI. Imposition & Calibrage KDP** | Pagination mesurée par Typst ou estimation au mot, **répartition en cahiers** (16 / 20 / 24 pages), **calculateur d'épaisseur de dos** (`Pages × Coeff. papier` : 0,0572 mm blanc · 0,0635 mm crème · 0,0596 mm couleur), **schéma proportionnel** et **zones de sécurité de 1,6 mm (≈ 0,0625 po)**. Les alertes de belle page restent fondées sur un placement estimé des chapitres. |

La pagination est affichée sous la forme « 184 pages (mesurées) » après
composition Typst de l'aperçu ou du PDF exporté, avec un témoin vert discret,
ou « ~190 pages (estimées) » avant composition : total de mots des sources
divisé par 250, arrondi au pair supérieur. Un manuscrit vide estime zéro page ;
les limites d'éligibilité KDP sont signalées sans falsifier la mesure.
La mesure est mémorisée dans le projet et cesse d'être utilisée lorsque les
sources ou les paramètres de composition changent. Le dos et les vues de
couverture utilisent cette pagination en priorité ; un PDF impair nécessite
une page blanche de parité pour le bloc relié, explicitement affichée.
Les cahiers utilisent le total mesuré ; le placement individuel des chapitres
reste une approximation (répartition uniforme après les liminaires), jamais
une attestation des belles pages du PDF réel.

Les contrôles des lignes restent dans leur carte, avec retour à la ligne si
nécessaire, sélecteur de source fluide et boutons-icônes de parcours/import
munis d'infobulles. Le titre respecte la largeur intérieure. Les dédicaces et
épigraphes sans titrage n'affichent que le rang, sans tirets vides ; la poignée
de glisser-déposer reste disponible.

Le dossier « Mes sources » est exploré récursivement : textes `.md`, `.txt`,
`.docx` et images `.png`, `.jpg`, `.jpeg`, `.webp`, `.tiff` sont découverts dans
les sous-dossiers. Les fichiers/dossiers commençant par un point (dont `.git`,
`.obsidian`, `.trash`, `.aldus`), `node_modules`, `target` et `dist` sont ignorés ;
les liens symboliques ne sont pas suivis. Les listes présentent les chemins
relatifs et un tri alphabétique naturel pour distinguer les homonymes.
La Couverture propose les images compatibles du projet pour le plat 1 et le
logo du plat 4 ; le sélecteur système reste disponible.

### 4.4 Feuillets III à X — Écritoire, Couverture & Correcteur

| Onglet | Feuillet (gauche) | Feuillet (droite) |
|---|---|---|
| **Écritoire** | **III. L’Écritoire** — sélectionner un chapitre source ou en créer un `.md` sans écraser l’existant ; éditer en ébène avec sauvegarde automatique. Le réglet insère guillemets français, cadratins, espaces insécables, apostrophes courbes et ligatures `œ/Œ`. | **IV. La Feuille Composée** — rendu Markdown live avec corps justifié, marges éditoriales et lettrine selon les réglages du manuscrit. Le Manuel du Scribe documente titres, dialogues, exergues, notes de bas de page et séparateurs de scène. |
| **Couverture** | **VII. Le Marbre de Montage** — ardoise veinée, bascule d'épreuve `[ Planche Dépliée 2D ]` / `[ Volume Relié 3D ]` (repères de coupe, fond perdu, réserve code-barres, ombre de reliure), bannière de dérive et dialogue de conformité pré-export. | **VIII. Calibrage de la Reliure** — pagination déclarée, papier, pelliculage, visuels des plats + inspection DPI, texte de tranche et dégradé, métriques temps réel et contrôle du plat IV / code-barres. |
| **Correcteur** | **IX. Examen Typographique Aldin** — vérifications automatiques et annotations en marge : **rouge carmin** (fautes critiques) / **bistre** (conseils de style). | **X. Épreuves & Annotations Marginales** — éditeur décoré in-situ par le correcteur linguistique, suggestions, localisation, journal de session et application de l’Usage Aldin. |

Sur le **Banc X**, le bouton `[ Valider les corrections ]` écrit le texte partagé
du chapitre dans son fichier Markdown. Toute correction non validée active un
état *dirty*; `[ Recharger ]` et le changement de chapitre demandent confirmation
avant d'abandonner les modifications. Après validation, l'analyse est recalculée
sur le texte enregistré et les anomalies corrigées disparaissent des conseils.

Avant toute modification sauvegardée d'un chapitre Markdown, l'Écritoire et
le Banc X conservent le texte précédent sous `<workspace>/.aldus/history/`.
Les 15 versions les plus récentes de chaque chapitre sont conservées, y compris
pour les sources imbriquées ou homonymes. Une sauvegarde identique n'écrit rien.
« Historique des versions » présente les dates ; une confirmation est exigée
avant remplacement du texte actuel et des corrections non validées. La
restauration sauvegarde d'abord le texte enregistré précédent, puis recharge
le Correcteur et l'Écritoire si le même chapitre y est ouvert. Si la création
de l'instantané échoue, le manuscrit n'est pas remplacé.

### 4.5 Bibliothèque — Banc IV et Studio Audio — Banc V

L'onglet **Bibliothèque**, placé après Export, occupe la zone de travail entière
à droite des signets; il ne tourne pas dans le flipbook et n'affiche ni page
gauche ni reliure centrale. Les rayons principaux (*En cours*, *Terminés*) et
les rayons personnalisés contiennent une tranche par ouvrage. Un scan du dossier
d'export regroupe les fichiers EPUB, PDF et DOCX d'un même nom de base dans une
fiche unique; les badges de tranche ouvrent le Registre sur le format choisi.

Le Registre permet de consulter les métadonnées par format, d'ouvrir le fichier,
et de retirer l'ouvrage. La suppression exige une confirmation, efface les
exports et couvertures associés dans le dossier de fabrication configuré, mais
préserve les sources Markdown et les fichiers référencés par un autre ouvrage.

Le **Studio Audio (Banc V)** est intégré au Registre du Livre. L'auteur choisit
une voix française disponible localement, puis sélectionne obligatoirement un
chapitre dans la liste extraite de l'ouvrage avant de lancer la génération.
Chaque opération synthétise uniquement ce chapitre; aucune synthèse globale
n'est proposée. Le Registre affiche pour le chapitre sélectionné son nombre de
pages estimé, son nombre de mots et sa durée audio estimée à 135 mots/minute;
ces métadonnées changent avec la sélection. Une corbeille au bout de chaque
lecteur supprime le MP3 correspondant sur disque et retire sa référence du
store local, après confirmation. Les EPUB et
DOCX fournissent leurs titres et chapitres; un PDF textuel constitue un seul
segment. Les éléments structurels (couverture, titre, sommaire, mentions
légales) et les parasites évidents sont écartés.

Dans le MSI Windows 1.4.7, Aldus démarre automatiquement les sidecars XTTS v2 et
FFmpeg; aucun Python, FFmpeg ni réglage du `PATH` système n'est requis. Au
premier démarrage, l'assistant présente la CPML et exige une acceptation
explicite avant de télécharger les poids du modèle. Dès le clic d'acceptation,
la modale se ferme; le consentement est écrit atomiquement dans
`%LOCALAPPDATA%\\net.danoe.aldus\\config.json` avant le démarrage du moteur. Le
pupitre supérieur centralise la progression d'initialisation Python, PyTorch
et XTTS, puis la progression de génération. Les poids et caches résident aussi
dans `%LOCALAPPDATA%\\net.danoe.aldus\\`. En mode
développement ou avec un moteur tiers, l'assistant conserve la vérification d'un
wrapper compatible déjà lancé sur localhost et les instructions de préparation
du wrapper de référence.

Les modèles ne sont pas inclus dans le MSI : une connexion est nécessaire au
premier téléchargement après consentement CPML. Les utilisations suivantes
fonctionnent hors ligne tant que les modèles sont conservés dans LocalAppData.
Le sidecar doit répondre sous 60 secondes ; une fois son statut disponible,
le premier téléchargement/chargement peut durer jusqu'à 15 minutes, avec
progression visible et remontée immédiate des erreurs. Les voix sont indexées
dès que le modèle est chargé, puis le moteur est annoncé prêt.

Les chapitres sont découpés en segments de 240 caractères maximum et synthétisés
séquentiellement. La synthèse et l'assemblage disposent ensemble de 900 s par
chapitre, indépendamment de l'initialisation du moteur. Les fragments temporaires restent sous
`%LOCALAPPDATA%\net.danoe.aldus\temp\audio\` et sont supprimés après assemblage.
Une piste MP3 finale est produite par chapitre dans un sous-dossier `Audio` du
dossier d'export. À chaque réussite, la piste est ajoutée ou remplace uniquement celle
du même index; les autres pistes déjà générées sont conservées. Le format
**AUDIO** apparaît sur la tranche et dans le Registre dès la première piste, où
les chapitres terminés peuvent être écoutés pendant que d'autres restent à
générer. Les pistes et le profil vocal sont associés à `library.json`. Sans moteur TTS local compatible ou sans voix française,
l'interface signale l'indisponibilité et ne marque pas l'ouvrage comme audio.
Les fichiers finaux restent dans le dossier d'export choisi; modèles, caches,
temporaires Python et journaux restent dans LocalAppData, jamais dans
`C:\Program Files\Aldus`.

La plaque de bronze affiche la version du binaire, vérifie une release GitHub
avec un cache de deux heures après une réponse valide. La plaque ouvre toujours
la modale, dont le bouton « Vérifier maintenant » force un nouveau contrôle.
En cas de nouvelle version, elle affiche les notes et propose d'ouvrir la page
officielle de release. Une erreur réseau est affichée dans la modale, sans
renouveler le cache ni effacer une mise à jour déjà connue.
La modale se ferme par son bouton, la touche Échap ou un clic hors du panneau.
Une release disponible déclenche une aura dorée pulsante sur la plaque; les
préférences de mouvement réduit conservent un halo fixe. La plaque dynamique
reste ancrée au bas de la page gauche, sous le macaron Aldus.

---
### 4.6 Réglages — Journal des erreurs pédagogique

Le dossier choisi avec « Parcourir » reçoit `journal_erreurs_aldus.txt`.
Les avertissements et erreurs sont dupliqués en arrière-plan, avec date,
module source, trace brute et explication/action lorsqu'un motif est reconnu :
ressource Python manquante, timeout audio, accès disque refusé ou quota GitHub.
Le mode Diagnostic inclut aussi les opérations INFO. La trace technique
complète reste dans `%LOCALAPPDATA%\net.danoe.aldus\logs\Aldus.log`.

Le dossier et le niveau sont des préférences globales persistées atomiquement.
« Ouvrir le fichier de bord » ouvre le texte dans l'éditeur par défaut ; en
l'absence d'alertes, un en-tête de bienvenue est créé. Sans dossier personnalisé,
le carnet est placé à côté d'Aldus.log. Un dossier externe indisponible ne fait
pas planter Aldus : l'incident est signalé dans le journal technique et les
entrées suivantes retentent l'écriture. Le journal personnalisé et les exports
restent dans les emplacements choisis par l'utilisateur, jamais dans Program Files.

## 5. Évolutions livrées — v1.2.0

### 5.1 Navigation & Sas d'accueil
- L'entrée dans l'atelier (`[ Entrer dans l'atelier › ]`) dirige désormais **par
  défaut vers le menu Réglages** (premier signet de la tranche) —
  `enterAtelier` réassigne `activeMenu = 'reglages'` après le voile d'encre.

### 5.2 Correcteur — Diptyques VII & VIII synchronisés
La bascule d'en-tête `[ VII. Indice de Pureté ] | [ VIII. Le Banc d'Épreuve ]`
est partagée entre les deux pages du livre via `StudioContext` (état
`proofTab`, chapitre, texte, pagination, règles actives).

- **Feuillet VII — Indice de Pureté :**
  - sélecteur de chapitre actif en tête (synchronisé avec le Banc d'Épreuve) ;
  - plancher typographique **≥ 11 px** sur tout le module ;
  - « Les Règles Analysées » en **colonne unique pleine largeur**, paginées sur
    **3 feuillets de 6 règles** (`RULES_PER_PAGE = 6`).
- **Feuillet VIII — Le Banc d'Épreuve :**
  - « Gloses de l'Imprimeur » remplacées par les **« Conseils de l'Imprimeur »** ;
  - bouton `[ ⌖ Localiser ]` : surbrillance d'or animée (`ring` +
    `animate-pulse`) et recentrage automatique (`scrollIntoView`) ;
  - mode `[ ✍ Retouche ]` : vélin éditable + **réglet d'atelier** (gras,
    italique, guillemets français avec insécables, tirets cadratins, espaces
    insécables, notes de bas de page) et consignation (`Ctrl+S` / `Cmd+S`).

### 5.3 Export & Tirage — Feuillets IX & X
- **Dossier de fabrication placé en tête** (section [1]) du Feuillet IX, avant
  la sélection des formes d'édition ;
- nouvelle forme **« Manuscrit Révisé & Typographié (DOCX) »** (4 formes au
  total) ;
- `[ OUVRIR LE DOSSIER DES ÉPREUVES ]` ouvre le dossier cible dans l'explorateur
  natif (commande Rust `open_proofs_directory`) ; sans dossier retenu,
  l'utilisateur est invité à en désigner un ;
- **sceau de presse officiel** (Feuillet X) : frappe solennelle de l'emblème à
  l'achèvement du tirage, puis disparition automatique **en fondu après 30 s**.

### 5.4 Identité & Ex-Libris
- Icône de l'application remplacée par l'**emblème vénitien en bronze**
  (`npx @tauri-apps/cli icon docs/aldus-emblem.png`, jeu d'icônes
  multiplateforme + favicons web) ;
- **Ex-Libris de l'Auteur** (Dragon Danoë) gravé en bas de la tranche gauche,
  ouverture de `https://danoeecrivain.net/` via le navigateur par défaut
  (commande Rust `open_author_website`).

## 6. Instruments du registre

- **Barre de progression** au-dessus du livre : avancement **0–100 %** et libellé
  de l'opération en cours (parité tri-format).
- **Journal des opérations** sous le livre : historique horodaté (`HH:MM`) des
  actions (imports, sauvegardes, exports, erreurs), état de sauvegarde et chemin
  du fichier de projet. **Au repos**, le journal se réduit à une **ligne discrète**
  (statut + dernier message) ; un **volet déroulant** déploie l'historique complet
  en surimpression, sans rogner l'espace du double-feuillet.

---

## 7. Persistance & sécurité (vue utilisateur)

- **Fichier de projet** : `project.danoe` (JSON) — structure, métadonnées,
  réglages, état du module Couverture. Sauvegarde **automatique** dès qu'un
  changement survit à la session.
- **Données locales** (`app_data_dir`) : projet, mots ignorés, lieux,
  options du correcteur — **jamais purgées**.
- **Cache volatil** : purgé à la fermeture.
- **Écriture atomique** : `.tmp` + `rename` → aucune corruption en cas d'arrêt brutal.
- Aucun échec silencieux : toute erreur est remontée à l'utilisateur.
- **Bibliothèque** : rayons et métadonnées persistés dans `library.json`, séparément
  du projet `.danoe`.
- **Studio Audio** : seules les éditions générées avec succès sont publiées dans
  `library.json`; leurs pistes finales restent dans `<dossier-export>/Audio/`,
  tandis que les fragments sont temporaires sous LocalAppData.

---

## 8. Critères d'acceptation (recette fonctionnelle)

1. Le lancement ouvre le frontispice double ; aucun titre/auteur ne s'affiche
   au-dessus du creuset.
2. La coulée démarre seule après 500 ms, dure 9,5 s et **ne se fige pas** : après
   remplissage, le foyer et les braises continuent d'animer la lettrine.
3. Le bouton `[ Entrer dans l'atelier › ]` n'est cliquable qu'une fois la lettre
   comblée ; un clic pendant la coulée bascule immédiatement à l'état prêt.
4. Les huit onglets sont intégralement lisibles, jamais tronqués, et l'ordre
  Réglages → Informations → Écritoire → Organisation → Correcteur → Couverture → Export → Bibliothèque
  est respecté. Bibliothèque conserve le ruban latéral, s'étend sur la zone de
  travail sans diptyque, et les autres onglets conservent le livre double page.
5. L'onglet Informations affiche le **Feuillet I à gauche** et le
   **Feuillet II à droite**, sans double ascenseur de page.
6. La fermeture (ruban ou croix native) déclenche la cinématique de fermeture du
   livre puis la sortie propre de l'application.
7. Export Word / PDF / EPUB : aucune régression (0 erreur TypeScript,
   0 warning Rust, tests de parité verts).
8. Un scan regroupe les variantes EPUB/PDF/DOCX d'un même nom en une seule
  fiche; ses cartouches de tranche sélectionnent le format correspondant dans
  le Registre.
9. Le Studio Audio sur MSI Windows démarre son sidecar intégré après acceptation
  CPML; il génère ciblé par chapitre, segmente à 240 caractères et affiche
  chapitre/segment dans le hub global. Les sources EPUB/DOCX sont nettoyées
  (PDF textuel en section unique); aucun texte n'est envoyé à un serveur distant.
  Le mode développeur accepte toujours un wrapper localhost externe.
10. Après synthèse complète, les pistes MP3 sont persistées et écoutables depuis
   le Registre; un échec ne publie pas de badge AUDIO partiel.

---

## 9. Inventaire fonctionnel des Bancs de l'Atelier

Les bancs sont des parcours éditoriaux; ils ne correspondent pas tous à un
ruban de navigation distinct. L'application expose huit rubans : Réglages,
Informations, Écritoire, Organisation, Correcteur, Couverture, Export et
Bibliothèque. Le Banc V — Studio Audio est une extension du Banc IV —
Bibliothèque, pas un neuvième ruban. Les Feuillets gauche/droite forment un seul
parcours fonctionnel et partagent le contexte du projet.

| Banc | Entrée et interactions | Résultat / contrôles |
|---|---|---|
| **I — Calibrage & Gabarits** | Menu Réglages : choisir le format KDP, les paramètres de composition (corps, police, interligne, alignement, lettrines), les dossiers de sources et options de journal/correcteur. Importer ou gérer les fichiers depuis les panneaux concernés. | Les paramètres décrivent le manuscrit exporté, pas l'interface. Les formats et réglages sont repris par les calculs d'imposition et les exports. |
| **II — Identité & Colophon** | Menu Informations : renseigner titre/sous-titre, saga et tome, auteur et collaborateurs, éditeur, ISBN, date, lieu et bibliographie sur les deux feuillets. Validation au blur et sauvegarde automatique. | Métadonnées persistées dans le projet, réutilisées pour les pages liminaires et le colophon de tirage. |
| **III — L’Écritoire** | Éditer un chapitre Markdown du dossier source, le créer, utiliser le réglet typographique et consulter le Manuel du Scribe. | Sauvegarde automatique du fichier source et aperçu live mis en page avec les réglages du manuscrit. |
| **IV — Bibliothèque** | Après Export, consulter les rayons principaux/personnalisés, scanner le dossier de fabrication, agréger EPUB/PDF/DOCX par nom, inspecter les formats et supprimer un ouvrage après confirmation. | Une fiche et une tranche par titre normalisé; suppression limitée aux exports configurés, sans effacer les sources ou fichiers partagés. |
| **V — Studio Audio** | Depuis le Registre du Livre, choisir une voix française locale, accepter la CPML au premier démarrage du MSI Windows, puis lancer la génération du chapitre sélectionné uniquement. | Sidecars XTTS/FFmpeg intégrés au MSI, hub global chapitre/segment, MP3 chapitrés, badge AUDIO et lecteur intégré; wrapper externe conservé en développement. |
| **Organisation & Imposition** | Menu Organisation : créer/importer actes, chapitres, images et pages spéciales, renommer, régler le rôle, puis réordonner par glisser-déposer. Consulter la table des matières, l'estimation KDP, les cahiers et les ouvertures de chapitres. | Numérotation romaine et alertes de belle page paire ; calculs de pagination et dos avec coefficients de papier. Une illustration non liée peut bloquer l'export. |
| **Correcteur — Qualité Typographique & Épreuve** | Menu Correcteur : sélectionner un chapitre, examiner la jauge de qualité et les anomalies pondérées, activer/désactiver les 18 règles, parcourir les signalements dans le diptyque, localiser une occurrence, puis corriger par suggestion ou dans la retouche Markdown. | Les vues IX (examen/registre) et X (épreuve/conseils) partagent chapitre, texte, page et règles. |
| **VI — Mise en couverture** | Menu Couverture : saisir la pagination, sélectionner papier crème/blanc/couleur, choisir Mat Velouté ou Brillant Éclatant, charger les plats, composer le texte et la couleur/dégradé du dos. Examiner le marbre 2D ou le volume 3D, puis passer la checklist avant export. | Calcul du dos et des dimensions dépliées, inspection DPI, repères de fond perdu/pliure/sécurité/code-barres et détection de dérive de pagination ou de structure. |
| **VII — Inspection Pré-Presse** | Menu Export, Feuillet XI : choisir le dossier de fabrication et cocher une ou plusieurs formes, consulter le bilan d'intégrité KDP et lancer les formes retenues. | Quatre formes proposées : PDF Imprimeur (Haute Définition), EPUB (Standard), couverture PDF 300 DPI et DOCX révisé. |
| **VIII — Tirage sous Presse** | Menu Export, Feuillet XII : contrôler le justificatif d'achevé d'imprimer, actionner la presse, ouvrir le dossier des épreuves ou feuilleter le PDF composé. | Séquence de pressage à trois étapes, sceau temporaire, accès natif au dossier et aperçu paginé. Le tirage n'altère pas le manuscrit source. |

### 9.1 Sous-vues de la vitrine `docs/index.html`

La vitrine statique conserve actuellement son ancien parcours de sept Bancs et
ses ancres `#banc-1` à `#banc-7` ; son réordonnancement pour intégrer le nouveau
Banc III relève d’une mise à jour distincte de `docs/index.html`.

La vitrine associe chaque capture à une légende. Dans cet état historique, les
Bancs IV et V affichent également un sous-titre et une description qui changent
avec la vue; les Bancs VI et VII ont une description fixe. Le changement d'onglet synchronise l'état
actif (`aria-selected`), l'image, sa légende et le texte descriptif avec un fondu.
La visionneuse plein écran ouvre la capture de la vue courante. Les Bancs I, II
et III ont deux vues, le Banc IV quatre vues et le Banc V trois vues. Les Bancs
VI et VII présentent chacun une capture unique, sans onglet de sous-vue.
Les images absentes affichent un placeholder au nom du fichier attendu.

Cette nomenclature et ces captures décrivent la vitrine existante, non le
nouveau parcours applicatif Bibliothèque / Studio Audio (§4.5). Elles seront
actualisées avec les visuels de la Bibliothèque dans une évolution distincte.

Le sommaire flottant relie les sept ancres `#banc-1` à `#banc-7`. Le clic fait
défiler en douceur et l'état actif suit la section visible via
`IntersectionObserver` (Scroll Spy). Le sommaire n'est affiché qu'à partir de
1024 px de largeur.

### 9.2 Portée des formes d'export

Les intitulés détaillés par la vitrine décrivent les objectifs éditoriaux des
formes. Dans le code actuel, le PDF intérieur et la couverture sont compilés par
Typst embarqué, le DOCX par `docx-rs`, et l'EPUB par `epub-builder`. Le dépôt ne
contient pas de pipeline pandoc, de scripts externes d'imposition PDF/X, ni de
validateur de conformité PDF/X. « PDF Imprimeur (Haute Définition) » désigne un
objectif d'impression, sans certification PDF/X, prévol automatisé ni garantie
de rejet zéro chez KDP/IngramSpark. « EPUB (Standard) » désigne le scaffold
EPUB reflowable ; les images intérieures et notes restent à traiter et
EPUBCheck n'est pas intégré. Les infobulles rendent ces limites explicites.

## 10. Renvois

- **Spécifications techniques** : `specifications_techniques.md`
- **Module Couverture** : `SPECIFICATIONS_COVER_STUDIO_v1.2.0.md`
- **Cahier KDP** : `specifications_roman_kdp.md`
- **Documents historiques** (univers « Danoë Studio », conservés pour traçabilité) :
  `archive/specifications_danoe_studio_v0.md`, `archive/specifications_v0_light.md`

## 11. Épreuve de Plume & Usage Aldin (v1.4.9)

- **Épreuve de Plume** : menu dédié à l'audit hors ligne d'un chapitre Markdown. La vue présente un score de risque indicatif, les motifs repérés avec contexte, leurs explications et les suggestions disponibles.
- L'analyse heuristique tient compte de la cadence et de la symétrie des paragraphes, des tics de liaison, triades, listes préformatées et régularités lexicales ; des marqueurs narratifs et typographiques peuvent réduire le score.
- L'auteur peut consulter les règles de détection et d'humanisation, créer et activer/désactiver ses règles, supprimer ses règles personnelles ou rétablir les règles natives. Les règles sont persistées dans la configuration locale de l'application.
- Le score n'établit pas l'origine d'un texte. Aucun détecteur générique de watermarking n'est activé sans procédé et clé connus.
- **v1.4.10 — Pupitre de remaniement** : la page gauche affiche la jauge de risque, deux micro-métriques (Rythme & Souffle, Empreinte syntaxique) et le manuscrit justifié, titres mis en forme, passages signalés surlignés. La page droite liste en continu les cartes d'alerte (ligne, motif, texte original, diagnostic, proposition de la Forge). Cliquer un passage fait défiler sa carte ; survoler une carte éclaire le passage. « Appliquer la reformation » sauvegarde le chapitre dans l'historique, remplace le passage et recalcule le score ; « Ignorer » masque l'alerte pour la session sans modifier le fichier. Aucune règle d'orthotypographie n'y figure.
- **Score réactif (v1.4.10)** : le risque combine 40 % de métriques du texte (cadence, diversité lexicale, bonus d'humanisation) et 60 % de densité pondérée d'alertes par tranche de 250 mots, suivant une courbe progressive sans palier de saturation. « Appliquer » attend le réaudit complet du fichier ; « Ignorer » réduit immédiatement la contribution des alertes au prorata de leur poids, pour la session seulement, sans toucher aux micro-métriques du texte. Les micro-jauges affichent une décimale et animent leur progression (désactivée sous préférence de mouvement réduit).
- **Mode Retouche (v1.4.10)** : la bascule `[ Épreuve | Retouche ]` du feuillet gauche ouvre un éditeur Markdown brut (lignes numérotées, fond ébène). Une carte sans reformation automatique propose « Remanier dans l'éditeur », qui ouvre la Retouche directement sur le passage sélectionné. `[ Enregistrer & réévaluer ]` (ou `Ctrl+S`) consigne le chapitre via l'instantané d'historique et l'écriture atomique puis relance l'audit ; un échec d'écriture conserve le brouillon à l'écran et `[ Annuler ]` l'abandonne. Pendant une retouche, le changement de chapitre et l'application d'une reformation sont suspendus.
- **Pont vers le Correcteur (v1.4.10)** : « Ouvrir dans le Correcteur » bascule le chapitre audité vers le Banc d'Épreuve pour un travail d'écriture long, hors audit stylométrique.
- **Usage Aldin** : depuis le Banc d'Épreuve, l'auteur demande un aperçu du nombre de fichiers Markdown et de substitutions avant de confirmer la normalisation du workspace. La commande traite les fichiers Markdown visibles du workspace configuré, sans suivre les liens symboliques et hors dossiers cachés, `.aldus`, `node_modules`, `target` et `dist`.
- Chaque chapitre modifié est sauvegardé dans l'historique avant écriture atomique. Les instantanés restent disponibles dans l'historique du chapitre et leur restauration conserve la version courante.
- À la première utilisation de v1.4.9, l'état interne migré depuis APPDATA vers `%LOCALAPPDATA%\net.danoe.aldus` est vérifié avant suppression de l'ancienne copie ; en cas de conflit, la copie historique est archivée dans LocalAppData et l'état local existant reste actif.
- Les règles de normalisation incluent apostrophes typographiques, espaces fines insécables, tirets en tête de dialogue et ligatures françaises répertoriées. La limitation lexicale évite de transformer à l'aveugle les mots étrangers ou termes de saga.
- Le traitement global est bloqué si des corrections non consignées sont présentes dans le Banc d'Épreuve ; le chapitre actif est rechargé après l'opération.