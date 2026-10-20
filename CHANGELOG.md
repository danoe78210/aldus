# Registre des Évolutions — Aldus
## [1.4.10] - 2026-10-20 — Épreuve de Plume, pupitre de remaniement
### Amélioré
- Épreuve de Plume : l'écran ne reprend plus les règles d'orthotypographie du Banc d'Épreuve et se consacre aux métriques stylistiques (cadence, tics de transition, triades, entropie, distribution de Zipf).
- Registre des Remaniements : flux défilant de cartes d'alerte (ligne, motif, texte original, diagnostic, proposition de la Forge) remplaçant la liste paginée à cases à cocher.
- « Appliquer la reformation » crée un instantané dans `.aldus/history/`, remplace le passage de façon atomique après vérification du texte d'origine et recalcule le score ; « Ignorer » masque l'alerte pour la session sans toucher au fichier.
- Les alertes d'entropie et de Zipf désignent une phrase représentative, indiquent la mesure dans le diagnostic et proposent une substitution lexicale ou une inversion syntaxique.
- Les titres Markdown (`#`, `##`) sont exclus de l'analyse : ils ne fusionnent plus avec la première phrase d'une alerte de cadence.
- Manuscrit annoté : surlignage translucide rouille, interaction bidirectionnelle carte ↔ passage, texte justifié avec césures françaises en Literata, titres Markdown mis en forme sans dièses.
- Lisibilité : jauge colorée par niveau de risque, micro-métriques Rythme & Souffle et Empreinte syntaxique, cartes et boutons contrastés en police d'interface.
- Plaque de version : vérification des mises à jour mise en cache deux heures, bouton « Vérifier maintenant » et erreurs affichées dans la modale.

### Limites connues
- Les extraits et propositions des cartes conservent le balisage Markdown éventuel du passage (`*`, guillemets).
- Le score reste un indicateur heuristique, non une preuve d'origine.
## [1.4.9] - 2026-10-20 — Épreuve de Plume & Usage Aldin
### Ajouté
- Épreuve de Plume : audit stylométrique déterministe et local, score de risque heuristique, anomalies contextualisées et suggestions, règles de détection/humanisation natives et personnalisées persistées.
- Gestion des règles : activation, désactivation, suppression des règles personnelles et rétablissement des règles d'usine ; connecteurs regroupés pour éviter le double comptage.
- Banc d'Épreuve : aperçu puis normalisation globale de l'Usage Aldin dans les fichiers Markdown du workspace, avec dialogue de confirmation et rapport des substitutions.
- Sécurité du manuscrit : instantanés par chapitre avant normalisation, écriture atomique et restauration par l'historique existant.
- Données applicatives : migration des anciens projets, bibliothèques et préférences depuis APPDATA vers LocalAppData ; les conflits sont archivés localement avant retrait de l'ancienne copie.
- Design System Dark Atelier : tokens couleur partagés, cartes, textes parchemin/or et badge de transformation.

### Amélioré
- Les règles stylométriques signalent notamment les connecteurs stéréotypés, triades rhétoriques, listes préformatées, régularités de cadence et densité lexicale uniforme ; les marqueurs sensoriels et expressifs abaissent le score heuristique.
- L'Usage Aldin normalise les apostrophes, espaces typographiques, tirets de dialogue et ligatures françaises reconnues ; l'aperçu n'écrit aucun fichier.
- Contraste renforcé pour le texte global de l'atelier, le Studio Audio, l'Imposition et les conseils du Banc d'Épreuve.

### Limites connues
- Le score de risque est un indicateur heuristique, non une preuve d'origine ou un détecteur fiable de texte généré.
- Aucun test de watermarking n'est prétendu : sans procédé de génération ni clé connue, une corrélation générique de n-grammes serait trompeuse.
- La normalisation des ligatures est volontairement limitée à des mots français répertoriés pour éviter les substitutions linguistiquement incorrectes.

## [1.4.8] - 2026-10-19 — Pagination mesurée & sécurité du manuscrit
### Amélioré
- Pagination : comptage des pages physiques du document Typst à chaque aperçu/export PDF, persistance dans le projet et actualisation de l'Imposition et de la Couverture. Le dos utilise la mesure en priorité, avec une page blanche de parité si nécessaire ; avant composition, estimation à 250 mots/page arrondie au pair.
- La mesure est invalidée si les sources, la structure ou les réglages de composition changent. La gouttière est recomposée si la pagination franchit un seuil KDP ; les placements de chapitres restent explicitement estimés.
- Historique : instantané atomique avant modification d'une source Markdown depuis l'Écritoire ou le Banc X, sous `.aldus/history/`, limité à 15 versions par chapitre. Le dialogue « Historique des versions » confirme la restauration, conserve le texte enregistré précédent et recharge les deux éditeurs concernés.
- Libellés : « PDF Imprimeur (Haute Définition) » et « EPUB (Standard) », avec limites de validation explicites dans l'interface et la vitrine ; aucune garantie de rejet zéro ni certification PDF/X/EPUB 3.2.
### Corrigé
- Sauvegarde atomique du projet : une autosauvegarde ne peut plus écraser la mesure issue d'une compilation.
- Audio : budget de 900 s partagé par la synthèse et l'assemblage d'un chapitre, sans réinitialisation à chaque segment. L'initialisation XTTS conserve son budget distinct.
- Spécifications : numérotation des sections, doublon de traçabilité et génération audio uniquement par chapitre harmonisés.

## [1.4.7] - 2026-10-19 — Initialisation XTTS & disponibilité des voix
### Corrigé
- Studio Audio : la route `/voices` indexe les profils dès que le modèle est chargé, sans exiger au préalable l'état `ready` qu'elle doit elle-même établir ; les erreurs de chargement restent explicites.
- Premier démarrage XTTS : séparation du délai de réponse du sidecar (60 s) et du budget global d'initialisation (15 min), afin de laisser le téléchargement/chargement des modèles progresser sans coupure prématurée.

### Vérifié
- Tests Python de non-régression de l'indexation des voix, exécutés aussi avant publication du MSI Windows.
- Le tag et les assets 1.4.6 sont conservés ; cette version corrige les blocages révélés par leur recette réelle.

## [1.4.6] - 2026-10-19 — Sources récursives & journal pédagogique
### Corrigé
- Sidecar XTTS : collecte complète de `jamo` et vérification de `jamo/data/U+11xx.json` dans l'archive PyInstaller pour éviter le crash au chargement.
- Organisation : lignes de structure contenues sans débordement (sélecteurs de source fluides, boutons-icônes Parcourir/Importer avec infobulle, titre borné) et marqueur d'ordre seul pour les pièces liminaires sans titre.

### Amélioré
- Journal des erreurs : miroir pédagogique `journal_erreurs_aldus.txt` alimenté en arrière-plan (alertes/erreurs, opérations en mode Diagnostic), explications des erreurs XTTS/PyInstaller, accès disque et quotas GitHub ; préférences globales enregistrées atomiquement, bouton d'ouverture et sélecteur natif raccordés. Une destination indisponible n'interrompt pas Aldus et reste signalée dans le journal technique.
- Sources : indexation récursive de « Mes sources » (sous-dossiers de coffres Obsidian inclus) hors du thread de l'interface ; dossiers cachés (`.obsidian`, `.trash`, `.git`…), `node_modules`, `target` et `dist` ignorés, liens symboliques non suivis. Les sélecteurs affichent le chemin relatif, triés dans l'ordre naturel ; la Couverture propose ces images (plat 1 et logo du plat 4) en plus du sélecteur système.

## [1.4.5] - Modale de mise à jour & aura bronze
### Corrigé
- Modale de mise à jour : fermeture effective par le bouton, Échap et clic sur le fond.
- Ouverture de la release GitHub dans le navigateur système via une commande Tauri native sécurisée.

### Amélioré
- Aura dorée multicouche et pulsante de la plaque lorsque la vérification quotidienne détecte une release plus récente; rendu statique si les mouvements réduits sont activés.

## [1.4.4] - Persistance des épreuves & finition Studio Audio
### Ajouté
- Banc d'Épreuve : bouton de validation du chapitre, état non enregistré protégé contre rechargement/changement de chapitre, et écriture atomique `.tmp` + `rename` via `save_chapter_content`.
- Studio Audio strictement unitaire : métriques de pages, mots et durée par chapitre; suppression physique individuelle des MP3.
- Assistant CPML fermé dès l'acceptation et progression Python/PyTorch/XTTS centralisée dans le pupitre supérieur.
- Plaque de bronze centrée en bas de la page gauche avec version dynamique et alerte de release quotidienne.

### Corrigé
- Packaging PyInstaller autonome vérifiant `gruut/VERSION` et embarquant les ressources `inflect`, `typeguard`, `gruut` et FFmpeg.
- Échec d'initialisation XTTS remonté immédiatement par `/status` sans attendre le timeout.

## [1.4.3] - MSI autonome XTTS & plaque de version
### Corrigé
- Sidecar PyInstaller : collecte de `gruut`, `inflect` et `typeguard`, copie des métadonnées Gruut et vérification de `gruut/VERSION` avant le packaging MSI.
- Initialisation XTTS : statut `/status` en erreur transmis immédiatement à Rust au lieu d'attendre le délai de 60 secondes.

### Ajouté
- Plaque de bronze interactive avec vérification quotidienne des releases GitHub, notes de version et ouverture sécurisée de la page officielle.
- Studio Audio unitaire, métriques de chapitre et suppression physique des pistes MP3 depuis le Registre.

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