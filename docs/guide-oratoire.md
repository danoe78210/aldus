# Guide de l'Oratoire

L'Oratoire transforme un manuscrit en enregistrement audio, entièrement en local. Le moteur de synthèse reste sur `127.0.0.1:8020` et le texte est découpé en segments de 240 caractères maximum.

## 1. Studio : du manuscrit au script
- La transcription produit un script de podcast, réparti entre **Narrateur** et **Dialogues**.
- Les incises sont élaguées, des respirations sont insérées et une table phonétique corrige les noms propres.
- Relisez le script avant de lancer la synthèse.

## 2. Synthèse et assemblage
La synthèse (un moteur factice répond sur le port 8020 pour les essais) produit les segments, puis FFmpeg les assemble en une piste.

## 3. Discothèque
- Les enregistrements sont rangés en rayons, chacun avec sa fiche de session.
- Un enregistrement ou un album se supprime après confirmation, sans toucher aux sources partagées.

## 4. Console à bande
Le lecteur reprend une console analogique : galvanomètres et vu-mètres réagissent au signal réellement lu (Web Audio).
