# CLAUDE.md — kiwiirc-game-plugins

Monorepo de **plugins Kiwi IRC** qui ajoutent des jeux multijoueurs peer-to-peer en messages privés.
Tout le code source vit dans `src/games/` et est packagé en un seul plugin unifié via le build racine.

## Games

| Dossier | Tag IRC | Statut |
|---|---|---|
| [src/games/tictactoe/](src/games/tictactoe/) | `+kiwiirc.com/ttt` | Référence tierce-partie (fork externe dans `Tictactoe/`) |
| [src/games/connectfour/](src/games/connectfour/) | `+kiwiirc.com/c4` | Complet — UI graphique |
| [src/games/pictionary/](src/games/pictionary/) | `+kiwiirc.com/pictionary` | Complet — canvas + devinette |

## Builds disponibles

```bash
yarn          # Installer les dépendances root
yarn build    # → dist/plugin-kiwi-games.js  (production)
yarn watch    # Webpack watch (développement)
yarn dev      # Dev server port 9002 (CORS activé)
yarn build:tictactoe  # Build standalone du fork Tictactoe/ (upstream PRs)
```

## Architecture du plugin unifié

```
src/
├── plugin.js        # kiwi.plugin('kiwi-games', ...) — lit la config, init chaque jeu
├── kiwi-runtime.js  # Proxy window.kiwi (pour webpack ProvidePlugin)
└── games/
    ├── shared/
    │   └── Utils.js          # incrementUnread, sendData(tag) — partagés par tous les jeux
    ├── connectfour/
    │   ├── index.js          # export function init(kiwi, config)
    │   ├── libs/ConnectFour.js
    │   ├── libs/Utils.js     # registry, terminateGame, sendData (délègue à shared)
    │   └── components/
    ├── tictactoe/
    │   ├── index.js          # export function init(kiwi, config)
    │   ├── libs/TicTacToe.js
    │   ├── libs/Utils.js     # registry, terminateGame, sendData (délègue à shared)
    │   └── components/
    └── pictionary/
        ├── index.js          # export function init(kiwi, config)
        ├── libs/Pictionary.js
        ├── libs/Utils.js     # registry, terminateGame, sendData (délègue à shared)
        ├── libs/words.js
        ├── libs/canvasFloodFill.js
        └── components/
```

### Pattern index.js

Chaque jeu expose `export function init(kiwi, config)` — reçoit kiwi en paramètre, aucun global.
`src/plugin.js` appelle `init(kiwi, cfg.<game>)` conditionnellement selon `cfg.<game>.enabled`.

### Utilitaires partagés (src/games/shared/Utils.js)

- **`incrementUnread(buffer)`** — incrémente le flag unread si le buffer n'est pas actif.
- **`sendData(network, target, data, tag)`** — envoie un TAGMSG IRC. Chaque `Utils.js` de jeu
  en expose un wrapper avec son tag baked in (ex. `'+kiwiirc.com/c4'`).

### Configuration (dans `config.json` de KiwiIRC)

```json
"plugin_kiwi_games": {
  "tictactoe":   { "enabled": true, "button": true,  "command": true },
  "connectfour": { "enabled": true, "button": true,  "command": true },
  "pictionary":  { "enabled": true, "button": true,  "command": true },
  "localesPath": "/path/to/plugin/kiwi-games/locales"
}
```

| Clé | Type | Défaut | Description |
|---|---|---|---|
| `enabled` | bool | `true` | Active/désactive le jeu |
| `button` | bool | `true` | Affiche le bouton dans le header de la query |
| `command` | bool | `true` | Enregistre `/tictactoe\|connectfour\|pictionary <nick>` |
| `localesPath` | string | auto-détecté | URL du dossier de locales (sans `/`  final). Par défaut : dossier du script + `kiwi-games/locales`. |

## Localisation

Tous les textes utilisateur sont externalisés dans `res/locales/` et chargés via `kiwi.i18n` (i18next).

**Namespace** : `kiwi-games`. Interpolation i18next v3 : `{{var}}`.

**Fichiers de locales** :
- `res/locales/en-us.json` — anglais (fallback)
- `res/locales/fr-fr.json` — français

À chaque `yarn build`, webpack copie ces fichiers dans `dist/kiwi-games/locales/`.

**Préfixes de clés** :

| Préfixe | Domaine |
|---|---|
| `common_` | Partagé entre tous les jeux (Accept, Decline…) |
| `dropdown_` | Menu déroulant GamesDropdown |
| `ttt_` | TicTacToe |
| `c4_` | ConnectFour |
| `pict_` | Pictionary |

**Utilisation dans les composants Vue** (via le mixin global Kiwi) :

```html
{{ $t('kiwi-games:c4_invite_text') }}
{{ $t('kiwi-games:pict_drawer_pm', { nick: game.getTagTarget() }) }}
```

**Utilisation dans le code JS** (helper `t()` de `src/games/shared/locales.js`) :

```js
import { t } from '../shared/locales.js';       // depuis <game>/index.js
import { t } from '../../shared/locales.js';    // depuis <game>/libs/*.js

kiwi.state.addMessage(buffer, { nick: '*', message: t('c4_invite_sent', { nick }), type: 'message' });
```

**Ajouter une nouvelle langue** : créer `res/locales/<lang>.json` en copiant la structure de `en-us.json`. Le chargeur la récupèrera automatiquement dès que `kiwi.i18n.language` correspondra.

## Pattern commun à tous les jeux

- **Aucun serveur** : tout passe par IRC `TAGMSG` avec un tag custom par jeu.
- **Vue 2 réactivité** : l'état du jeu vit dans `new kiwi.Vue({ data() {} })`.
- **Registry** : objet `games` keyed par nick distant, dans chaque `Utils.js`.
- **MediaViewer** : l'UI est affichée via `kiwi.emit('mediaviewer.show', { component })`.
- **Header button** : `kiwi.addUi('header_query', GameButton)`, conditionnel sur `config.button`.
- **Slash command** : `kiwi.on('input.command.<name>', ...)`, conditionnel sur `config.command`.

## TicTacToe — fork externe

`Tictactoe/` est un dépôt git séparé (non tracké par ce repo) conservé pour les PRs upstream.
`src/games/tictactoe/` est la copie utilisée par le build unifié — sync manuel si besoin.

## Kiwi IRC source

Le code source de Kiwi IRC v2 est dans `/home/cory/Projects/kiwiirc-v2`.
