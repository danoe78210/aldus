# Registre des Évolutions — Aldus
## [1.4.2] - Banc V unitaire & démarrage CPML
### Ajouté
- Assistant CPML fermé dès l'acceptation; consentement enregistré atomiquement dans `%LOCALAPPDATA%\\net.danoe.aldus\\config.json` avant le démarrage du moteur.
- Progression de l'initialisation Python, PyTorch et XTTS transmise au pupitre supérieur.
- Studio Audio strictement par chapitre, avec pages/durée estimées à 135 mots/min et suppression physique d'une piste MP3 depuis le Registre.

## [1.4.1] - Bundle MSI autonome Windows
### Ajouté
- MSI WiX Windows avec sidecars Python/PyInstaller XTTS v2 et FFmpeg statique LGPL, préparés par GitHub Actions.
- Démarrage/arrêt contrôlés du moteur audio, consentement CPML explicite et redirection des caches, temporaires et journaux vers `%LOCALAPPDATA%\net.danoe.aldus\`.
- Fragments audio temporaires isolés sous LocalAppData; seules les pistes MP3 finales rejoignent le dossier d'export.

## [1.4.0] - Studio Audio & Bibliothèque
### Ajouté
- **Banc IV — Bibliothèque** : rayons principaux et personnalisés, scan des exports, regroupement EPUB/PDF/DOCX, statistiques par format, suppression confirmée et préservation des sources partagées.
- **Banc V — Studio Audio** : wrapper local XTTS v2 sur `127.0.0.1:8020`, profils français, assistant de mise en route et lecteur audio intégré.
- Génération ciblée d'un chapitre ou de tous les chapitres; fusion incrémentale des pistes dans `library.json` sans écraser les autres index.
- Découpage narratif à 240 caractères maximum, synthèse séquentielle des segments et assemblage FFmpeg en un MP3 par chapitre.
- Progression audio centralisée dans le pupitre supérieur, avec chapitre/segment courant et bouton de forge animé/verrouillé.
- Journalisation Tauri vers stdout et `%LOCALAPPDATA%\\net.danoe.aldus\\logs\\Aldus.log`; logs FastAPI avec traceback et réponses explicites pour les erreurs HTTP et mémoire.

### Vérifié
- Synthèse XTTS locale E2E, génération ciblée et conservation incrémentale des pistes.
- Découpage réel d'un chapitre long : segments HTTP 200, MP3 final assemblé et décodable.
- Tests de validation release : 22 tests React ciblés et 33 tests Rust bibliothèque.

## [1.3.0] - L’Écritoire
### Ajouté
- Banc III — L’Écritoire : édition Markdown à gauche et composition live à droite, avec sélection et création de chapitres dans le dossier source.
- Réglet typographique (guillemets français, cadratin, espace insécable, apostrophe courbe, ligatures) et Manuel du Scribe pour titres, dialogues, exergues, notes et séparateurs de scène.
- Commandes Tauri `list_source_files`, `read_chapter_file`, `save_chapter_file` et `create_chapter_file`, avec alias de compatibilité pour le listing et la sauvegarde.

## [1.2.0] - Clôture Correcteur, Export & Ex-Libris
### Livré & testé
- Correcteur en deux diptyques synchronisés (VII — Indice de Pureté / VIII — Le Banc d'Épreuve) : bascule partagée via `StudioContext`, grille des règles en colonne unique paginée (3 × 6), « Conseils de l'Imprimeur », `[ ⌖ Localiser ]` et mode `[ ✍ Retouche ]`.
- Export & Tirage : dossier de fabrication en tête du Feuillet IX, forme **Word DOCX** réintégrée, bouton `[ OUVRIR LE DOSSIER DES ÉPREUVES ]` natif, sceau de presse à disparition automatique (30 s).
- Identité : icône officielle vénitienne (Tauri + favicons) et **Ex-Libris Dragon Danoë** (`danoeecrivain.net`).

## [1.0.0] - Édition Vénitienne
### Ajouté
- Identité visuelle complète « Dark Atelier » (ébène, or vieilli, cuir et laiton).
- Sas d'accueil avec fusion d'or dans le creuset de la lettrine « A » et transition d'encre vers le registre.
- Formulaire d'Informations et achevé d'imprimer sur double feuillet.
- Module Organisation avec table des feuillets et imposition en cahiers.
- Marbre de couverture 2D/3D et calibreur de tranche millimétrique KDP.
- Correcteur typographique appliquant les règles de l'Imprimerie nationale.
- Pressoir d'exportation pour PDF d'impression et ePub 3.

## [1.0.2] - Accueil & Navigation
### Modifié
- L'entrée dans l'atelier (`[ Entrer dans l'atelier › ]`) ouvre désormais le pupitre **Réglages** (premier signet de la tranche) au lieu d'Informations — `enterAtelier` réassigne explicitement `activeMenu = 'reglages'`.
## [1.0.1] - Double-Feuillets du Correcteur
### Modifié
- Correcteur restructuré en **deux diptyques in-folio autonomes** avec bascule d'en-tête synchronisée sur les deux pages du livre : `[ VII. Indice de Pureté ]` / `[ VIII. Le Banc d'Épreuve ]`.
- « Basse-cour des règles » remplacée par **« Les Règles Analysées »** (grille aérée à deux colonnes, cases en or antique sur ébène) ; « Gloses de l'Imprimeur » par **« Conseils de l'Imprimeur »** (liste défilante sombre à barre discrète #382f22).
- Grand feuillet de lecture du banc en vélin chaud (#f4efe6, Garamond 16 px aéré) composé sur la page gauche, pupitre et conseils partagés (chapitre, texte, pagination via `StudioContext`).
- Barre de défilement blanche éradiquée : chaque page tient en hauteur (`overflow-hidden`) ; liste des conseils sur ascenseur sombre discret.