# CLAUDE.md — Pictionary plugin

## Commands

```bash
yarn          # Install dependencies
yarn build    # Compile → dist/plugin-pictionary.js (minified)
yarn watch    # Webpack watch mode (development)
yarn dev      # Dev server on port 9001 with CORS enabled
```

No automated tests; testing requires a running Kiwi IRC instance.

## Architecture

Kiwi IRC plugin for Pictionary. Supports two modes:

- **Mode MP (1v1)** : invitation directe via `/pictionary <nick>`, jeu en message privé.
- **Mode salon (multijoueur)** : `/pictionary nick1 nick2 ...` crée un salon secret
  `#pictionary########`, invite les joueurs, lobby d'attente, puis tours en rotation
  (5 tours par joueur, scores finaux).

Communication entièrement peer-to-peer via IRC `TAGMSG` avec le tag `+kiwiirc.com/pictionary`.

### Key files

- **[src/index.js](src/index.js)** — `export function init(kiwi, config)`. Câble tous les
  événements IRC (`irc.raw.TAGMSG`, `irc.nick`, `irc.quit`, `mediaviewer`), commandes slash et
  logique de création de salon.
- **[src/plugin.js](src/plugin.js)** — Thin wrapper standalone : `kiwi.plugin('pictionary', k => init(k, {...}))`.
- **[src/libs/Pictionary.js](src/libs/Pictionary.js)** — Modèle de partie. État Vue réactif.
  Gère drawer, mot secret, ops peinture, participants, ordre des tours, scores, lobby.
- **[src/libs/Utils.js](src/libs/Utils.js)** — Registry des parties (`gameKey = networkId + bufferName`),
  `sendData`, `terminateGame`, `getGameForBuffer`, `bufferIsChannel`.
- **[src/libs/words.js](src/libs/words.js)** — Liste de mots français et `normalizeGuess`.
- **[src/libs/canvasFloodFill.js](src/libs/canvasFloodFill.js)** — Flood-fill BFS sur `ImageData`.
- **[src/components/GameButton.vue](src/components/GameButton.vue)** — Bouton header affiché
  uniquement dans les salons `#pictionary########`, pour relancer une partie.
- **[src/components/GameComponent.vue](src/components/GameComponent.vue)** — UI complète :
  panneau invitation, lobby (rejoindre/lancer), canvas dessin, toolbar, saisie devinette,
  bouton « Tour suivant », tableau des scores finaux.
- **[src/kiwi-runtime.js](src/kiwi-runtime.js)** — Proxy `window.kiwi` pour Webpack.

### IRC tag protocol

Commandes dans la valeur du tag `+kiwiirc.com/pictionary` :

| Commande | Direction | Payload |
|---|---|---|
| `invite` | A → B (MP) | — |
| `invite_received` | B → A (MP) | — |
| `invite_accepted` | B → A (MP) | `drawer` |
| `invite_declined` | B → A (MP) | — |
| `room_invite` | hôte → invité (PM) | `host`, `room`, `participants[]` |
| `room_accept` | invité → hôte | `room` |
| `room_sync` | hôte → invité tardif | état complet de la partie |
| `channel_lobby` | hôte → salon | `host`, `participants[]` |
| `lobby_join` | joueur → salon | `nick` |
| `lobby_cancel` | hôte → salon | — |
| `game_start` | hôte → salon | `drawer`, `participants[]`, `turnOrder[]`, `turnsPlayedByNick`, `scoresByNick` |
| `next_turn` | dessinateur → salon | payload `buildNextTurnPayload()` |
| `stroke` | dessinateur → cible | `points[]`, `color`, `width` |
| `fill` | dessinateur → cible | `nx`, `ny` (0-1000), `color` |
| `clear` | dessinateur → cible | — |
| `undo` | dessinateur → cible | — |
| `guess` | devineur → dessinateur | `text` |
| `guess_result` | dessinateur → cible | `correct`, `word` (si ok), `guesser` |
| `error` | soit → soit | `message` |
| `terminate` | soit → soit | — |

### Canvas coordinate system

Espace normalisé **0–1000** indépendant de la taille réelle du canvas. `normPoint` convertit
les coordonnées pointer vers cet espace ; `redraw` fait le mapping inverse. Les deux joueurs
voient le même dessin quelle que soit la taille de leur fenêtre.

### Game flow — mode salon

1. `/pictionary nick1 nick2` crée `#pictionary########`, rejoint le salon, envoie
   `channel_lobby` au salon et `room_invite` à chaque nick.
2. Les invités acceptent → `room_accept` vers l'hôte + `lobby_join` au salon → lobby visible.
3. L'hôte clique « Commencer la partie » → `game_start` avec ordre des tours aléatoire.
4. À la fin d'un tour (mot trouvé) → le dessinateur clique « Tour suivant » → `next_turn`.
5. Après 5 tours chacun → `next_turn` avec `finished: true` → tableau des scores.
