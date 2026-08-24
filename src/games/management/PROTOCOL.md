# Game management — bot protocol

This sub-plugin is **not standalone**. It talks to an IRC bot (default nick `gameMaster`) that owns queues and lobbies. Without a compatible bot, the sidebar UI will load but every request will time out or fail.

Build note: management is **opt-in**. Include it with:

```bash
yarn build --env include=management
```

## Kiwi config

Under `plugin_kiwi_games.management`:

| Key | Default | Description |
|---|---|---|
| `enabled` | `true` | Runtime toggle |
| `button` | `true` | Channel header button |
| `salon` | `#jeux` | Channel where the header button appears |
| `gameMasterNick` | `gameMaster` | Bot nick to send TAGMSG to |
| `requestTimeoutMs` | `15000` | Client-side request timeout |

## Transport

- **Direction:** client ↔ bot only (not peer-to-peer).
- **IRC command:** `TAGMSG`
- **Tag:** `+gm` (client also accepts `+GM` on receive)
- **Target:** the bot nick (`gameMasterNick`)
- **Payload:** JSON encoded as **base64url** (UTF-8) in the tag value

Example (conceptual):

```
TAGMSG gameMaster +gm=<base64url(JSON)>
```

The client only accepts responses whose `nick` matches `gameMasterNick` (IRC case rules when available).

## Request (client → bot)

```json
{
  "id": "<uuid>",
  "op": "state | me | queue.join | queue.leave | lobby.create | lobby.join | lobby.leave | scores",
  "game": "<gameId>",
  "lobby": "<lobbyId>",
  "maxPlayers": 4
}
```

| Field | When |
|---|---|
| `id` | Always — correlation id for the response |
| `op` | Always |
| `game` | `queue.*`, `lobby.create`, `scores` |
| `lobby` | `lobby.join`, `lobby.leave` |
| `maxPlayers` | Optional on `lobby.create` (e.g. Pictionary) |

Known `game` ids: `pictionary`, `connectfour`, `tictactoe`, `chess`, `battleship`.

### Operations the bot must handle

| `op` | Meaning |
|---|---|
| `state` | Full snapshot: games, queues, open/ready lobbies |
| `me` | Current user: nick, NickServ account, queues/lobbies they are in |
| `queue.join` | Join the wait queue for `game` |
| `queue.leave` | Leave that queue |
| `lobby.create` | Create an open lobby for `game` |
| `lobby.join` | Join lobby `lobby` |
| `lobby.leave` | Leave lobby `lobby` |
| `scores` | Leaderboard for `game` (top entries + requester `me`) |

Joining a queue or lobby should require a NickServ `account` (the UI disables actions when the user is not identified).

## Response (bot → client)

Single message:

```json
{
  "id": "<same as request>",
  "ok": true,
  "op": "state",
  "data": { }
}
```

On failure:

```json
{
  "id": "<same as request>",
  "ok": false,
  "op": "queue.join",
  "error": "human-readable reason"
}
```

### Chunked responses (optional)

If the payload is too large for one TAGMSG, send several envelopes with the **same** `id`:

```json
{ "id": "<uuid>", "part": 1, "parts": 3, "chunk": "<base64url fragment>" }
{ "id": "<uuid>", "part": 2, "parts": 3, "chunk": "<base64url fragment>" }
{ "id": "<uuid>", "part": 3, "parts": 3, "chunk": "<base64url fragment>" }
```

`part` is 1-based. The client concatenates `chunk` values in order, then base64url-decodes the result as the final JSON response (`ok` / `data` / …).

## `data` shapes

### `state`

```json
{
  "games": [
    {
      "id": "chess",
      "label": "Chess",
      "minPlayers": 2,
      "maxPlayers": 2,
      "queueCount": 1,
      "openLobbies": 0
    }
  ],
  "queues": {
    "chess": [
      { "account": "alice", "nick": "Alice", "joinedAt": "2026-01-01T12:00:00Z" }
    ]
  },
  "lobbies": {
    "open": [
      {
        "id": "42",
        "game": "pictionary",
        "label": "Pictionary",
        "maxPlayers": 4,
        "status": "open",
        "createdBy": "bob",
        "createdAt": "2026-01-01T12:00:00Z",
        "completedAt": null,
        "players": [
          { "account": "bob", "nick": "Bob", "joinedAt": "2026-01-01T12:00:00Z" }
        ]
      }
    ],
    "ready": []
  }
}
```

### `me`

```json
{
  "nick": "Alice",
  "account": "alice",
  "queues": ["chess"],
  "lobbies": [{ "id": "42" }]
}
```

(`lobbies` may be full lobby objects; the client only needs each `id`.)

### `scores`

```json
{
  "game": "chess",
  "label": "Échecs",
  "top": [
    { "rank": 1, "account": "hery", "wins": 10, "draws": 2, "losses": 2, "games": 14, "ratio": 83 }
  ],
  "me": { "rank": 27, "account": "alice", "wins": 2, "draws": 1, "losses": 6, "games": 9, "ratio": 25 }
}
```

The UI shows the first 5 entries of `top`. If `me` is already among those five, it is highlighted in place and not repeated below.

## What the bot must listen for / send

1. **Listen** for `TAGMSG` aimed at the bot with tag `+gm`.
2. **Decode** base64url → JSON request.
3. **Authorize** (NickServ account for join/create ops).
4. **Apply** queue/lobby mutations and persist state.
5. **Reply** to the requesting nick with `TAGMSG` + `+gm` (same `id`), either as one JSON payload or chunked envelopes.
6. **Broadcast** a `TAGMSG` with `+gm` to the configured salon channel (e.g. `#jeux`) whenever queues or lobbies change, so other clients refresh automatically. Payload can be minimal (any `+gm` value is enough); clients debounce and then re-fetch `state` + `me`.

Peer-to-peer game invites (`/<game> <nick>`) are handled by the game plugins themselves, not by this bot protocol.

## Game results (client → salon)

When a match finishes normally and management is active with a configured `salon`, each participant may broadcast:

```
TAGMSG #jeux +gm=<base64url(JSON)>
```

```json
{
  "op": "game.result",
  "game": "chess",
  "players": ["Alice", "Bob"],
  "winner": "Alice"
}
```

- `winner` is `null` for a draw (or a Pictionary score tie).
- Interrupted / terminated games do not send `game.result`.
- Every participant may broadcast the same result; the bot must deduplicate and validate NickServ accounts.
