# Studio Audio : moteur TTS local

Le Studio Audio ne transporte jamais le texte du manuscrit vers un fournisseur distant. Il se connecte uniquement à un wrapper TTS local compatible XTTS v2, F5-TTS ou à un moteur équivalent.

Dans l'installateur MSI Windows, Aldus lance automatiquement son sidecar XTTS
et son sidecar FFmpeg. Le premier démarrage nécessite une acceptation explicite
de la CPML; les poids du modèle sont ensuite téléchargés dans
`%LOCALAPPDATA%\net.danoe.aldus\models`. Les caches, temporaires Python et
journaux restent également dans le dossier local Aldus. En mode développement,
le moteur externe décrit ci-dessous reste disponible.

Par défaut, Aldus attend `http://127.0.0.1:8020`. L’URL peut être remplacée par la variable d’environnement `ALDUS_TTS_URL`; seuls `localhost`, `127.0.0.1` et `::1` en HTTP sont acceptés.

## Contrat HTTP

`GET /voices` renvoie soit un tableau JSON, soit `{ "voices": [...] }`. Chaque voix comporte `id`, `name` et `language` (`fr`, `fr-FR`, etc.). Aldus ne propose que les voix explicitement indiquées en français; une voix sans langue déclarée n'est pas considérée française.

`POST /synthesize` reçoit un segment narratif par requête :

```json
{
  "text": "Un paragraphe ou une phrase du chapitre…",
  "voiceId": "fr-narrator",
  "language": "fr",
  "outputFormat": "mp3",
  "chapterIndex": 2,
  "chapterTitle": "Chapitre second",
  "segmentIndex": 1,
  "segmentCount": 4
}
```

Le wrapper répond avec les octets MP3 du segment dans le corps HTTP. `chapterIndex`, `chapterTitle`, `segmentIndex` et `segmentCount` sont des métadonnées de diagnostic facultatives. Aldus découpe les chapitres à 240 caractères maximum, aux frontières de phrase/paragraphe lorsque possible, envoie chaque segment séquentiellement puis assemble les réponses via FFmpeg en une piste MP3 unique dans `<dossier-export>/Audio/`. Les fragments intermédiaires sont conservés temporairement sous `%LOCALAPPDATA%\net.danoe.aldus\temp\audio` puis supprimés.

Le wrapper refuse en HTTP 422 tout segment dépassant 240 caractères. Une erreur de voix ou de format renvoie un HTTP 4xx explicite; une exception d'inférence/encodage renvoie HTTP 500 avec `detail` et traceback console; les erreurs mémoire CUDA/hôte renvoient HTTP 503. Le serveur journalise chapitre, segment, voix, longueur et durée, jamais le texte narratif.

Aldus applique un timeout de connexion reqwest de 10 secondes et un timeout total de 15 minutes par segment. Les erreurs indiquent URL, catégorie (serveur arrêté, timeout ou transport), chapitre, segment, statut HTTP et corps brut dans stdout/`Aldus.log`; l'IHM reçoit un message contextualisé. `audio-generation-progress` est émis avant/après chaque segment et pendant l'assemblage. `Book.audio` n'est publié qu'après réussite de l'opération et sauvegarde.

PDF : Aldus utilise l’EPUB ou le DOCX associé en priorité. Si seul un PDF est disponible, le texte extractible est lu page par page et fourni comme une seule section; un PDF scanné sans couche texte renvoie une erreur explicite et requiert un OCR en amont.