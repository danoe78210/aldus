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
ebook), en trois formats : **Word `.docx`**, **PDF** (moteur Typst embarqué),
**EPUB 3**.

### 1.1 Règle d'architecture fondamentale (non négociable)

Les réglages de l'application (format de coupe, corps de texte, polices,
dossiers, métadonnées…) décrivent **uniquement le manuscrit EXPORTÉ** et les
métadonnées du projet. **Ils ne modifient jamais l'interface graphique** de
l'atelier : le registre, sa charte et sa mise en page double-page restent figés.

> Seule exception : l'**aperçu** d'une police dans la liste de sélection
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

---

## 3. Navigation du registre

Six onglets de répertoire, **ordre imposé** :

`Réglages → Informations → Organisation → Correcteur → Couverture → Export`

- Onglets latéraux en **cuir patiné et or**, débordant sur la tranche gauche.
- **Ruban permanent « Quitter l'atelier »** sous les onglets (fermeture
  cinématique du livre, disponible depuis tout écran).
- Le passage d'un onglet à l'autre **tourne la page** du volet droit
  (navigation séquentielle, `react-pageflip`).

### 3.1 Contenu des onglets

| Onglet | Fonction |
|---|---|
| **Réglages** | Format de coupe KDP, corps de texte, polices, interligne, alignement, lettrines, dossiers de sources, journal d'erreurs, correcteur linguistique (région, mode pointilleux, règles). |
| **Informations** | Métadonnées du roman — **dédoublé sur les deux feuillets** (§4). |
| **Organisation** | Structure du livre : Actes / Chapitres / Images / Pages spéciales, glisser-déposer multi-pages, rôles, import de sources. |
| **Correcteur** | Relecture LanguageTool : suggestions, contexte, localiser, ignorer, journal des corrections de la session. |
| **Couverture** | *Cover Studio* : gabarit KDP dos carré, extraction de couleurs, inspection, génération Typst, aperçu 2D/3D. |
| **Export** | Lancement Word / PDF / EPUB, aperçu paginé, progression, journal. |

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
---

## 5. Instruments du registre

- **Barre de progression** au-dessus du livre : avancement **0–100 %** et libellé
  de l'opération en cours (parité tri-format).
- **Journal des opérations** sous le livre : historique horodaté (`HH:MM`) des
  actions (imports, sauvegardes, exports, erreurs), état de sauvegarde et chemin
  du fichier de projet.

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

---

## 7. Critères d'acceptation (recette fonctionnelle)

1. Le lancement ouvre le frontispice double ; aucun titre/auteur ne s'affiche
   au-dessus du creuset.
2. La coulée démarre seule après 500 ms, dure 9,5 s et **ne se fige pas** : après
   remplissage, le foyer et les braises continuent d'animer la lettrine.
3. Le bouton `[ Entrer dans l'atelier › ]` n'est cliquable qu'une fois la lettre
   comblée ; un clic pendant la coulée bascule immédiatement à l'état prêt.
4. Les six onglets sont intégralement lisibles, jamais tronqués, et l'ordre
   Réglages → Informations → Organisation → Correcteur → Couverture → Export
   est respecté.
5. L'onglet Informations affiche le **Feuillet I à gauche** et le
   **Feuillet II à droite**, sans double ascenseur de page.
6. La fermeture (ruban ou croix native) déclenche la cinématique de fermeture du
   livre puis la sortie propre de l'application.
7. Export Word / PDF / EPUB : aucune régression (0 erreur TypeScript,
   0 warning Rust, tests de parité verts).

---

## 8. Renvois

- **Spécifications techniques** : `specifications_techniques.md`
- **Module Couverture** : `SPECIFICATIONS_COVER_STUDIO_v1.2.0.md`
- **Cahier KDP** : `specifications_roman_kdp.md`
- **Documents historiques** (univers « Danoë Studio », conservés pour traçabilité) :
  `archive/specifications_danoe_studio_v0.md`, `archive/specifications_v0_light.md`