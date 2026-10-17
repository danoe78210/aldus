# Finalisation du Banc V : recette E2E XTTS v2

**Destinataire :** Clément
**But :** démarrer un vrai moteur XTTS v2 local, vérifier son contrat HTTP, puis valider la génération et l'écoute d'une édition audio dans Aldus.

## 1. État et périmètre

L'interface, l'extraction EPUB/DOCX/PDF et l'orchestration Rust sont intégrées. Le serveur de référence maintenu par le dépôt est [`scripts/xtts_wrapper.py`](../scripts/xtts_wrapper.py), avec ses dépendances Python dans [`scripts/requirements-xtts.txt`](../scripts/requirements-xtts.txt). Utiliser ce wrapper plutôt que copier un second `server.py` : il implémente les profils de voix, le nettoyage des fichiers temporaires et le contrat attendu par Aldus.

Le MSI Windows embarque le wrapper XTTS v2 et FFmpeg; les poids du modèle restent séparés et sont téléchargés au premier démarrage après acceptation explicite de la licence CPML. Les poids, caches, temporaires Python, fragments audio et journaux sont dirigés vers `%LOCALAPPDATA%\net.danoe.aldus\`. Seules les pistes finales sont écrites dans le dossier d'export choisi.

Le wrapper écoute seulement sur `127.0.0.1:8020` par défaut. Aldus refuse les URLs TTS distantes, même si `ALDUS_TTS_URL` est modifiée.

## 2. Vérifier le MSI Windows

Installer le MSI produit par le job Windows de la release, puis ouvrir **Bibliothèque → Registre du Livre → Studio Audio**. Vérifier que le premier démarrage présente la CPML, que l'acceptation démarre le moteur intégré et que les voix françaises apparaissent après le téléchargement du modèle.

Pendant une génération, contrôler que les fragments sont créés sous `%LOCALAPPDATA%\net.danoe.aldus\temp\audio\`, puis supprimés; les MP3 assemblés doivent apparaître sous `<dossier-export>\Audio\`. Vérifier aussi `%LOCALAPPDATA%\net.danoe.aldus\logs\Aldus.log` et l'absence d'écritures du moteur sous `C:\Program Files\Aldus`.

## 3. Mode développeur : préparer Windows

Ouvrir PowerShell à la racine du dépôt. Vérifier que Python 3.10 est installé :

```powershell
py -3.10 --version
```

Créer un environnement isolé hors du dépôt, puis installer PyTorch et les dépendances du wrapper :

```powershell
$envRoot = Join-Path $env:LOCALAPPDATA 'Aldus\xtts-v2'
py -3.10 -m venv $envRoot
$python = Join-Path $envRoot 'Scripts\python.exe'
& $python -m pip install --upgrade pip
```

Installer la distribution `torch`/`torchaudio` correspondant à la machine. Pour CPU, la distribution PyPI standard convient généralement; pour CUDA, choisir les wheels compatibles avec le pilote dans le sélecteur officiel PyTorch. Puis installer le wrapper :

```powershell
& $python -m pip install torch torchaudio
& $python -m pip install -r scripts\requirements-xtts.txt
& $python -c "import torch; print('CUDA disponible :', torch.cuda.is_available())"
```

Le wrapper utilise `pydub` pour produire le MP3; FFmpeg doit être installé et présent dans `PATH` :

```powershell
ffmpeg -version
```

Si la commande échoue, installer FFmpeg, ajouter son dossier `bin` au `PATH`, puis rouvrir PowerShell.

## 4. Configurer une voix XTTS

XTTS v2 clone une voix depuis un fichier de référence. Les noms `Claire` et `Jean` ne sont pas des identifiants de locuteurs intégrés garantis. Configurer au moins un fichier WAV de référence auquel l'utilisateur a le droit de recourir. Préférer un extrait clair, sans musique ni voix concurrente.

Dans la même session PowerShell que celle qui lancera le serveur :

```powershell
$env:ALDUS_TTS_VOICES = (@{
  claire = @{
    name = 'Claire'
    language = 'fr-FR'
    speakerWav = 'C:/Audio/voix-francaise.wav'
  }
} | ConvertTo-Json -Compress -Depth 4)
```

Remplacer le chemin par celui d'un WAV existant. Plusieurs entrées peuvent être déclarées dans cet objet. Le serveur ne publie que les profils dont le fichier de référence existe et dont la langue commence par `fr`.

## 5. Démarrer et vérifier le serveur

Toujours depuis la racine du dépôt, lancer le wrapper dans le premier terminal :

```powershell
& $python scripts\xtts_wrapper.py
```

Attendre le chargement du modèle. La première initialisation peut être longue et télécharger les poids. Garder ce terminal ouvert. Dans un second PowerShell, vérifier les voix :

```powershell
$voices = Invoke-RestMethod -Uri 'http://127.0.0.1:8020/voices'
$voices.voices | Format-Table id, name, language
```

La réponse doit contenir au moins un profil en français, par exemple `claire`. Vérifier ensuite une synthèse courte avant de lancer un livre complet :

```powershell
$body = @{
  text = 'Ceci est un essai de synthèse vocale en français.'
  voiceId = 'claire'
  language = 'fr'
  outputFormat = 'mp3'
} | ConvertTo-Json
$sample = Join-Path $env:TEMP 'aldus-xtts-smoke.mp3'
Invoke-WebRequest -Uri 'http://127.0.0.1:8020/synthesize' `
  -Method Post -ContentType 'application/json' -Body $body -OutFile $sample
Get-Item $sample | Select-Object FullName, Length
ffprobe -v error -show_entries format=duration `
  -of default=noprint_wrappers=1:nokey=1 $sample
```

Le MP3 doit avoir une taille non nulle et une durée lisible. Le corps de la requête utilise volontairement `voiceId` et `outputFormat`, comme Aldus. Le wrapper accepte au plus 240 caractères par requête; une requête de 241 caractères doit répondre HTTP 422 avec `string_too_long`.

## 6. Recette dans Aldus

Dans le second terminal, définir l'URL locale puis lancer Aldus :

```powershell
$env:ALDUS_TTS_URL = 'http://127.0.0.1:8020'
npm run tauri dev
```

Dans l'application :

1. Ouvrir la Bibliothèque du Banc IV et choisir un EPUB ou DOCX de test avec un chapitre narratif de plus de 273 caractères.
2. Ouvrir le Registre du Livre, puis le Studio Audio. Le moteur doit apparaître disponible et la voix française configurée doit être sélectionnable; l'assistant de mise en route ne doit pas rester affiché.
3. Choisir la voix, sélectionner un chapitre précis, puis lancer **Générer l'édition audio**. Vérifier que seule la piste choisie est synthétisée.
4. Observer les POST `/synthesize` séquentiels (chaque corps ≤ 240 caractères) et `audio-generation-progress`: le livre et l'index doivent correspondre, le titre doit être visible, la progression atteindre 100 % puis signaler l'assemblage.
5. Vérifier le badge **AUDIO** sur la tranche et l'unique piste MP3 du chapitre immédiatement listée dans le pupitre. La piste finale doit être décodable par `ffprobe`; aucun `segment-*.mp3` temporaire ne doit subsister après succès.
6. Sélectionner **Tous les chapitres** et lancer une génération complète pour vérifier le parcours global et la fusion des pistes.
7. Vérifier que `library.json` contient une édition audio avec le moteur, la voix, l'horodatage et les pistes. Les MP3 doivent se trouver sous `<dossier-export>\Audio\`.

Pour un PDF, utiliser un document avec une couche texte sélectionnable : Aldus le traite comme une section unique. Un PDF scanné sans OCR ne permet pas cette recette.

## 7. Contrôles de robustesse

| Contrôle | Résultat attendu |
| --- | --- |
| Définir `ALDUS_TTS_URL` sur un hôte distant puis relancer Aldus | La connexion est refusée avant tout envoi du texte. |
| Arrêter le wrapper pendant un segment | La génération échoue avec chapitre/segment et détail HTTP; les MP3 incomplets de cette tentative sont supprimés et aucune édition partielle n'est publiée dans `library.json`. |
| Envoyer un segment de 241 caractères au wrapper | Réponse HTTP 422 explicite, sans inférence XTTS ni troncature silencieuse. |
| Envoyer un `voiceId` inconnu | HTTP 404 avec `detail`; warning du wrapper contextualisé; un `GET /voices` suivant répond toujours HTTP 200. |
| Assembler un chapitre multi-segments | FFmpeg produit un seul MP3 décodable; les segments temporaires sont supprimés. |
| Erreur de connexion Rust | `Aldus.log` et stdout incluent la catégorie (connection/timeout), l'URL et le contexte chapitre/segment; l'IHM distingue le wrapper indisponible. |
| Erreur HTTP 5xx | Log `error!` avec URL, code et corps brut; le message utilisateur nomme l'erreur d'inférence et le chapitre/segment. |
| Exception d'inférence simulée dans un wrapper isolé | Traceback complet en console et HTTP 500 (`detail`); ne pas provoquer un OOM réel sur le poste de recette. |
| Relancer une génération qui échoue | Une édition audio antérieure reste intacte; les nouveaux fichiers incomplets ne sont pas conservés. |
| Interrompre l'écriture temporaire du wrapper | Son répertoire temporaire est géré par `TemporaryDirectory` et supprimé à la sortie de la requête. |

Le nettoyage Rust est protégé par un garde RAII : toute sortie avant sauvegarde réussie supprime le dossier de la tentative, y compris l'abandon de la tâche. Le Studio ne propose pas encore de bouton d'annulation utilisateur; ne pas documenter un parcours d'annulation UI comme un contrôle disponible. Une terminaison forcée du processus système ne garantit pas l'exécution des destructeurs Rust.

## 8. Dépannage rapide

| Symptôme | Vérification |
| --- | --- |
| Assistant moteur inactif | Le terminal du wrapper est-il toujours ouvert sur `127.0.0.1:8020`? `GET /voices` répond-il? |
| Aucune voix proposée | Vérifier `ALDUS_TTS_VOICES`, le chemin `speakerWav`, l'existence du WAV et une langue `fr`/`fr-FR`. |
| HTTP 422 à la synthèse | Vérifier que le wrapper est celui du dépôt et que le JSON utilise `voiceId` et `outputFormat`. |
| Échec de conversion MP3 | Vérifier `ffmpeg -version` dans le terminal qui exécute le wrapper. |
| Premier démarrage bloqué ou en erreur | Vérifier l'accès au téléchargement des poids, la licence du modèle, la mémoire disponible et la compatibilité PyTorch/CUDA. |
| Le lecteur ne trouve pas de piste | Vérifier le succès complet de la génération, le dossier `Audio` du dossier d'export et les chemins des chapitres persistés dans `library.json`. |

## 9. État de validation

Les tests automatisés couvrent le contrat local, le filtrage des voix françaises, l'extraction des chapitres et le nettoyage des sorties incomplètes. La recette décrite ici reste à exécuter sur une machine équipée de Python 3.10, PyTorch, FFmpeg, du modèle XTTS v2 et d'un WAV de référence autorisé. Le test HTTP réel et la lecture dans Aldus ne sont pas remplacés par les tests simulés.