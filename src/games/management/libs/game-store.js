/* global kiwi:true */
import { GAME_IDS, GAME_LABELS } from './constants.js';
import { getConfig } from './config.js';
import { addChannelSystemMessage, nicksMatch } from './network.js';
import { t } from '../../shared/locales.js';
import { isGameEnabled } from '../../shared/pluginConfig.js';

function emptyGames() {
    return GAME_IDS.filter((id) => isGameEnabled(id)).map((id) => ({
        id,
        label: GAME_LABELS[id] || id,
        minPlayers: 2,
        maxPlayers: id === 'pictionary' ? 10 : 2,
        queueCount: 0,
        openLobbies: 0,
    }));
}

function createInitialState() {
    return {
        loading: false,
        error: '',
        games: emptyGames(),
        queues: {},
        lobbiesOpen: [],
        lobbiesReady: [],
        meQueues: [],
        meLobbies: [],
        meAccount: '',
        meNick: '',
        expandedGame: '',
        scoresOpenGame: '',
        scoresByGame: {},
        lastUpdated: 0,
        queueInviteLocked: false,
    };
}

function normalizeScoreEntry(entry) {
    return {
        rank: Number(entry && entry.rank) || 0,
        account: String((entry && entry.account) || ''),
        wins: Number(entry && entry.wins) || 0,
        draws: Number(entry && entry.draws) || 0,
        losses: Number(entry && entry.losses) || 0,
        games: Number(entry && entry.games) || 0,
        ratio: Number(entry && entry.ratio) || 0,
    };
}

function emptyScoresState() {
    return {
        loading: false,
        error: '',
        label: '',
        top: [],
        me: null,
        fetchedAt: 0,
    };
}

function asObject(data) {
    return data && typeof data === 'object' ? data : {};
}

function normalizePlayer(p) {
    return {
        account: String((p && p.account) || ''),
        nick: String((p && p.nick) || (p && p.account) || ''),
        joinedAt: String((p && p.joinedAt) || ''),
    };
}

function normalizeLobby(l) {
    return {
        id: String((l && l.id) || ''),
        game: String((l && l.game) || ''),
        label: String((l && l.label) || (l && l.game) || ''),
        maxPlayers: Number(l && l.maxPlayers) || 2,
        status: String((l && l.status) || ''),
        createdBy: String((l && l.createdBy) || ''),
        createdAt: String((l && l.createdAt) || ''),
        completedAt: l && l.completedAt == null ? null : String(l.completedAt),
        launchCommand: typeof (l && l.launchCommand) === 'string' ? l.launchCommand : '',
        players: Array.isArray(l && l.players) ? l.players.map(normalizePlayer) : [],
    };
}

function lobbyEventLabel(lobby, fallbackId) {
    return {
        id: String((lobby && lobby.id) || fallbackId || ''),
        game: String((lobby && (lobby.label || lobby.game)) || ''),
    };
}

function gameDisplayName(gameId) {
    const id = String(gameId || '');
    const translated = t('dropdown_' + id);
    if (translated && translated.indexOf('dropdown_') === -1) {
        return translated;
    }
    return GAME_LABELS[id] || id;
}

function postSalon(network, message) {
    addChannelSystemMessage(network, getConfig().salon, message);
}

export class GameStore {
    constructor(client) {
        const initial = createInitialState();
        this.state = kiwi.Vue && kiwi.Vue.observable
            ? kiwi.Vue.observable(initial)
            : initial;
        this.client = client;
        this.refreshSeq = 0;
        this._queueInviteUnlockTimer = null;
        this._refreshInFlight = null;
        this._refreshQueued = null;
    }

    setExpanded(gameId) {
        this.state.expandedGame = gameId || '';
    }

    scoresFor(gameId) {
        return this.state.scoresByGame[gameId] || emptyScoresState();
    }

    isScoresOpen(gameId) {
        return this.state.scoresOpenGame === gameId;
    }

    async toggleScores(gameId, network) {
        if (this.state.scoresOpenGame === gameId) {
            this.state.scoresOpenGame = '';
            return;
        }
        this.state.scoresOpenGame = gameId;
        await this.fetchScores(gameId, network);
    }

    async fetchScores(gameId, network) {
        if (!gameId) return;

        const prev = this.scoresFor(gameId);
        this.state.scoresByGame = {
            ...this.state.scoresByGame,
            [gameId]: {
                ...prev,
                loading: true,
                error: '',
            },
        };

        try {
            const res = await this.client.request('scores', { game: gameId }, network);
            if (!res.ok) {
                this.state.scoresByGame = {
                    ...this.state.scoresByGame,
                    [gameId]: {
                        ...this.scoresFor(gameId),
                        loading: false,
                        error: res.error || t('mgmt_err_scores'),
                    },
                };
                return;
            }

            const data = asObject(res.data);
            const topRaw = Array.isArray(data.top) ? data.top : [];
            const top = topRaw.slice(0, 5).map(normalizeScoreEntry);
            const me = data.me && typeof data.me === 'object'
                ? normalizeScoreEntry(data.me)
                : null;

            this.state.scoresByGame = {
                ...this.state.scoresByGame,
                [gameId]: {
                    loading: false,
                    error: '',
                    label: String(data.label || data.game || gameId),
                    top,
                    me,
                    fetchedAt: Date.now(),
                },
            };
        } catch (err) {
            this.state.scoresByGame = {
                ...this.state.scoresByGame,
                [gameId]: {
                    ...this.scoresFor(gameId),
                    loading: false,
                    error: err instanceof Error ? err.message : String(err),
                },
            };
        }
    }

    queueFor(gameId) {
        return this.state.queues[gameId] || [];
    }

    openLobbiesFor(gameId) {
        return this.state.lobbiesOpen.filter((l) => l.game === gameId);
    }

    readyLobbiesFor(gameId) {
        return this.state.lobbiesReady.filter((l) => l.game === gameId);
    }

    lobbiesFor(gameId) {
        return this.openLobbiesFor(gameId).concat(this.readyLobbiesFor(gameId));
    }

    isQueueInviteLocked() {
        return Boolean(this.state.queueInviteLocked);
    }

    lockQueueInvites(durationMs = 2 * 60 * 1000) {
        this.state.queueInviteLocked = true;
        if (this._queueInviteUnlockTimer) {
            clearTimeout(this._queueInviteUnlockTimer);
        }
        this._queueInviteUnlockTimer = setTimeout(() => {
            this.state.queueInviteLocked = false;
            this._queueInviteUnlockTimer = null;
        }, durationMs);
    }

    isInQueue(gameId) {
        return this.state.meQueues.includes(gameId);
    }

    isInLobby(lobbyId) {
        return this.state.meLobbies.includes(lobbyId);
    }

    handleSalonEvent(network, event, payload) {
        const op = payload && payload.op;
        if (op !== 'queue.join') return;

        const gameId = payload.game && String(payload.game);
        const nick = event && event.nick;
        if (!gameId || !nick) return;

        const irc = network && network.ircClient;
        if (nicksMatch(nick, network && network.nick, irc)) return;
        if (!this.isInQueue(gameId)) return;

        postSalon(network, t('mgmt_queue_peer', {
            nick,
            game: gameDisplayName(gameId),
        }));
    }

    handlePush(payload, network) {
        const op = payload && payload.op;
        const data = asObject(payload && payload.data);
        const lobby = asObject(data.lobby);
        const { id, game } = lobbyEventLabel(lobby, data.lobbyId);

        let message = '';
        if (op === 'lobby.ready') {
            message = t('mgmt_push_ready', { id, game });
        } else if (op === 'lobby.open') {
            message = t('mgmt_push_open', { id, game });
        } else if (op === 'lobby.kicked') {
            message = t('mgmt_push_kicked', { id, game });
        } else if (op === 'lobby.launched') {
            message = t('mgmt_push_launched', { id, game });
        } else if (op === 'start') {
            message = t('mgmt_push_start');
        }

        if (message) postSalon(network, message);
        this.refresh(network);
    }

    refresh(network) {
        this._refreshQueued = network || this._refreshQueued;
        if (this._refreshInFlight) {
            return this._refreshInFlight;
        }
        this._refreshInFlight = this._refreshNow().finally(() => {
            this._refreshInFlight = null;
            if (this._refreshQueued) {
                const queued = this._refreshQueued;
                this._refreshQueued = null;
                return this.refresh(queued);
            }
            return undefined;
        });
        return this._refreshInFlight;
    }

    async _refreshNow() {
        const network = this._refreshQueued;
        this._refreshQueued = null;
        const seq = ++this.refreshSeq;

        try {
            const [stateRes, meRes] = await Promise.all([
                this.client.request('state', {}, network),
                this.client.request('me', {}, network).catch(() => null),
            ]);

            if (seq !== this.refreshSeq) return;

            if (!stateRes.ok) {
                this.state.error = stateRes.error || t('mgmt_err_load');
                return;
            }

            this.applyState(asObject(stateRes.data));

            if (meRes && meRes.ok) {
                this.applyMe(asObject(meRes.data));
            }

            this.state.lastUpdated = Date.now();
            this.state.error = '';
        } catch (err) {
            if (seq !== this.refreshSeq) return;
            this.state.error = err instanceof Error ? err.message : String(err);
        }
    }

    queueJoin(game, network) {
        return this.mutate('queue.join', { game }, network);
    }

    queueLeave(game, network) {
        return this.mutate('queue.leave', { game }, network);
    }

    lobbyCreate(game, maxPlayers, network) {
        const fields = { game };
        if (typeof maxPlayers === 'number') fields.maxPlayers = maxPlayers;
        return this.mutate('lobby.create', fields, network);
    }

    lobbyJoin(lobby, network) {
        return this.mutate('lobby.join', { lobby }, network);
    }

    lobbyLeave(lobby, network) {
        return this.mutate('lobby.leave', { lobby }, network);
    }

    lobbyKick(lobby, nick, network) {
        return this.mutate('lobby.kick', { lobby, nick }, network);
    }

    lobbyLaunch(lobby, network) {
        return this.mutate('lobby.launch', { lobby }, network);
    }

    async mutate(op, fields, network) {
        this.state.error = '';
        try {
            const res = await this.client.request(op, fields, network);
            if (!res.ok) {
                this.state.error = res.error || t('mgmt_err_op', { op });
                await this.refresh(network);
                return false;
            }

            if (
                (op === 'lobby.join' || op === 'lobby.create')
                && res.data
                && res.data.lobby
                && res.data.lobby.status === 'ready'
            ) {
                const { id, game } = lobbyEventLabel(res.data.lobby);
                postSalon(network, t('mgmt_push_ready', { id, game }));
            }

            if (op === 'lobby.launch' && res.data && res.data.lobby) {
                const { id, game } = lobbyEventLabel(res.data.lobby);
                postSalon(network, t('mgmt_push_launched', { id, game }));
            }

            await this.refresh(network);
            this.client.notifySalon({ op, ...fields }, network);
            return true;
        } catch (err) {
            this.state.error = err instanceof Error ? err.message : String(err);
            return false;
        }
    }

    applyState(data) {
        if (Array.isArray(data.games) && data.games.length) {
            this.state.games = data.games
                .filter((g) => g && isGameEnabled(String(g.id)))
                .map((g) => {
                    const id = String(g.id);
                    return {
                        id,
                        label: GAME_LABELS[id] || String(g.label || id),
                        minPlayers: Number(g.minPlayers) || 2,
                        maxPlayers: Number(g.maxPlayers) || 2,
                        queueCount: Number(g.queueCount) || 0,
                        openLobbies: Number(g.openLobbies) || 0,
                    };
                });
        }

        const queues = {};
        if (data.queues && typeof data.queues === 'object') {
            Object.keys(data.queues).forEach((gameId) => {
                const list = data.queues[gameId];
                queues[gameId] = Array.isArray(list) ? list.map(normalizePlayer) : [];
            });
        }
        this.state.queues = queues;

        this.state.lobbiesOpen = Array.isArray(data.lobbies && data.lobbies.open)
            ? data.lobbies.open.map(normalizeLobby)
            : [];
        this.state.lobbiesReady = Array.isArray(data.lobbies && data.lobbies.ready)
            ? data.lobbies.ready.map(normalizeLobby)
            : [];
    }

    applyMe(data) {
        this.state.meNick = typeof data.nick === 'string' ? data.nick : '';
        this.state.meAccount = typeof data.account === 'string' ? data.account : '';
        this.state.meQueues = Array.isArray(data.queues) ? data.queues.map(String) : [];
        this.state.meLobbies = Array.isArray(data.lobbies)
            ? data.lobbies.map((l) => String((l && l.id) || l || '')).filter(Boolean)
            : [];
    }
}

let storeInstance = null;

export function initGameStore(client) {
    storeInstance = new GameStore(client);
    return storeInstance;
}

export function getGameStore() {
    if (!storeInstance) {
        throw new Error('GameStore not initialized');
    }
    return storeInstance;
}
