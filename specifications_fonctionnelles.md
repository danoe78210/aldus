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
(libellé de vitrine « PDF/X KDP »), **EPUB** (étiqueté 3.2 dans l'interface), **jaquette KDP PDF** et
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
| **Droite** | **VI. Imposition & Calibrage KDP** | Panneaux techniques : pagination de référence (déclarée vs estimation KDP `24 + 20 × chapitres`), **répartition en cahiers** (16 / 20 / 24 pages, multiples de 4), **calculateur d'épaisseur de dos** (`Pages × Coeff. papier` : 0,0572 mm blanc · 0,0635 mm crème · 0,0596 mm couleur) avec **schéma proportionnel** du dos et **zones de sécurité de 1,6 mm (≈ 0,0625 po)**, et **détection d'anomalies** : tout chapitre ouvrant sur un feuillet **pair** (page de gauche) au lieu d'une **belle page impaire** est signalé avec sa page de départ. |

> Modèle d'estimation : les pages liminaires (`24`) précèdent la répartition
> uniforme de la pagination déclarée sur les chapitres ; le recto KDP (belle
> page) est la page **impaire**. La pagination per-chapitre exacte sera
> disponible lorsque le moteur Rust exposera les comptes de mots au frontend.

### 4.4 Feuillets III à X — Écritoire, Couverture & Correcteur

| Onglet | Feuillet (gauche) | Feuillet (droite) |
|---|---|---|
| **Écritoire** | **III. L’Écritoire** — sélectionner un chapitre source ou en créer un `.md` sans écraser l’existant ; éditer en ébène avec sauvegarde automatique. Le réglet insère guillemets français, cadratins, espaces insécables, apostrophes courbes et ligatures `œ/Œ`. | **IV. La Feuille Composée** — rendu Markdown live avec corps justifié, marges éditoriales et lettrine selon les réglages du manuscrit. Le Manuel du Scribe documente titres, dialogues, exergues, notes de bas de page et séparateurs de scène. |
| **Couverture** | **VII. Le Marbre de Montage** — ardoise veinée, bascule d'épreuve `[ Planche Dépliée 2D ]` / `[ Volume Relié 3D ]` (repères de coupe, fond perdu, réserve code-barres, ombre de reliure), bannière de dérive et dialogue de conformité pré-export. | **VIII. Calibrage de la Reliure** — pagination déclarée, papier, pelliculage, visuels des plats + inspection DPI, texte de tranche et dégradé, métriques temps réel et contrôle du plat IV / code-barres. |
| **Correcteur** | **IX. Examen Typographique Aldin** — vérifications automatiques et annotations en marge : **rouge carmin** (fautes critiques) / **bistre** (conseils de style). | **X. Épreuves & Annotations Marginales** — éditeur décoré in-situ par le correcteur linguistique, suggestions, localisation, journal de session et application de l’Usage Aldin. |

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

Dans le MSI Windows 1.4.3, Aldus démarre automatiquement les sidecars XTTS v2 et
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

Les chapitres sont découpés en segments de 240 caractères maximum et synthétisés
séquentiellement. Les fragments temporaires restent sous
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
au plus une fois par jour et ne signale une mise à jour qu'après une réponse
valide. En cas de nouvelle version, elle ouvre un détail des notes et propose
d'ouvrir la page officielle de release; une erreur réseau reste silencieuse.

---
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

## 5. Instruments du registre

- **Barre de progression** au-dessus du livre : avancement **0–100 %** et libellé
  de l'opération en cours (parité tri-format).
- **Journal des opérations** sous le livre : historique horodaté (`HH:MM`) des
  actions (imports, sauvegardes, exports, erreurs), état de sauvegarde et chemin
  du fichier de projet. **Au repos**, le journal se réduit à une **ligne discrète**
  (statut + dernier message) ; un **volet déroulant** déploie l'historique complet
  en surimpression, sans rogner l'espace du double-feuillet.

---

## 6. Persistance & sécurité (vue utilisateur)

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

## 7. Critères d'acceptation (recette fonctionnelle)

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

## 8. Inventaire fonctionnel des Bancs de l'Atelier

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
| **V — Studio Audio** | Depuis le Registre du Livre, choisir une voix française locale, accepter la CPML au premier démarrage du MSI Windows, puis lancer la génération ciblée ou complète. | Sidecars XTTS/FFmpeg intégrés au MSI, hub global chapitre/segment, MP3 chapitrés, badge AUDIO et lecteur intégré; wrapper externe conservé en développement. |
| **Organisation & Imposition** | Menu Organisation : créer/importer actes, chapitres, images et pages spéciales, renommer, régler le rôle, puis réordonner par glisser-déposer. Consulter la table des matières, l'estimation KDP, les cahiers et les ouvertures de chapitres. | Numérotation romaine et alertes de belle page paire ; calculs de pagination et dos avec coefficients de papier. Une illustration non liée peut bloquer l'export. |
| **Correcteur — Qualité Typographique & Épreuve** | Menu Correcteur : sélectionner un chapitre, examiner la jauge de qualité et les anomalies pondérées, activer/désactiver les 18 règles, parcourir les signalements dans le diptyque, localiser une occurrence, puis corriger par suggestion ou dans la retouche Markdown. | Les vues IX (examen/registre) et X (épreuve/conseils) partagent chapitre, texte, page et règles. |
| **VI — Mise en couverture** | Menu Couverture : saisir la pagination, sélectionner papier crème/blanc/couleur, choisir Mat Velouté ou Brillant Éclatant, charger les plats, composer le texte et la couleur/dégradé du dos. Examiner le marbre 2D ou le volume 3D, puis passer la checklist avant export. | Calcul du dos et des dimensions dépliées, inspection DPI, repères de fond perdu/pliure/sécurité/code-barres et détection de dérive de pagination ou de structure. |
| **VII — Inspection Pré-Presse** | Menu Export, Feuillet XI : choisir le dossier de fabrication et cocher une ou plusieurs formes, consulter le bilan d'intégrité KDP et lancer les formes retenues. | Quatre formes proposées : PDF intérieur prêt-à-imprimer, EPUB 3.2, couverture PDF 300 DPI et DOCX révisé. |
| **VIII — Tirage sous Presse** | Menu Export, Feuillet XII : contrôler le justificatif d'achevé d'imprimer, actionner la presse, ouvrir le dossier des épreuves ou feuilleter le PDF composé. | Séquence de pressage à trois étapes, sceau temporaire, accès natif au dossier et aperçu paginé. Le tirage n'altère pas le manuscrit source. |

### 8.1 Sous-vues de la vitrine `docs/index.html`

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

### 8.2 Portée des formes d'export

Les intitulés détaillés par la vitrine décrivent les objectifs éditoriaux des
formes. Dans le code actuel, le PDF intérieur et la couverture sont compilés par
Typst embarqué, le DOCX par `docx-rs`, et l'EPUB par `epub-builder`. Le dépôt ne
contient pas de pipeline pandoc, de scripts externes d'imposition PDF/X, ni de
validateur de conformité PDF/X : « PDF/X KDP » reste le nom de la forme proposée,
pas une certification technique attestée. De même, « ePub 3.2 » est le libellé
du pupitre; le moteur actuel est un scaffold EPUB et ne déclare pas explicitement
la version 3.2.

## 9. Renvois

- **Spécifications techniques** : `specifications_techniques.md`
- **Module Couverture** : `SPECIFICATIONS_COVER_STUDIO_v1.2.0.md`
- **Cahier KDP** : `specifications_roman_kdp.md`
- **Documents historiques** (univers « Danoë Studio », conservés pour traçabilité) :
  `archive/specifications_danoe_studio_v0.md`, `archive/specifications_v0_light.md`