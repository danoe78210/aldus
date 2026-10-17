# Manuel du Scribe Audio

Le Studio Audio (Banc V) fabrique des pistes MP3 par chapitre à partir d'un
moteur local. Le texte du livre reste dans Aldus et n'est envoyé qu'à
`127.0.0.1`/`localhost`; aucun fournisseur distant n'est utilisé.

## Préparer XTTS v2 sous Windows

1. Vérifiez Python 3.10 et FFmpeg :

```powershell
py -3.10 --version
ffmpeg -version
```

2. Créez l'environnement hors du dépôt :

```powershell
$envRoot = Join-Path $env:LOCALAPPDATA 'Aldus\xtts-v2'
py -3.10 -m venv $envRoot
$python = Join-Path $envRoot 'Scripts\python.exe'
& $python -m pip install --upgrade pip
```

3. Installez PyTorch CPU, ou choisissez les wheels PyTorch/CUDA correspondant
au GPU et au pilote présents. Puis installez les dépendances XTTS verrouillées :

```powershell
& $python -m pip install torch torchaudio
& $python -m pip install -r scripts\requirements-xtts.txt
```

Le wrapper utilise Coqui TTS 0.22 et `transformers==4.41.2`; ne mettez pas
Transformers à niveau indépendamment. FFmpeg doit être disponible dans `PATH`
pour la conversion et l'assemblage des pistes.

## Licence et première initialisation

Au premier lancement de XTTS v2, Coqui demande de confirmer la licence du
modèle avant de télécharger ses poids. Lisez la CPML et n'acceptez que si ses
conditions conviennent à l'usage prévu; les usages commerciaux peuvent exiger
une licence distincte. Les poids sont placés dans le cache utilisateur, jamais
dans le bundle Aldus.

## Démarrer le moteur

Depuis la racine du dépôt, dans le terminal où les variables de voix sont
définies :

```powershell
$env:ALDUS_TTS_URL = 'http://127.0.0.1:8020'
& $python scripts\xtts_wrapper.py
```

Les profils intégrés du modèle sont proposés par défaut. Pour un profil fondé
sur un fichier de référence autorisé, configurez `ALDUS_TTS_VOICES` selon le
guide [du moteur TTS local](studio-audio-local-engine.md). Vérifiez le service :

```powershell
Invoke-RestMethod 'http://127.0.0.1:8020/voices'
```

Gardez le terminal du serveur ouvert, puis démarrez Aldus dans un autre :

```powershell
npm run tauri dev
```

## Forger un chapitre

Dans **Bibliothèque → Registre du Livre → Studio Audio** :

1. Choisissez une voix française et un chapitre, ou **Tous les chapitres**.
2. Assurez-vous qu'un dossier de fabrication est défini dans
   **Export → Inspection Pré-Presse → Parcourir les archives**.
3. Lancez **Générer l'édition audio**. Le pupitre supérieur indique le chapitre,
   le segment et la progression; la piste apparaît dans le lecteur après
   assemblage.

Les chapitres dépassant la limite XTTS sont segmentés à **240 caractères au
maximum**, de préférence aux frontières de phrase et de paragraphe. Les
segments sont synthétisés séquentiellement et assemblés par FFmpeg en une piste
MP3 unique. Une régénération remplace seulement l'index concerné et conserve
les autres pistes.

## Journaux et erreurs

- Le terminal Python journalise les requêtes, leurs durées et les tracebacks.
- Les erreurs d'inférence génériques renvoient HTTP 500; les erreurs OOM CUDA
  ou mémoire hôte renvoient HTTP 503; les segments de plus de 240 caractères
  sont refusés en HTTP 422.
- Aldus journalise URL, catégorie transport, code HTTP, chapitre, segment et
  corps d'erreur. Le texte narratif n'est pas inclus.
- Sous Windows, le journal Tauri est
  `%LOCALAPPDATA%\net.danoe.aldus\logs\Aldus.log`; le pupitre inférieur conserve
  également le journal des opérations de l'interface.

Pour la recette de déploiement et les contrôles E2E, consulter la
[recette XTTS v2 du Banc V](recette-e2e-banc-v-xtts-v2.md).