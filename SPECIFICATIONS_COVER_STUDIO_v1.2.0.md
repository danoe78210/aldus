# Aldus — Atelier de Couverture (Cover Studio v1.2.0)

Spécification du sous-module **Atelier de Couverture** (« full wrap » KDP Print : plat 4 | tranche | plat 1).
Complète `specifications_fonctionnelles.md` et `specifications_techniques.md`.

> **v1.2.0 — correctifs de recette :** syntaxe Typst (`rgb("#ffffff")`, jamais `#rrggbb`), signature de
> dérive robuste (volume textuel), ordre officiel des onglets, jauge de tranche inline (`SpineGauge`),
> couverture appliquée au **livre fermé** lors du rituel de sortie (« Quitter l'atelier »).
> **Clôture v1.2.0 —** tous les jalons du registre — Correcteur (diptyques VII & VIII), Export & Tirage
> (Feuillets IX & X), Ex-Libris de l'Auteur — sont **livrés & testés** (voir §9).

---

## 1. Vue d'ensemble

Le module produit le **fichier de couverture complet** (300 DPI) d'un roman broché KDP à partir de
deux images (plat 1 / Recto et plat 4 / Verso) et de la pagination du bloc intérieur.

| Couche | Technologie | Fichiers |
|---|---|---|
| Moteur géométrique | Rust | `src-tauri/src/cover/geometry.rs` |
| Inspecteur d'images | Rust (`image`) | `src-tauri/src/cover/inspector.rs` |
| Extraction couleur de tranche | Rust (`image`) | `src-tauri/src/cover/color_extractor.rs` |
| Balisage + compilation PDF | Rust (`typst`, `typst-pdf`) | `src-tauri/src/cover/typst_generator.rs` |
| Interface | React + Tailwind v4 | `src/components/cover/*` |

### 1.1 Couverture à la fermeture (« Quitter l'atelier »)
La couverture personnalisée n'est pas réservée à l'export : à la fermeture de l'application
(`isClosing = true`), la **face extérieure du livre fermé** (verso du volet rabattu — §22.2 de la
spécification maîtresse) est habillée depuis `useStudio().cover` dans `Layout.tsx` :
- **Plat 4** ← `cover.backPath` (`convertFileSrc` → `backgroundImage` + `backgroundSize: cover`) ;
- **Plat 1** ← `cover.frontPath` (idem) ;
- **Tranche** ← `cover.spineColorFront` (ou dégradé `cover.gradient` entre `spineColorFront` /
  `spineColorBack`) avec `cover.spineText` centré, **tourné à −90°**, si `cover.pageCount >= 80` ;
- repli `LEATHER_COVER` (cuir) si une image est absente.

---

## 2. Onglet & navigation

- Onglet latéral **`couverture`**, libellé « Couverture », icône `BookMarked`, teinte `#a35829`.
- Placé **entre `correcteur` et `export`** (`LeftPage.tsx`, `MENU_ORDER` dans `App.tsx`), soit
  l'ordre `Réglages → Informations → Organisation → Correcteur → Couverture → Export`.
- Vue rendue par `MenuPage` → `CoverStudioView` (page de droite), état lu via `StudioContext`.

---

## 3. Géométrie KDP (`geometry.rs`)

### 3.1 Règle de parité
Le nombre de pages retenu pour la tranche est **pair** (arrondi supérieur si impair) :
`pages_used = pages + (pages % 2)`.

### 3.2 Coefficients papier (mm/page)
| Papier | id | Coefficient |
|---|---|---|
| Blanc | `white` | `0.05720` |
| Crème | `cream` | `0.06350` |
| Couleur | `color` | `0.05960` |

`spine_width_mm = pages_used × coefficient`. Les identifiants français (`blanc`, `crème`, `couleur`)
sont acceptés (insensibles à la casse/accents).

### 3.3 Seuil de texte sur tranche
Le texte de tranche n'est **éligible qu'à partir de `pages >= 80`**. Dans le cas contraire, la tranche
reste unie (ou dégradée) sans texte.

### 3.4 Dimensions & réserve code-barres
- `total_width_mm  = 3.2 + trim_width_mm + spine_width_mm + trim_width_mm + 3.2`
- `total_height_mm = 3.2 + trim_height_mm + 3.2`
- Fond perdu : **3,2 mm** sur chacun des 4 bords.
- Réserve code-barres (**50,8 × 30,5 mm**), coin inférieur droit du plat 4 :
  - `x = 3.2 + trim_width_mm − 6.4 − 50.8`
  - `y = total_height_mm − 3.2 − 6.4 − 30.5`

Les formats de coupe proviennent de `kdp::trim_size` (repli `6x9`). Sorties arrondies à 3 décimales.

### 3.5 Tests
`cover::geometry::tests` : parité, formats **5.5×8.5** et **6×9 po** pour **120** et **300** pages
(papier crème), seuil de texte, papier inconnu rejeté.

---

## 4. Inspecteur d'images (`inspector.rs`)

Lecture **uniquement de l'en-tête** (`ImageReader::into_decoder()`, aucun décodage de pixels) :
- dimensions (`width_px`, `height_px`) ;
- canal alpha (`ColorType::has_alpha()` — `Rgba8`, `Rgba16`, `La8`, `La16`) ;
- DPI effectif : `dpi_horizontal = width_px / trim_width_in`, `dpi_vertical = height_px / trim_height_in`,
  `dpi = min(des deux)` ;
- statut : `valid` (**≥ 300**), `warning` (**250–299**), `invalid` (**< 250**).

`inspect_cover_images` renvoie un `ImageInspectionReport { trimSize, requiredDpi, front, back }`.

### 4.1 Repères de résolution et dimensions de référence

- Seuil de production contrôlé par l'application : **300 DPI effectifs** au minimum ; le
  statut `valid` commence à 300 DPI. Le calcul utilise le format physique choisi et les
  dimensions réelles de chaque image, et non une taille de fichier imposée.
- Repère de préparation des plats utilisé dans le présent cahier : **2138 × 3076 px à
  305,43 DPI**. Cette dimension est une référence de gabarit/source, pas une constante
  inscrite dans le moteur : les formats KDP disponibles ont des rapports de coupe variés.
- Le document de couverture généré est vectoriel via Typst ; la résolution d'un visuel
  raster importé reste celle mesurée par l'inspecteur. Un PDF vectoriel n'augmente pas la
  résolution intrinsèque de ces images.

---

## 5. Pipeline Typst & export PDF (`typst_generator.rs`)

### 5.1 Pré-traitement des images
Chaque plat est préparé dans un dossier temporaire (`std::env::temp_dir()/danoe_cover_<pid>_<nano>`) :
- image **sans** canal alpha → copiée telle quelle (extension préservée) ;
- image **avec** canal alpha → **aplatie sur fond blanc `rgb("#ffffff")`** et ré-encodée en PNG.

### 5.2 Balisage (4 calques)
Conversion `pt = mm × 72 / 25.4`. Page `#set page(width, height, margin: 0pt, fill: white)`.
1. **Calque 1** — image **plat 4** (`fit: "cover"`), largeur `bleed + trim`.
2. **Calque 2** — image **plat 1** (`fit: "cover"`), largeur `trim + bleed`, à `x = bleed + trim + spine`.
3. **Calque 3** — **tranche vectorielle** (`rect`) : fond uni (`rgb("#rrggbb")`) ou dégradé
   (`gradient.linear`) ; si `pages >= 80`, texte centré tourné à **−90°**.
4. **Calque 4** — **réserve blanche de code-barres** (50,8 × 30,5 mm) au coin inférieur droit du plat 4,
   remplie en Typst par `rect(... fill: rgb("#ffffff"))`.

> **Syntaxe des couleurs Typst :** toujours `rgb("#rrggbb")` — **jamais** `#rrggbb` nu (ni `#ffff`
> tronqué). Le fond blanc de la réserve code-barres s'écrit donc `rgb("#ffffff")`.

### 5.3 Compilation 300 DPI
Compilation via `pdf::compile_to_pdf_with_root(source, work_dir)` (moteur **Typst embarqué**), puis
écriture du PDF à `output_pdf_path`. Le rapport (`ExportReport`) inclut `dpi` (300), `bytes`,
`pageCountUsed`, dimensions, `flattenedImages`. Toutes les couleurs injectées respectent la syntaxe
`rgb("#rrggbb")` (fond de page `white`, réserve code-barres `rgb("#ffffff")`, tranche `rgb("#…")` ou
`gradient.linear(...)`).

### 5.4 Tests
`cover::typst_generator::tests` : génération complète vers un PDF temporaire (signature `%PDF` +
`%%EOF`), présence des 4 calques, aplatissement conditionnel, `spine_fill` (uni/dégradé/défaut).

---

## 6. Interface (`src/components/cover/`)

| Composant | Rôle |
|---|---|
| `CoverCalibration.tsx` | Feuillet VI : pagination, papier, finition, images, texte du dos et métriques en direct |
| `CoverPlate.tsx` | Feuillet V : marbre, sous-vues 2D/3D, dérive et dialogue de pré-export |
| `CoverCanvas2D.tsx` | Planche SVG + loupe plein écran (portal) + accès à l'export |
| `Cover3DPreview.tsx` | Livre 3D orbital + vitrine immersive (portal) |
| `CoverPreExportModal.tsx` | Checklist de conformité avant export |

- Les trois fonctions du Banc V sont réparties sur deux feuillets : calibrage/matières
  (Feuillet VI), puis marbre 2D ou volume 3D (Feuillet V). La sous-navigation du marbre
  bascule entre `canvas2d` et `preview3d` ; les réglages ne forment pas un troisième onglet.
- **Miniatures réelles** (page 1) : `convertFileSrc(path)` → `<img>` (repli cadre pointillé
  *« Déposez ou parcourez… »*), nom de fichier + **badges DPI** (🟢 ≥ 300 · 🟡 250–299 · 🔴 < 250 ·
  🔵 alpha aplati).
- **Textures réelles 2D** (`CoverSvg`) : `<image href={convertFileSrc(...)} preserveAspectRatio="none">`
  pour Plat 4 / Plat 1 (repli `<rect fill="#e7e0d2">`) ; **repères KDP** dans un `<g class="pointer-events-none">`.
- **Textures réelles 3D** : faces Plat 1 / Plat 4 via `backgroundImage`, rotation orbitale libre
  (−180°…+180° horizontal, −15°…+15° vertical).
- **Pop-ups plein écran détachées** (2D & 3D) : `createPortal(..., document.body)`,
  `fixed inset-0 z-[9999] bg-stone-950/95 flex flex-col p-6` ; fermeture par `[ Fermer ✕ ]` ou **Échap**
  → retour à l'onglet `settings`, listener nettoyé au démontage.
- **Repères 2D** : fond perdu (rouge pointillé), pliures (bleu pointillé), zone de sécurité (vert),
  réserve code-barres (blanc).
- **Dérive** : comparaison de la pagination déclarée au snapshot et d'une signature de structure
  intégrant l'identifiant, le type et le volume textuel des sections ; le recalcul met à jour
  le snapshot après confirmation.
- **Finitions** : choix persisté `mat` (Mat Velouté) ou `glossy` (Brillant Éclatant). Ce choix
  décrit le pelliculage souhaité ; il n'ajoute pas de couche d'impression ni de certification
  de finition au PDF généré.

### 6.0 Harmonisation typographique
Deux registres coexistent volontairement :
- **Interface, contrôles, métriques** (libellés, boutons, badges DPI, dimensions en mm, formulaires) →
  **sans-serif humaniste neutre et lisible** : `Plus Jakarta Sans` (défaut), repli `Source Sans 3` /
  `Inter` / `Segoe UI`. Contraste et *tracking* confortables sur les petites tailles.
- **Titrages / identité du registre** → **serif éditoriale sobre et statutaire** : `Cormorant Garamond`,
  repli `Cinzel` / `Libertinus Serif` / `Georgia`.
- **Typographie de tranche** (jauge & aperçus) → police éditoriale à empattements nets
  (`Libertinus Serif` / `Georgia`) pour la lisibilité sur dos étroit.

Implémentation : `src/index.css` (`@theme` → `--font-sans`, `--font-serif` ; `body { font-family:
var(--font-sans) }`) et `index.html` (`lang="fr"`, `<title>` « Aldus — Atelier du Livre Moderne »,
chargement des deux familles avec repli système hors connexion). Les titres conservent la classe
`font-serif`.

### 6.1 Ordre officiel des rubans
Séquence canonique (`LeftPage.tsx`, union `ActiveMenu` et `MENU_ORDER` de `App.tsx`) :

`Réglages` → `Informations` → `Écritoire` → `Organisation` → **`Correcteur`** → `Épreuve de Plume` → **`Couverture`** → `Export` → `Studio Audio` → `Bibliothèque`

soit, pour `ActiveMenu` :
```ts
export type ActiveMenu =
  | 'reglages' | 'infos' | 'ecritoire' | 'organisation' | 'correcteur' | 'epreuve-plume'
  | 'couverture' | 'export' | 'bibliotheque' | 'studio-audio';
```

### 6.2 Jauge de tranche inline (`SpineGauge.tsx`)
Réglette **agrandie en coupe horizontale**, affichée **sous le champ de saisie du dos** (page 1,
carte « Typographie de tranche »), matérialisant en direct :
- **hauteur fixe 40 px** ; largeur proportionnelle à `spineWidthMm` (échelle ≈ 16 px/mm, bornée
  `[72, 320] px`) avec libellé millimétrique lisible (ex. `7.62 mm`) ;
- **marges de sécurité de pliure de 1,6 mm** sur les bords intérieurs, tracées en **pointillés
  (cyan)** et interdites au texte ;
- texte du dos centré (centrage optique), police éditoriale à empattements nets, −90° en aperçu ;
- **état bloqué** si `isEligible === false` (`pageCount < 80`) : message « — tranche < 80 pages — » ;
- **détection de débordement** : si la longueur estimée dépasse la zone utile, alerte
  « Risque de débordement du texte sur les mors ».

Props : `spineWidthMm`, `spineText`, `textColor`, `backgroundColor`, `backgroundGradientEnd`,
`isEligible`. Mise à jour **temps réel** (aucun recalcul serveur).

### 6.3 Tests frontend (Vitest + React Testing Library)
`src/components/cover/__tests__/` :
- `CoverCanvas2D.test.tsx` — textures `<image>`/repli beige, portail sous `document.body`,
  fermeture (bouton + Échap) et retour aux réglages ;
- `Cover3DPreview.test.tsx` — URLs converties dans `backgroundImage` des faces, portail de la
  vitrine immersive, fermeture (bouton + Échap) et retour aux réglages ;
- `SpineGauge.test.tsx` — affichage du texte si `isEligible`, état bloqué sinon, repères de marge
  de sécurité (1,6 mm), alerte de débordement.

Commande : `npx vitest run src/components/cover/__tests__/` (environment `jsdom`).

---

## 7. Commandes Tauri (`src-tauri/src/cover/mod.rs`)

| Commande | Signature |
|---|---|
| `calculate_cover_geometry` | `(page_count, paper_type, trim_size) -> CoverGeometry` |
| `inspect_cover_images` | `(front_path, back_path, trim_size) -> ImageInspectionReport` |
| `extract_spine_color` | `(front_path, back_path) -> SpineColorSuggestion` |
| `export_kdp_cover_pdf` | `(params: CoverRenderParams, output_pdf_path) -> ExportReport` |
| `pick_cover_image` | `() -> Option<String>` (sélecteur natif) |
| `pick_cover_output_path` | `(default_name) -> Option<String>` (sélecteur natif) |

Enregistrées dans `lib.rs` (`generate_handler!`). En **Tauri v2**, les plugins `dialog`/`fs` ne sont pas
exposés sur `window.__TAURI__` : les sélecteurs natifs passent par ces commandes.

---

## 8. Persistance (`CoverStudioState`)

Champ optionnel **`cover?: CoverStudioState`** du fichier projet `.danoe` (JSON v1.0) :

```ts
interface CoverStudioState {
  frontPath: string | null;
  backPath: string | null;
  pageCount: number;
  paperType: 'white' | 'cream' | 'color';
  spineText: string;
  spineColorFront: string | null;
  spineColorBack: string | null;
## 9. Clôture v1.2.0 — Changelog

Les jalons suivants sont **livrés & testés** à la version `v1.2.0` :

| Jalon | État | Détail |
|---|---|---|
| **Correcteur — Diptyque VII (Indice de Pureté)** | ✅ Livré & testé | Sélecteur de chapitre en tête, plancher ≥ 11 px, « Les Règles Analysées » en colonne unique paginée (3 feuillets × 6 règles), règles activables partagées. |
| **Correcteur — Diptyque VIII (Banc d'Épreuve)** | ✅ Livré & testé | « Conseils de l'Imprimeur », `[ ⌖ Localiser ]` (surbrillance d'or + recentrage), mode `[ ✍ Retouche ]` avec réglet Markdown/typographique. |
| **Export — Feuillet IX** | ✅ Livré & testé | Dossier de fabrication en tête, forme DOCX réintégrée, compactage sans scrollbar blanche. |
| **Export — Feuillet X** | ✅ Livré & testé | Ouverture native du dossier des épreuves, sceau de presse officiel à disparition automatique (30 s). |
| **Identité & Ex-Libris** | ✅ Livré & testé | Icône vénitienne en bronze multiplateforme, Ex-Libris Dragon Danoë → `danoeecrivain.net`. |

Enregistrement des commandes associées dans `lib.rs` (`generate_handler!`) :
`open_proofs_directory`, `open_author_website` (module `commands`).
  gradient: boolean;
  pageCountSnapshot: number;
  structureSignature: string;
}
```

Sérialisé par `buildProjectFile` (état `App`) ; hydraté au chargement. La géométrie et les rapports
d'inspection sont **recalculés à la volée** et ne sont jamais persistés.

**Règle de calcul de `structureSignature` (déterministe).**
L'empreinte de structure intègre le **volume textuel** de chaque section (pas seulement sa présence) :

```
structureSignature = SHA-256(
  concat_items( item.id + ":" + item.type + ":" + item.word_count + ":" + item.order )
)
```

Implémentation frontend actuelle (`App.tsx`, `useMemo`) — équivalente et déterministe, l'ordre étant
porté par la position dans le tableau :

```ts
const structureSignature = useMemo(
  () => structure.map((item) => `${item.id}:${item.type}:${item.wordCount ?? 0}`).join('|'),
  [structure],
);
```

`StructureItem.wordCount?: number` (nombre de mots du fichier lié) permet ainsi de détecter une
**modification de volume** au sein d'un chapitre existant, et pas uniquement un ajout/suppression.

---

## 9. Dialogue de pré-export (`CoverPreExportModal`)

Contrôles **automatiques** (blocage si un échec) :
- Résolution ≥ 300 DPI (Recto & Verso) ;
- Fond perdu **3,2 mm** ;
- Épaisseur de tranche (calculée) ;
- Réserve code-barres (**50,8 × 30,5 mm**) ;
- Texte de tranche (éligibilité ≥ 80 pages).

Validations **manuelles** de l'auteur : textes hors zones de massicotage, lisibilité de la tranche.

Boutons `[ Annuler ]` / `[ Confirmer & Enregistrer le PDF › ]` (→ sélecteur natif + export Typst).

---

## 10. Détection de dérive

La pagination et la **signature de structure** courantes sont comparées au snapshot enregistré lors
de la validation de la tranche (`pageCountSnapshot`, `structureSignature`). En cas d'écart, une
bannière propose **[ Recalculer la tranche ]** (met à jour le snapshot).

`structureSignature` est recalculée via la règle déterministe du §8 (`id:type:word_count` par
élément, ordre porté par la position) : toute **modification de volume textuel** dans un chapitre
(modification de `wordCount`) fait donc basculer la détection, au même titre qu'un ajout ou une
suppression de section ou qu'un changement de pagination (`pageCount !== pageCountSnapshot`).

---

## 11. Limites & roadmap v1.2

| Sujet | Statut |
|---|---|
| Couverture **brochée** (full wrap) PDF 300 DPI | ✅ Livré |
| Couverture **rigide** (« hardcover ») | ❌ Reporté en **v1.3** |
| Formats de coupe personnalisés (saisie libre) | ❌ Non pris en charge (7 presets KDP) |
| Contrôle des plats à ≥ 300 DPI effectifs | ✅ Livré (inspecteur basé sur le format de coupe) |
| Dimensions raster fixes 2138 × 3076 px | ℹ️ Repère documentaire, non imposé par le moteur |

---

*Fin du document. Toute évolution doit préserver la parité des règles KDP (§3), la compatibilité du
champ `cover?` (§8) et la **Tolérance Zéro** (aucun échec silencieux).*
