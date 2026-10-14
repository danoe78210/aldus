# Registre des Évolutions — Aldus
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