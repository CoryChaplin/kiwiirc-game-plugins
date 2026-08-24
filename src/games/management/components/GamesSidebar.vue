<template>
    <div class="kiwi-gm-sidebar">
        <div class="kiwi-gm-sidebar-header">
            <div class="kiwi-gm-sidebar-title">{{ $t('kiwi-games:mgmt_title') }}</div>
            <button
                type="button"
                class="kiwi-gm-btn kiwi-gm-btn--icon"
                :title="$t('kiwi-games:mgmt_refresh')"
                :disabled="state.loading"
                @click="refresh"
            >↻</button>
        </div>

        <div v-if="!identified" class="kiwi-gm-banner kiwi-gm-banner--warn">
            {{ $t('kiwi-games:mgmt_nickserv_required') }}
        </div>

        <div v-if="state.error" class="kiwi-gm-banner kiwi-gm-banner--error">
            {{ state.error }}
        </div>

        <div v-if="state.loading && !games.length" class="kiwi-gm-empty">
            {{ $t('kiwi-games:mgmt_loading') }}
        </div>

        <ul class="kiwi-gm-game-list">
            <li
                v-for="game in games"
                :key="game.id"
                class="kiwi-gm-game"
                :class="{ 'kiwi-gm-game--open': state.expandedGame === game.id }"
            >
                <div class="kiwi-gm-game-row">
                    <button
                        type="button"
                        class="kiwi-gm-game-namebtn"
                        @click="toggleGame(game.id)"
                    >{{ game.label }}</button>
                    <button
                        type="button"
                        class="kiwi-gm-scores-btn"
                        :class="{ 'kiwi-gm-scores-btn--open': isScoresOpen(game.id) }"
                        :title="$t('kiwi-games:mgmt_scores_title')"
                        @click="toggleScores(game.id)"
                    >🏆</button>
                    <button
                        type="button"
                        class="kiwi-gm-game-metabtn"
                        @click="toggleGame(game.id)"
                    >
                        <span :title="$t('kiwi-games:mgmt_queue_title')">👥 {{ game.queueCount }}</span>
                        <span :title="$t('kiwi-games:mgmt_lobbies_open')">🏠 {{ game.openLobbies }}</span>
                    </button>
                </div>

                <div v-if="isScoresOpen(game.id)" class="kiwi-gm-scores">
                    <div class="kiwi-gm-scores-head">
                        <h3>{{ $t('kiwi-games:mgmt_scores_title') }}
                            <span v-if="scoresFor(game.id).label">— {{ scoresFor(game.id).label }}</span>
                        </h3>
                        <button
                            type="button"
                            class="kiwi-gm-btn kiwi-gm-btn--icon"
                            :title="$t('kiwi-games:mgmt_refresh')"
                            :disabled="scoresFor(game.id).loading"
                            @click="refreshScores(game.id)"
                        >↻</button>
                    </div>
                    <p v-if="scoresFor(game.id).loading" class="kiwi-gm-empty">
                        {{ $t('kiwi-games:mgmt_loading') }}
                    </p>
                    <p v-else-if="scoresFor(game.id).error" class="kiwi-gm-banner kiwi-gm-banner--error kiwi-gm-scores-error">
                        {{ scoresFor(game.id).error }}
                    </p>
                    <template v-else>
                        <ol v-if="scoresFor(game.id).top.length" class="kiwi-gm-scores-list">
                            <li
                                v-for="row in scoresFor(game.id).top"
                                :key="'top-' + row.rank + '-' + row.account"
                                class="kiwi-gm-scores-row"
                                :class="{ 'kiwi-gm-scores-row--me': isMeScore(row) }"
                            >
                                <span class="kiwi-gm-scores-rank">#{{ row.rank }}</span>
                                <span class="kiwi-gm-scores-name">{{ row.account }}</span>
                                <span class="kiwi-gm-scores-stats" :title="scoreStatsTitle(row)">
                                    {{ formatScoreStats(row) }}
                                </span>
                                <span class="kiwi-gm-scores-ratio">{{ row.ratio }}%</span>
                            </li>
                        </ol>
                        <p v-else class="kiwi-gm-empty">{{ $t('kiwi-games:mgmt_scores_empty') }}</p>
                        <div
                            v-if="scoresMeExtra(game.id)"
                            class="kiwi-gm-scores-me"
                        >
                            <div class="kiwi-gm-scores-row kiwi-gm-scores-row--me">
                                <span class="kiwi-gm-scores-rank">#{{ scoresMeExtra(game.id).rank }}</span>
                                <span class="kiwi-gm-scores-name">{{ scoresMeExtra(game.id).account }}</span>
                                <span class="kiwi-gm-scores-stats" :title="scoreStatsTitle(scoresMeExtra(game.id))">
                                    {{ formatScoreStats(scoresMeExtra(game.id)) }}
                                </span>
                                <span class="kiwi-gm-scores-ratio">{{ scoresMeExtra(game.id).ratio }}%</span>
                            </div>
                        </div>
                    </template>
                </div>

                <div v-if="state.expandedGame === game.id" class="kiwi-gm-game-body">
                    <section class="kiwi-gm-section">
                        <div class="kiwi-gm-section-head">
                            <h3>{{ $t('kiwi-games:mgmt_queue_title') }}</h3>
                            <button
                                v-if="!inQueue(game.id)"
                                type="button"
                                class="kiwi-gm-btn"
                                :disabled="!identified || state.loading"
                                @click="joinQueue(game.id)"
                            >{{ $t('kiwi-games:mgmt_join') }}</button>
                            <button
                                v-else
                                type="button"
                                class="kiwi-gm-btn kiwi-gm-btn--danger"
                                :disabled="state.loading"
                                @click="leaveQueue(game.id)"
                            >{{ $t('kiwi-games:mgmt_leave') }}</button>
                        </div>
                        <ul v-if="queueFor(game.id).length" class="kiwi-gm-players">
                            <li
                                v-for="p in queueFor(game.id)"
                                :key="p.account + p.nick"
                                class="kiwi-gm-player"
                            >
                                <span class="kiwi-gm-player-name">{{ p.nick || p.account }}</span>
                                <button
                                    v-if="inQueue(game.id) && !isSelf(p)"
                                    type="button"
                                    class="kiwi-gm-btn kiwi-gm-btn--small"
                                    :disabled="state.loading"
                                    @click="invitePlayer(game.id, p.nick || p.account)"
                                >{{ $t('kiwi-games:mgmt_invite') }}</button>
                            </li>
                        </ul>
                        <p v-else class="kiwi-gm-empty">{{ $t('kiwi-games:mgmt_queue_empty') }}</p>
                    </section>

                    <section class="kiwi-gm-section">
                        <div class="kiwi-gm-section-head">
                            <h3>{{ $t('kiwi-games:mgmt_lobbies_title') }}</h3>
                            <div class="kiwi-gm-create">
                                <label v-if="game.id === 'pictionary'" class="kiwi-gm-max">
                                    {{ $t('kiwi-games:mgmt_max') }}
                                    <input
                                        v-model.number="createMaxPlayers"
                                        type="number"
                                        min="2"
                                        max="10"
                                    >
                                </label>
                                <button
                                    type="button"
                                    class="kiwi-gm-btn"
                                    :disabled="!identified || state.loading"
                                    @click="createLobby(game.id)"
                                >{{ $t('kiwi-games:mgmt_create') }}</button>
                            </div>
                        </div>

                        <ul v-if="lobbiesFor(game.id).length" class="kiwi-gm-lobbies">
                            <li
                                v-for="lobby in lobbiesFor(game.id)"
                                :key="lobby.id"
                                class="kiwi-gm-lobby"
                            >
                                <div class="kiwi-gm-lobby-info">
                                    <strong>#{{ lobby.id }}</strong>
                                    <span>{{ lobby.players.length }}/{{ lobby.maxPlayers }}</span>
                                    <span class="kiwi-gm-lobby-players">{{ playerNicks(lobby) }}</span>
                                </div>
                                <div class="kiwi-gm-lobby-actions">
                                    <button
                                        v-if="!inLobby(lobby.id)"
                                        type="button"
                                        class="kiwi-gm-btn kiwi-gm-btn--small"
                                        :disabled="!identified || state.loading || isLobbyFull(lobby)"
                                        @click="joinLobby(lobby.id)"
                                    >{{ $t('kiwi-games:mgmt_join') }}</button>
                                    <template v-else>
                                        <button
                                            v-if="isLobbyFull(lobby)"
                                            type="button"
                                            class="kiwi-gm-btn kiwi-gm-btn--small"
                                            :disabled="state.loading"
                                            @click="inviteLobby(game.id, lobby)"
                                        >{{ $t('kiwi-games:mgmt_invite') }}</button>
                                        <button
                                            type="button"
                                            class="kiwi-gm-btn kiwi-gm-btn--small kiwi-gm-btn--danger"
                                            :disabled="state.loading"
                                            @click="leaveLobby(lobby.id)"
                                        >{{ $t('kiwi-games:mgmt_leave') }}</button>
                                    </template>
                                </div>
                            </li>
                        </ul>
                        <p v-else class="kiwi-gm-empty">{{ $t('kiwi-games:mgmt_lobbies_empty') }}</p>
                    </section>
                </div>
            </li>
        </ul>
    </div>
</template>

<script>
/* global kiwi:true */
import { getGameStore } from '../libs/game-store.js';
import { isIdentified } from '../libs/network.js';

export default {
    props: {
        buffer: { type: Object, default: null },
        network: { type: Object, default: null },
        sidebarState: { type: Object, default: null },
        pluginId: { type: String, default: '' },
    },
    data() {
        return {
            store: getGameStore(),
            createMaxPlayers: 4,
        };
    },
    computed: {
        state() {
            return this.store.state;
        },
        identified() {
            return isIdentified(this.network);
        },
        games() {
            return this.state.games;
        },
    },
    methods: {
        refresh() {
            this.store.refresh(this.network);
        },
        toggleGame(gameId) {
            this.store.setExpanded(gameId);
        },
        toggleScores(gameId) {
            this.store.toggleScores(gameId, this.network);
        },
        refreshScores(gameId) {
            this.store.fetchScores(gameId, this.network);
        },
        isScoresOpen(gameId) {
            return this.store.isScoresOpen(gameId);
        },
        scoresFor(gameId) {
            return this.store.scoresFor(gameId);
        },
        isMeScore(row) {
            if (!row || !row.account) return false;
            const scores = this.scoresFor(this.state.scoresOpenGame);
            const meAccount = this.state.meAccount
                || (scores.me && scores.me.account)
                || '';
            if (!meAccount) return false;
            return meAccount.toLowerCase() === String(row.account).toLowerCase();
        },
        scoresMeExtra(gameId) {
            const scores = this.scoresFor(gameId);
            const me = scores.me;
            if (!me || !me.account) return null;
            const inTop = (scores.top || []).some((row) => (
                row.account
                && row.account.toLowerCase() === me.account.toLowerCase()
            ));
            return inTop ? null : me;
        },
        formatScoreStats(row) {
            if (!row) return '';
            return `${row.wins}V ${row.draws}N ${row.losses}D`;
        },
        scoreStatsTitle(row) {
            if (!row) return '';
            return this.$t('kiwi-games:mgmt_scores_stats', {
                wins: row.wins,
                draws: row.draws,
                losses: row.losses,
                games: row.games,
            });
        },
        queueFor(gameId) {
            return this.store.queueFor(gameId);
        },
        lobbiesFor(gameId) {
            return this.store.openLobbiesFor(gameId);
        },
        inQueue(gameId) {
            return this.store.isInQueue(gameId);
        },
        inLobby(lobbyId) {
            return this.store.isInLobby(lobbyId);
        },
        isSelf(player) {
            const meAccount = this.state.meAccount;
            if (meAccount && player.account && meAccount.toLowerCase() === String(player.account).toLowerCase()) {
                return true;
            }
            const myNick = (this.network && this.network.nick) || this.state.meNick;
            const theirNick = player.nick || player.account;
            if (!myNick || !theirNick) return false;
            const irc = this.network && this.network.ircClient;
            if (irc && typeof irc.caseCompare === 'function') {
                try {
                    return irc.caseCompare(myNick, theirNick);
                } catch (_) {
                    // fall through
                }
            }
            return myNick.toLowerCase() === String(theirNick).toLowerCase();
        },
        invitePlayer(gameId, nick) {
            const network = this.network;
            const buffer = this.buffer;
            const target = (nick || '').trim();
            if (!network || !buffer || !target) return;
            const evt = { handled: false, params: [target] };
            const ctx = { network, buffer };
            kiwi.emit(`input.command.${gameId}`, evt, gameId, target, ctx);
        },
        isLobbyFull(lobby) {
            const max = Number(lobby && lobby.maxPlayers) || 0;
            const count = (lobby && lobby.players && lobby.players.length) || 0;
            return max > 0 && count >= max;
        },
        inviteLobby(gameId, lobby) {
            const network = this.network;
            const buffer = this.buffer;
            if (!network || !buffer || !lobby) return;
            const nicks = (lobby.players || [])
                .filter((p) => !this.isSelf(p))
                .map((p) => (p.nick || p.account || '').trim())
                .filter(Boolean);
            if (!nicks.length) return;
            const paramsArg = nicks.join(' ');
            const evt = { handled: false, params: nicks.slice() };
            const ctx = { network, buffer };
            kiwi.emit(`input.command.${gameId}`, evt, gameId, paramsArg, ctx);
        },
        joinQueue(gameId) {
            return this.store.queueJoin(gameId, this.network);
        },
        leaveQueue(gameId) {
            return this.store.queueLeave(gameId, this.network);
        },
        createLobby(gameId) {
            const max = gameId === 'pictionary' ? Number(this.createMaxPlayers) || 4 : undefined;
            return this.store.lobbyCreate(gameId, max, this.network);
        },
        joinLobby(lobbyId) {
            return this.store.lobbyJoin(lobbyId, this.network);
        },
        leaveLobby(lobbyId) {
            return this.store.lobbyLeave(lobbyId, this.network);
        },
        playerNicks(lobby) {
            const list = (lobby.players || []).map((p) => p.nick || p.account).join(', ');
            return list || '—';
        },
        close() {
            if (this.sidebarState && typeof this.sidebarState.close === 'function') {
                this.sidebarState.close();
            }
        },
    },
};
</script>

<style>
.kiwi-gm-sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    font-size: 0.92em;
}

.kiwi-gm-sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5em;
    padding: 0.65em 0.75em;
    border-bottom: 1px solid rgba(128, 128, 128, 0.25);
    flex-shrink: 0;
}

.kiwi-gm-sidebar-title {
    font-weight: 600;
    letter-spacing: 0.02em;
}

.kiwi-gm-banner {
    margin: 0.5em 0.75em 0;
    padding: 0.45em 0.6em;
    border-radius: 3px;
    font-size: 0.88em;
    line-height: 1.35;
    flex-shrink: 0;
}

.kiwi-gm-banner--warn {
    background: rgba(200, 140, 0, 0.15);
    border: 1px solid rgba(200, 140, 0, 0.35);
}

.kiwi-gm-banner--error {
    background: rgba(180, 40, 40, 0.12);
    border: 1px solid rgba(180, 40, 40, 0.35);
}

.kiwi-gm-game-list {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
}

.kiwi-gm-game {
    border-bottom: 1px solid rgba(128, 128, 128, 0.18);
}

.kiwi-gm-game-row {
    display: flex;
    align-items: stretch;
}

.kiwi-gm-game-namebtn,
.kiwi-gm-game-metabtn {
    display: flex;
    align-items: center;
    gap: 0.65em;
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
    text-align: left;
    font: inherit;
    padding: 0.65em 0.35em;
}

.kiwi-gm-game-namebtn {
    padding-left: 0.75em;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.kiwi-gm-game-metabtn {
    margin-left: auto;
    padding-right: 0.75em;
    opacity: 0.8;
    font-size: 0.88em;
    white-space: nowrap;
}

.kiwi-gm-game-namebtn:hover,
.kiwi-gm-game-metabtn:hover {
    background: rgba(128, 128, 128, 0.1);
}

.kiwi-gm-game--open > .kiwi-gm-game-row > .kiwi-gm-game-namebtn {
    font-weight: 600;
}

.kiwi-gm-game--open > .kiwi-gm-game-row > .kiwi-gm-game-namebtn,
.kiwi-gm-game--open > .kiwi-gm-game-row > .kiwi-gm-game-metabtn {
    background: rgba(128, 128, 128, 0.12);
}

.kiwi-gm-scores-btn {
    appearance: none;
    border: 0;
    background: transparent;
    padding: 0 0.25em;
    margin: 0;
    font: inherit;
    font-size: 1em;
    line-height: 1;
    cursor: pointer;
    opacity: 0.65;
    flex-shrink: 0;
}

.kiwi-gm-scores-btn:hover,
.kiwi-gm-scores-btn--open {
    opacity: 1;
    background: rgba(128, 128, 128, 0.1);
}

.kiwi-gm-scores {
    padding: 0.35em 0.75em 0.75em;
    border-top: 1px dashed rgba(128, 128, 128, 0.2);
}

.kiwi-gm-scores-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5em;
    margin-bottom: 0.35em;
}

.kiwi-gm-scores-head h3 {
    margin: 0;
    font-size: 0.85em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    opacity: 0.75;
}

.kiwi-gm-scores-error {
    margin: 0.35em 0 0;
}

.kiwi-gm-scores-list {
    list-style: none;
    margin: 0;
    padding: 0;
}

.kiwi-gm-scores-row {
    display: grid;
    grid-template-columns: 2.2em 1fr auto auto;
    gap: 0.45em;
    align-items: center;
    padding: 0.2em 0;
    font-size: 0.9em;
}

.kiwi-gm-scores-row--me {
    font-weight: 600;
}

.kiwi-gm-scores-rank {
    opacity: 0.7;
    font-variant-numeric: tabular-nums;
}

.kiwi-gm-scores-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.kiwi-gm-scores-stats {
    opacity: 0.75;
    font-size: 0.88em;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
}

.kiwi-gm-scores-ratio {
    opacity: 0.85;
    font-variant-numeric: tabular-nums;
    min-width: 2.6em;
    text-align: right;
}

.kiwi-gm-scores-me {
    margin-top: 0.35em;
    padding-top: 0.35em;
    border-top: 1px solid rgba(128, 128, 128, 0.2);
}

.kiwi-gm-game-body {
    padding: 0 0.75em 0.85em;
}

.kiwi-gm-section {
    margin-top: 0.65em;
}

.kiwi-gm-section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5em;
    margin-bottom: 0.35em;
}

.kiwi-gm-section-head h3 {
    margin: 0;
    font-size: 0.85em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    opacity: 0.75;
}

.kiwi-gm-players,
.kiwi-gm-lobbies {
    list-style: none;
    margin: 0;
    padding: 0;
}

.kiwi-gm-player {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5em;
    padding: 0.25em 0;
    opacity: 0.95;
}

.kiwi-gm-player-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.kiwi-gm-lobby {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5em;
    padding: 0.4em 0;
    border-top: 1px solid rgba(128, 128, 128, 0.12);
}

.kiwi-gm-lobby:first-child {
    border-top: 0;
}

.kiwi-gm-lobby-actions {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.25em;
    flex-shrink: 0;
}

.kiwi-gm-lobby-players {
    font-size: 0.88em;
    opacity: 0.8;
    word-break: break-word;
}

.kiwi-gm-empty {
    margin: 0.25em 0 0;
    opacity: 0.65;
    font-style: italic;
    font-size: 0.9em;
    padding: 0 0.75em;
}

.kiwi-gm-create {
    display: flex;
    align-items: center;
    gap: 0.4em;
}

.kiwi-gm-max {
    display: flex;
    align-items: center;
    gap: 0.25em;
    font-size: 0.85em;
    opacity: 0.85;
}

.kiwi-gm-max input {
    width: 3em;
    padding: 0.15em 0.25em;
    border: 1px solid rgba(128, 128, 128, 0.35);
    border-radius: 3px;
    background: transparent;
    color: inherit;
    font: inherit;
}

.kiwi-gm-btn {
    appearance: none;
    border: 1px solid rgba(128, 128, 128, 0.4);
    background: rgba(128, 128, 128, 0.08);
    color: inherit;
    border-radius: 3px;
    padding: 0.25em 0.55em;
    font: inherit;
    font-size: 0.85em;
    cursor: pointer;
    white-space: nowrap;
}

.kiwi-gm-btn:hover:not(:disabled) {
    background: rgba(128, 128, 128, 0.18);
}

.kiwi-gm-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

.kiwi-gm-btn--small {
    padding: 0.15em 0.45em;
    font-size: 0.8em;
}

.kiwi-gm-btn--danger {
    border-color: rgba(180, 60, 60, 0.45);
}

.kiwi-gm-btn--icon {
    padding: 0.15em 0.4em;
    font-size: 1.1em;
    line-height: 1;
}
</style>
