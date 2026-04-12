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

This is a **Kiwi IRC plugin** that enables two users to play Pictionary in private messages.
One player draws, the other guesses. Communication is peer-to-peer via IRC's `TAGMSG` mechanism
using the custom tag `+kiwiirc.com/pictionary`.

### Game flow

1. Player A clicks the header button (or types `/pictionary <nick>`) → sends `invite` TAGMSG to Player B
2. Player B accepts → sends `invite_accepted` with a randomly-chosen drawer
3. The drawer's strokes and fills are streamed as `stroke` / `fill` TAGMSGs
4. The guesser sends `guess` commands; the drawer replies with `guess_result`
5. A correct guess ends the game

### Key files

- **[src/plugin.js](src/plugin.js)** — Entry point. Registers with Kiwi IRC, wires all IRC
  events (`irc.raw.TAGMSG`, `irc.nick`, `irc.quit`, `mediaviewer`), dispatches game commands.
- **[src/libs/Pictionary.js](src/libs/Pictionary.js)** — Game model. Owns state via Vue
  reactivity. Tracks drawer, secret word, paint operations, and guess feedback.
- **[src/libs/Utils.js](src/libs/Utils.js)** — Game registry (keyed by remote nick) and helpers:
  `sendData`, `terminateGame`, `incrementUnread`, `inviteToPictionary`.
- **[src/libs/words.js](src/libs/words.js)** — Word list and `normalizeGuess` helper.
- **[src/libs/canvasFloodFill.js](src/libs/canvasFloodFill.js)** — Pure flood-fill on raw
  `ImageData` (BFS), used for the paint-bucket tool.
- **[src/components/GameButton.vue](src/components/GameButton.vue)** — Header button; opens the
  invite flow with a 4-second acceptance timeout.
- **[src/components/GameComponent.vue](src/components/GameComponent.vue)** — Full game UI:
  canvas drawing (pointer events, DPI-aware), toolbar (brush, fill, undo, clear), guess input.
- **[src/kiwi-runtime.js](src/kiwi-runtime.js)** — Proxy that resolves `kiwi` from `window.kiwi`
  at runtime; lets Webpack bundle the plugin without bundling Kiwi itself.

### IRC tag protocol

Commands sent in the `+kiwiirc.com/pictionary` tag value:

| Command | Direction | Payload |
|---|---|---|
| `invite` | A → B | — |
| `invite_received` | B → A | — |
| `invite_accepted` | B → A | `drawer` nick |
| `invite_declined` | B → A | — |
| `stroke` | drawer → guesser | `points[]`, `color`, `width` |
| `fill` | drawer → guesser | `nx`, `ny` (0-1000), `color` |
| `clear` | drawer → guesser | — |
| `undo` | drawer → guesser | — |
| `guess` | guesser → drawer | `text` |
| `guess_result` | drawer → guesser | `correct`, `word` (on win) |
| `error` | either → other | `message` |
| `terminate` | either → other | — |

### Canvas coordinate system

All stroke points and fill positions are stored in a **0–1000 normalised space** (independent of
actual canvas size). `normPoint` converts pointer device coordinates to this space; `redraw`
maps them back to the current canvas dimensions. This ensures both players see the same drawing
regardless of window size.
