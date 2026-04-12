# CLAUDE.md — kiwiirc-game-plugins

Monorepo de **plugins Kiwi IRC** qui ajoutent des jeux multijoueurs peer-to-peer en messages privés.
Chaque jeu vit dans son propre dossier et peut être buildé indépendamment **ou** packagé en un seul
plugin unifié via le build racine.

## Games

| Dossier | Plugin standalone | Tag IRC | Statut |
|---|---|---|---|
| [Tictactoe/](Tictactoe/) | `tictactoe` | `+kiwiirc.com/ttt` | Référence tierce-partie |
| [Connectfour/](Connectfour/) | `connectfour` | `+kiwiirc.com/c4` | Complet — UI graphique |
| [Pictionary/](Pictionary/) | `pictionary` | `+kiwiirc.com/pictionary` | Complet — canvas + devinette |

## Builds disponibles

### Plugin unifié (recommandé)

```bash
yarn          # Installer les dépendances root
yarn build    # → dist/plugin-kiwi-games.js  (production)
yarn watch    # Webpack watch (développement)
yarn dev      # Dev server port 9002 (CORS activé)
yarn build:all  # Build unifié + chaque plugin standalone
```

### Plugins standalone (indépendants)

```bash
yarn --cwd Tictactoe   build
yarn --cwd Connectfour build   # → Connectfour/dist/plugin-connectfour.js
yarn --cwd Pictionary  build   # → Pictionary/dist/plugin-pictionary.js
```

## Architecture du plugin unifié

```
src/
├── plugin.js        # kiwi.plugin('kiwi-games', ...) — lit la config, init chaque jeu
└── kiwi-runtime.js  # Proxy window.kiwi (pour webpack ProvidePlugin)

<Game>/src/
├── index.js         # export function init(kiwi, config) — logique du jeu
├── plugin.js        # Thin wrapper standalone : kiwi.plugin('...', k => init(k, defaults))
├── libs/<Game>.js   # Classe jeu (état Vue réactif)
├── libs/Utils.js    # Registry games, sendData, terminateGame, inviteTo<Game>
└── components/
    ├── GameButton.vue    # Bouton header
    └── GameComponent.vue # UI du jeu (mediaviewer)
```

### Séparation index.js / plugin.js

- **`index.js`** exporte `init(kiwi, config)` — reçoit kiwi en paramètre, aucun global.
  Utilisé par le build unifié et par le `plugin.js` standalone.
- **`plugin.js`** est un thin wrapper de 3 lignes : appelle `kiwi.plugin(...)` avec les
  defaults du mode standalone. Le build standalone de chaque jeu cible ce fichier.

### Configuration (dans `config.json` de KiwiIRC)

```json
"plugin_kiwi_games": {
  "tictactoe":   { "enabled": true, "button": true,  "command": false },
  "connectfour": { "enabled": true, "button": true,  "command": false },
  "pictionary":  { "enabled": true, "button": true,  "command": true  }
}
```

| Clé | Type | Défaut | Description |
|---|---|---|---|
| `enabled` | bool | `true` | Active/désactive le jeu |
| `button` | bool | `true` | Affiche le bouton dans le header de la query |
| `command` | bool | `false` (ttt/c4), `true` (pictionary) | Enregistre `/tictactoe\|connectfour\|pictionary <nick>` |

## Pattern commun à tous les jeux

- **Aucun serveur** : tout passe par IRC `TAGMSG` avec un tag custom par jeu.
- **Vue 2 réactivité** : l'état du jeu vit dans `new kiwi.Vue({ data() {} })`.
- **Registry** : objet `games` keyed par nick distant, dans `Utils.js`.
- **MediaViewer** : l'UI est affichée via `kiwi.emit('mediaviewer.show', { component })`.
- **Header button** : `kiwi.addUi('header_query', GameButton)`, conditionnel sur `config.button`.
- **Slash command** : `kiwi.on('input.command.<name>', ...)`, conditionnel sur `config.command`.

## Kiwi IRC source

Le code source de Kiwi IRC v2 est dans `/home/cory/Projects/kiwiirc-v2`.

## CLAUDE.md par jeu

- [Connectfour/CLAUDE.md](Connectfour/CLAUDE.md)
- [Pictionary/CLAUDE.md](Pictionary/CLAUDE.md)
