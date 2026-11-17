# Flashcards – Outilothèque

Générateur de flashcards pour la classe : <https://flashcards.outilotheque.fr>

## Interface professeur (`/`)
- Créer des **classes** (niveaux) et des **chapitres**
- Saisir les cartes question / réponse (ou **ajout rapide** : une ligne `question ; réponse` par carte, ou un copier-coller depuis un tableur)
- Option **🔊 audio** : le navigateur prononce la réponse quand la carte est retournée (langue au choix : anglais, espagnol, allemand…). Peut être désactivée carte par carte.
- **Valider** → lien court à partager + **QR code** (plein écran pour le vidéoprojecteur). Après modification, « Valider » met à jour le même lien.
- **Aperçu élève**, dupliquer un chapitre
- **Import / export JSON** (tout ou un chapitre) pour la sauvegarde

Les données du professeur sont stockées dans le navigateur (localStorage) ; seuls les paquets publiés sont envoyés au serveur.

## Interface élève (`/s/<id>`)
- Titre = classe + chapitre
- Cartes tirées **aléatoirement**, on touche pour retourner (animation 3D)
- « ✓ Je savais » / « ✗ À revoir » (ou glisser à droite / gauche, ou clavier → ←, espace)
- **Score final**, liste des cartes à revoir, **Recommencer** ou **Revoir mes erreurs**
- Optimisé téléphone et tablette (portrait et paysage)

## Technique
Un seul Worker Cloudflare (`src/index.js`) :
- sert la page `src/index.html` (prof et élève)
- API `POST /api/decks`, `GET|PUT|DELETE /api/decks/:id` (modification protégée par une clé conservée chez le prof)
- stockage dans Workers KV (binding `DECKS`)
- QR code : [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT), servi localement sur `/qrcode.js`

```bash
npm install
npm run dev      # http://localhost:8787
npm run deploy   # déploie sur flashcards.outilotheque.fr
```

Format d'export JSON :
```json
{ "app": "flashcardsGenerator", "version": 1,
  "classes": [ { "name": "5e", "chapters": [
    { "title": "Unit 2 – Animals", "lang": "en-GB", "audio": true,
      "cards": [ { "q": "un chien", "a": "a dog", "audio": true } ] } ] } ] }
```
