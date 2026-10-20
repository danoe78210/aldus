# Captures d'écran — Les Bancs de l'Atelier

Ce dossier accueille les captures servant d'aperçu aux **sept bancs d'ingénierie éditoriale**
présentés dans la section `#bancs` de `docs/index.html`.

Déposez ici les images suivantes (PNG recommandé, ratio ~16/10, largeur ≥ 960 px) :

| Fichier | Banc | Menu / Vue |
|---|---|---|
| `banc-1-parametres.png` + `banc-1-formats.png` | Banc I — Le Banc de Calibrage & Gabarits | Menu Réglages (diptyque) |
| `banc-2-identite.png` + `banc-2-colophon.png` | Banc II — Le Banc de l'Identité & du Colophon | Menu Informations (diptyque) |
| `banc-3-architecture.png` + `banc-3-calibrage.png` | Banc III — Le Banc de l'Architecture Narrative | Menu Organisation (diptyque) |
| `Correcteur01.png` + `Correcteur02.png` + `Correcteur03.png` + `Correcteur04.png` | Banc IV — Le Banc de Qualité Typographique & d'Épreuve | Menu Correcteur — Vues I & II (4 vues) |
| `Couverture02.png` + `Couverture01.jpg` + `Couverture03.png` | Banc V — Le Banc de mise en couverture | Menu Couverture (3 vues) |
| `Export01.png` | Banc VI — L'Inspection Pré-Presse | Menu Export — Vue I |
| `Export02.png` | Banc VII — Le Tirage sous Presse | Menu Export — Vue II |
| `studio-audio-chapter-selector.png` | Banc V — Studio Audio | Registre du Livre — choix de voix et sélecteur de chapitre |
| `studio-audio-player.png` | Banc V — Studio Audio | Pupitre de lecture et badge AUDIO |
| `studio-audio-progress.png` | Banc V — Studio Audio | Pupitre supérieur pendant une synthèse segmentée |

> Tant qu'un fichier est absent, le cadre du banc affiche automatiquement un libellé
> de remplacement (le nom du fichier attendu) : aucune image cassée n'est visible.

## Galerie v1.4.8 — Atelier en Images

La section `#nouveautes` réutilise les deux captures audio existantes et ajoute
quatre captures prises dans le MSI v1.4.8 installé, avec un manuscrit de
démonstration (aucun texte source personnel) :

| Fichier | Contenu |
|---|---|
| `studio-audio-player.png` | Pupitre d'écoute intégré |
| `studio-audio-chapter-selector.png` | Choix de voix et de chapitre |
| `imposition-typst-spine.png` | 34 pages Typst mesurées, dos crème de 2,16 mm |
| `banc-epreuve-history.png` | Historique horodaté d'un chapitre de démonstration |
| `organisation-workspace.png` | Chemins relatifs dans le sous-dossier `Chapitres` |
| `page-garde-bronze-plate.png` | Diptyque d'accueil et plaque v1.4.8 |

Les images s'agrandissent dans une boîte de dialogue native, refermable avec
Échap ou le bouton Fermer. Sans JavaScript, les liens ouvrent directement les PNG.

## Galerie v1.4.9 — Épreuve de Plume

| Fichier | Contenu |
|---|---|
| `epreuve-de-plume-v1.4.9.png` | Modale de gestion des règles : onglets de détection/humanisation et formulaire d'ajout |

La capture montre l'interface réelle de gestion des règles dans l'atelier Dark
Atelier, en mode aperçu navigateur. Les commandes Tauri d'audit et de
persistance nécessitent l'application de bureau.

## Styles autonomes de la vitrine

La page charge uniquement une feuille CSS locale et des polices système.
Après une modification des classes HTML ou de
[`styles.input.css`](../../styles.input.css), exécuter à la racine :

```sh
npm run build:showcase
```

Versionner le résultat [`styles.css`](../../styles.css) avec les sources.
La génération réutilise Tailwind/PostCSS déjà présents dans le projet ;
aucune dépendance ni compilation n'est requise pour consulter ou héberger la page.
