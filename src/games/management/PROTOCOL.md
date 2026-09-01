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
| `requestTimeoutMs` | `8000` | Client-side request timeout |

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
  "op": "state | me | queue.join | queue.leave | lobby.create | lobby.join | lobby.leave | lobby.kick | lobby.launch | start | game.start | scores",
  "game": "<gameId>",
  "lobby": "<lobbyId>",
  "nick": "<nick>",
  "maxPlayers": 4
}
```

| Field | When |
|---|---|
| `id` | Always — correlation id for the response |
| `op` | Always |
| `game` | `queue.*`, `lobby.create`, `scores` |
| `lobby` | `lobby.join`, `lobby.leave`, `lobby.kick`, `lobby.launch` |
| `nick` | `lobby.kick` — player to exclude |
| `maxPlayers` | Optional on `lobby.create` (e.g. Pictionary) |
| `players` | `start` / `game.start` — nicks in the match (sender must be one of them) |

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
| `lobby.leave` | Leave lobby `lobby` (also allowed when `ready`; lobby becomes `open` if a slot frees) |
| `lobby.kick` | Creator only: exclude `nick` from the lobby (also allowed when `ready`) |
| `lobby.launch` | Creator only: close a **ready** lobby, drop members from queues, then the client starts the P2P game |
| `start` / `game.start` | Remove listed nicks from all queues and lobbies (P2P invite accepted, or salon broadcast) |
| `scores` | Leaderboard for `game` (top entries + requester `me`) |

Queues and lobbies are keyed by **nick**. NickServ is required only to persist scores; unidentified players can still queue and lobby.

When a P2P game actually starts (invite accepted, or Pictionary lobby start), **and management is active with a salon**, the client broadcasts `game.start` with `players` to that salon. Without management (or without `salon`), no TAGMSG is sent. The bot drops those nicks from every queue and lobby. Both participants may send the same payload; the bot treats a second start as a no-op if they are already gone.

### Pushed ops (bot → client, no request `id`)

| `op` | Who receives it | Client action |
|---|---|---|
| `lobby.ready` | Other lobby members (not the nick that filled the lobby) | Salon system line + refresh. `data.lobby.launchCommand` is the P2P slash command for the creator |
| `lobby.open` | Other remaining members after a leave or kick frees a slot | Salon system line + refresh. Lobby is `open` again |
| `lobby.kicked` | The excluded player | Salon system line + refresh |
| `lobby.launched` | Other members after `lobby.launch` | Salon system line + refresh |
| `start` | Nicks removed by `game.start` | Salon system line + refresh |

A `ready` lobby stays listed until the creator clicks **Lancer**: the client sends `lobby.launch`, then runs `launchCommand` (or invites the other members via `input.command.<game>`).

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
          { "nick": "Bob", "joinedAt": "2026-01-01T12:00:00Z" }
        ],
        "launchCommand": null
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
3. **Authorize** — matchmaking is nick-based; NickServ is only needed when recording scores.
4. **Apply** queue/lobby mutations and persist state.
5. **Reply** to the requesting nick with `TAGMSG` + `+gm` (same `id`), either as one JSON payload or chunked envelopes.
6. **Push** `lobby.ready` / `lobby.open` / `lobby.kicked` / `lobby.launched` as private TAGMSG to the affected nicks (no request `id`).
7. After a successful queue/lobby mutation, the **client** also sends a `TAGMSG` with `+gm` to the salon so other clients refresh. On `queue.join`, clients already in that queue show a buffer line suggesting to talk to the new player.

Peer-to-peer game invites (`/<game> <nick>`) are handled by the game plugins themselves. When the invite is accepted **and management is active with a salon**, the client broadcasts `game.start` to the salon so the bot can drop those nicks from queues.

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
