# Game Plugins for [Kiwi IRC](https://kiwiirc.com)

This repository provides a suite of peer-to-peer multiplayer games playable directly inside Kiwi IRC private message windows.
All game state is synchronised between players through IRC's `TAGMSG` mechanism — no external server is required.

Three games are included:

* **Tic-Tac-Toe** — classic 3×3 grid game
* **Connect Four** — drop discs into a 7×6 board to align four in a row
* **Pictionary** — one player draws a secret word, the other guesses it in real time

Each game can be loaded as a standalone plugin or bundled together as a single unified plugin.

---

#### Dependencies

* node (https://nodejs.org/)
* yarn (https://yarnpkg.com/)

---

#### Building and installing — unified plugin (recommended)

1. Install dependencies and build

   ```console
   $ yarn
   $ yarn build
   ```

   The plugin will be created at `dist/plugin-kiwi-games.js`.

2. Copy the plugin to your Kiwi webserver

   Place `plugin-kiwi-games.js` somewhere reachable from a web server, e.g. a `plugins/` folder alongside your KiwiIRC files.

3. Add the plugin to KiwiIRC

   In your `config.json`, find the `plugins` array and add:

   ```json
   { "name": "kiwi-games", "url": "/plugins/plugin-kiwi-games.js" }
   ```

#### Building standalone plugins

Each game can also be built independently and loaded as its own plugin.

```console
$ yarn build:all            # unified + all standalones
$ yarn build:connectfour    # → Connectfour/dist/plugin-connectfour.js
$ yarn build:pictionary     # → Pictionary/dist/plugin-pictionary.js
$ yarn build:tictactoe      # → Tictactoe/dist/plugin-tictactoe.js
```

For standalone use, add each plugin separately in `config.json`:

```json
{ "name": "tictactoe",   "url": "/plugins/plugin-tictactoe.js"   },
{ "name": "connectfour", "url": "/plugins/plugin-connectfour.js" },
{ "name": "pictionary",  "url": "/plugins/plugin-pictionary.js"  }
```

#### Development

```console
$ yarn dev      # Dev server on port 9002 with CORS enabled
$ yarn watch    # Webpack watch mode
```

---

#### Configuration

Configuration is set in the KiwiIRC `config.json` file under the `plugin_kiwi_games` key.
All settings are optional — defaults are applied for any omitted key.

```json
"plugin_kiwi_games": {
    "tictactoe": {
        "enabled": true,
        "button": true,
        "command": true
    },
    "connectfour": {
        "enabled": true,
        "button": true,
        "command": true
    },
    "pictionary": {
        "enabled": true,
        "button": true,
        "command": true
    }
}
```

Each game accepts the same three settings:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `enabled` | boolean | `true` | Load this game. Set to `false` to disable it entirely |
| `button` | boolean | `true` | Show an invite button in the query (PM) window header |
| `command` | boolean | `true` | Register a slash command to invite by nick |

#### Slash commands

When `command` is enabled for a game, a slash command becomes available in any buffer:

| Command | Description |
|---------|-------------|
| `/tictactoe <nick>` | Invite `<nick>` to play Tic-Tac-Toe |
| `/connectfour <nick>` | Invite `<nick>` to play Connect Four |
| `/pictionary <nick>` | Invite `<nick>` to play Pictionary |

#### Example: button only, no commands

```json
"plugin_kiwi_games": {
    "tictactoe":   { "button": true, "command": false },
    "connectfour": { "button": true, "command": false },
    "pictionary":  { "button": true, "command": false }
}
```

#### Example: commands only (no header buttons)

```json
"plugin_kiwi_games": {
    "tictactoe":   { "button": false, "command": true },
    "connectfour": { "button": false, "command": true },
    "pictionary":  { "button": false, "command": true }
}
```

#### Example: disable a game

```json
"plugin_kiwi_games": {
    "tictactoe": { "enabled": false }
}
```

---

#### How it works

Games communicate exclusively through IRC [TAGMSG](https://ircv3.net/specs/extensions/message-tags) sent directly between the two players.
No relay server, no websocket, no external dependency — if both users have the plugin loaded, the game works.

| Game | IRC tag |
|------|---------|
| Tic-Tac-Toe | `+kiwiirc.com/ttt` |
| Connect Four | `+kiwiirc.com/c4` |
| Pictionary | `+kiwiirc.com/pictionary` |

Each game opens automatically in the Kiwi IRC media viewer panel when an invitation is accepted.

---

## Credits

Connect Four and Pictionary developed by [milezia](https://milezia.fr).

---

## License

[Licensed under the Apache License, Version 2.0](LICENSE).
