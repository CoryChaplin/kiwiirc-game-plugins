<template>
    <div class="kiwi-gm ctx">
        <header class="surface-head kiwi-gm-head">
            <span class="surface-sh" aria-hidden="true"><i class="fa fa-gamepad" /></span>
            <div class="surface-main">
                <div class="surface-title">{{ $t('kiwi-games:mgmt_title') }}</div>
                <p class="surface-intro">
                    {{ tab === 'scores'
                        ? $t('kiwi-games:mgmt_intro_scores')
                        : $t('kiwi-games:mgmt_intro_play') }}
                </p>
            </div>
            <button
                type="button"
                class="btn-icon"
                :aria-label="$t('kiwi-games:mgmt_refresh')"
                :title="state.refreshLocked
                    ? $t('kiwi-games:mgmt_refresh_wait')
                    : $t('kiwi-games:mgmt_refresh')"
                :disabled="state.loading || state.refreshLocked"
                @click="refresh"
            ><i class="fa fa-refresh" aria-hidden="true" /></button>
        </header>

        <div class="ctx-tabs" role="tablist" @keydown="onTabKey">
            <button
                v-for="t in tabs"
                :id="tabId(t.id)"
                :key="t.id"
                ref="tabs"
                type="button"
                role="tab"
                class="ctx-tab"
                :class="{ active: tab === t.id }"
                :aria-selected="tab === t.id ? 'true' : 'false'"
                :aria-controls="panelId"
                :tabindex="tab === t.id ? 0 : -1"
                @click="setTab(t.id)"
            ><i class="fa" :class="t.icon" aria-hidden="true" />{{ $t(t.label) }}</button>
        </div>

        <div
            :id="panelId"
            class="ctx-body kiwi-gm-panel"
            role="tabpanel"
            :aria-labelledby="tabId(tab)"
        >
            <div v-if="state.error" class="inline-note block danger kiwi-gm-note" role="alert">
                <i class="fa fa-exclamation-circle ic" aria-hidden="true" />
                <div>
                    <div>{{ state.error }}</div>
                    <div class="kiwi-gm-actions">
                        <button
                            type="button"
                            class="btn-ghost sm"
                            :disabled="state.loading || state.refreshLocked"
                            @click="refresh"
                        >{{ $t('kiwi-games:mgmt_retry') }}</button>
                    </div>
                </div>
            </div>

            <div
                v-if="tab === 'scores' && !identified"
                class="inline-note block kiwi-gm-note"
            >
                <i class="fa fa-info-circle ic" aria-hidden="true" />
                <span>{{ $t('kiwi-games:mgmt_nickserv_required') }}</span>
            </div>

            <div v-if="state.loading && !games.length" class="empty">
                <p>{{ $t('kiwi-games:mgmt_loading') }}</p>
            </div>

            <ul class="kiwi-gm-list">
                <li
                    v-for="game in games"
                    :key="game.id"
                    class="ctx-block kiwi-gm-game"
                >
                    <button
                        type="button"
                        class="kiwi-gm-row"
                        :aria-expanded="isRowOpen(game.id) ? 'true' : 'false'"
                        :aria-controls="bodyId(game.id)"
                        @click="toggleRow(game.id)"
                    >
                        <i class="fa fa-chevron-right kiwi-gm-chev" aria-hidden="true" />
                        <span class="kiwi-gm-name">{{ gameTitle(game) }}</span>
                        <span
                            v-if="tab === 'play' && !state.error"
                            class="kiwi-gm-signals"
                        >
                            <span
                                v-if="game.queueCount"
                                class="badge badge-count"
                            >{{ $t('kiwi-games:mgmt_sig_queue', { count: game.queueCount }) }}</span>
                            <span
                                v-if="game.openLobbies"
                                class="badge badge-count"
                            >{{ game.openLobbies > 1
                                ? $t('kiwi-games:mgmt_sig_lobbies', { count: game.openLobbies })
                                : $t('kiwi-games:mgmt_sig_lobby') }}</span>
                        </span>
                        <span
                            v-else-if="tab === 'scores' && myRank(game.id)"
                            class="kiwi-gm-rank"
                        >{{ rankLabel(myRank(game.id)) }}</span>
                    </button>

                    <!-- Play: available players, then parties being set up -->
                    <div
                        v-if="tab === 'play' && isRowOpen(game.id)"
                        :id="bodyId(game.id)"
                        class="kiwi-gm-body"
                    >
                        <section class="kiwi-gm-sec">
                            <h4 class="ctx-h">
                                <i class="fa fa-hand-paper-o" aria-hidden="true" />
                                {{ $t('kiwi-games:mgmt_queue_title') }}
                            </h4>
                            <p v-if="inQueue(game.id)" class="kiwi-gm-status">
                                <b>{{ $t('kiwi-games:mgmt_queue_you') }}</b>{{ $t('kiwi-games:mgmt_queue_you_more') }}
                            </p>
                            <ul v-if="otherQueued(game.id).length" class="kiwi-gm-people">
                                <li
                                    v-for="p in otherQueued(game.id)"
                                    :key="p.account + p.nick"
                                    class="kiwi-gm-person"
                                >
                                    <span class="pres on" aria-hidden="true" />
                                    <span class="kiwi-gm-nick">{{ p.nick || p.account }}</span>
                                    <button
                                        v-if="inQueue(game.id)"
                                        type="button"
                                        class="btn-text"
                                        :aria-label="$t('kiwi-games:mgmt_invite_who', { nick: p.nick || p.account })"
                                        :title="queueInvitesLocked ? $t('kiwi-games:mgmt_invite_cooldown') : ''"
                                        :disabled="state.loading || queueInvitesLocked"
                                        @click="invitePlayer(game.id, p.nick || p.account)"
                                    >{{ $t('kiwi-games:mgmt_invite') }}</button>
                                </li>
                            </ul>
                            <div v-else class="empty">
                                <p>{{ inQueue(game.id)
                                    ? $t('kiwi-games:mgmt_queue_empty_me')
                                    : $t('kiwi-games:mgmt_queue_empty') }}</p>
                            </div>
                            <div class="kiwi-gm-actions">
                                <button
                                    v-if="!inQueue(game.id)"
                                    type="button"
                                    class="btn-cta sm"
                                    :disabled="state.loading"
                                    @click="joinQueue(game.id)"
                                >{{ $t('kiwi-games:mgmt_queue_join') }}</button>
                                <button
                                    v-else
                                    type="button"
                                    class="btn-ghost sm"
                                    :disabled="state.loading"
                                    @click="leaveQueue(game.id)"
                                >{{ $t('kiwi-games:mgmt_queue_leave') }}</button>
                            </div>
                        </section>

                        <section class="kiwi-gm-sec">
                            <h4 class="ctx-h">
                                <i class="fa fa-users" aria-hidden="true" />
                                {{ $t('kiwi-games:mgmt_lobbies_title') }}
                            </h4>
                            <div
                                v-for="lobby in lobbiesFor(game.id)"
                                :key="lobby.id"
                                class="kiwi-gm-party"
                            >
                                <div class="kiwi-gm-party-h">
                                    <b>{{ partyTitle(lobby) }}</b>
                                    <span class="kiwi-gm-count">{{ $t('kiwi-games:mgmt_seats', {
                                        count: lobby.players.length,
                                        max: lobby.maxPlayers,
                                    }) }}</span>
                                    <span
                                        v-if="isLobbyFull(lobby) || isLobbyReady(lobby)"
                                        class="badge badge-count"
                                    >{{ $t('kiwi-games:mgmt_ready') }}</span>
                                </div>
                                <div class="kiwi-gm-seats" aria-hidden="true">
                                    <i
                                        v-for="n in seatCount(lobby)"
                                        :key="n"
                                        :class="{ on: n <= lobby.players.length }"
                                    />
                                </div>
                                <div class="kiwi-gm-players">
                                    <span
                                        v-for="p in lobby.players"
                                        :key="(p.nick || p.account) + p.joinedAt"
                                        class="chip xs"
                                    >{{ p.nick || p.account }}<template v-if="isSelf(p)">
                                        {{ $t('kiwi-games:mgmt_you') }}</template><button
                                        v-if="canKick(lobby, p)"
                                        type="button"
                                        class="kiwi-gm-x"
                                        :aria-label="$t('kiwi-games:mgmt_kick_who', { nick: p.nick || p.account })"
                                        :title="$t('kiwi-games:mgmt_kick')"
                                        :disabled="state.loading"
                                        @click="kickPlayer(lobby, p)"
                                    ><i class="fa fa-times" aria-hidden="true" /></button></span>
                                </div>
                                <div class="kiwi-gm-actions kiwi-gm-actions--end">
                                    <template v-if="!inLobby(lobby.id)">
                                        <span
                                            v-if="isLobbyFull(lobby) || isLobbyReady(lobby)"
                                            class="kiwi-gm-wait"
                                        >{{ $t('kiwi-games:mgmt_waiting_launch', { nick: lobby.createdBy }) }}</span>
                                        <button
                                            v-else
                                            type="button"
                                            class="btn-ghost sm"
                                            :disabled="state.loading"
                                            @click="joinLobby(lobby)"
                                        >{{ $t('kiwi-games:mgmt_join') }}</button>
                                    </template>
                                    <template v-else>
                                        <button
                                            v-if="canLaunch(lobby)"
                                            type="button"
                                            class="btn-cta sm"
                                            :disabled="state.loading"
                                            @click="launchLobby(game.id, lobby)"
                                        >
                                            <i class="fa fa-play" aria-hidden="true" />
                                            {{ $t('kiwi-games:mgmt_launch') }}
                                        </button>
                                        <span
                                            v-else-if="isLobbyFull(lobby) || isLobbyReady(lobby)"
                                            class="kiwi-gm-wait"
                                        >{{ $t('kiwi-games:mgmt_waiting_launch', { nick: lobby.createdBy }) }}</span>
                                        <span v-else class="kiwi-gm-wait">{{ freeSeatsLabel(lobby) }}</span>
                                        <button
                                            type="button"
                                            class="btn-ghost sm"
                                            :disabled="state.loading"
                                            @click="leaveLobby(lobby.id)"
                                        >{{ $t('kiwi-games:mgmt_leave') }}</button>
                                    </template>
                                </div>
                            </div>
                            <div v-if="!lobbiesFor(game.id).length" class="empty">
                                <p>{{ $t('kiwi-games:mgmt_lobbies_empty') }}</p>
                            </div>
                            <div class="kiwi-gm-create">
                                <select
                                    v-if="game.id === 'pictionary'"
                                    v-model.number="createMaxPlayers"
                                    class="input"
                                    :aria-label="$t('kiwi-games:mgmt_max')"
                                >
                                    <option
                                        v-for="n in sizeChoices"
                                        :key="n"
                                        :value="n"
                                    >{{ $t('kiwi-games:mgmt_size', { count: n }) }}</option>
                                </select>
                                <button
                                    type="button"
                                    class="btn-ghost sm"
                                    :disabled="state.loading"
                                    @click="createLobby(game.id)"
                                >
                                    <i class="fa fa-plus" aria-hidden="true" />
                                    {{ $t('kiwi-games:mgmt_create') }}
                                </button>
                            </div>
                        </section>
                    </div>

                    <!-- Leaderboard: top entries, then my own row when outside them -->
                    <div
                        v-if="tab === 'scores' && isRowOpen(game.id)"
                        :id="bodyId(game.id)"
                        class="kiwi-gm-body"
                    >
                        <div v-if="scoresFor(game.id).loading" class="empty">
                            <p>{{ $t('kiwi-games:mgmt_loading') }}</p>
                        </div>
                        <div
                            v-else-if="scoresFor(game.id).error"
                            class="inline-note block danger"
                            role="alert"
                        >
                            <i class="fa fa-exclamation-circle ic" aria-hidden="true" />
                            <span>{{ scoresFor(game.id).error }}</span>
                        </div>
                        <template v-else>
                            <ol v-if="scoresFor(game.id).top.length" class="kiwi-gm-scores">
                                <li
                                    v-for="row in scoresFor(game.id).top"
                                    :key="'top-' + row.rank + '-' + row.account"
                                    class="kiwi-gm-score"
                                    :class="{ 'kiwi-gm-score--me': isMeScore(row) }"
                                >
                                    <span class="kiwi-gm-rk">{{ row.rank }}</span>
                                    <span class="kiwi-gm-nm">{{ row.account }}<template v-if="isMeScore(row)">
                                        {{ $t('kiwi-games:mgmt_you') }}</template></span>
                                    <span class="kiwi-gm-st" :title="scoreStatsTitle(row)">{{ formatScoreStats(row) }}</span>
                                    <span class="kiwi-gm-pc">{{ row.ratio }} %</span>
                                </li>
                            </ol>
                            <div v-else class="empty">
                                <p>{{ $t('kiwi-games:mgmt_scores_empty') }}</p>
                            </div>
                            <ol v-if="scoresMeExtra(game.id)" class="kiwi-gm-scores kiwi-gm-scores--me">
                                <li class="kiwi-gm-score kiwi-gm-score--me">
                                    <span class="kiwi-gm-rk">{{ scoresMeExtra(game.id).rank }}</span>
                                    <span class="kiwi-gm-nm">{{ scoresMeExtra(game.id).account }}
                                        {{ $t('kiwi-games:mgmt_you') }}</span>
                                    <span class="kiwi-gm-st" :title="scoreStatsTitle(scoresMeExtra(game.id))">{{
                                        formatScoreStats(scoresMeExtra(game.id)) }}</span>
                                    <span class="kiwi-gm-pc">{{ scoresMeExtra(game.id).ratio }} %</span>
                                </li>
                            </ol>
                            <p v-if="scoresFor(game.id).top.length" class="kiwi-gm-legend">
                                {{ $t('kiwi-games:mgmt_scores_legend') }}
                            </p>
                        </template>
                    </div>
                </li>
            </ul>
        </div>
    </div>
</template>

<script>
/* global kiwi:true */
import { getGameStore } from '../libs/game-store.js';
import { isIdentified, nicksMatch } from '../libs/network.js';

const TABS = [
    { id: 'play', icon: 'fa-play-circle', label: 'kiwi-games:mgmt_tab_play' },
    { id: 'scores', icon: 'fa-trophy', label: 'kiwi-games:mgmt_tab_scores' },
];

let instanceCount = 0;

export default {
    props: {
        buffer: { type: Object, default: null },
        network: { type: Object, default: null },
        sidebarState: { type: Object, default: null },
        pluginId: { type: String, default: '' },
    },
    data() {
        instanceCount += 1;
        return {
            store: getGameStore(),
            createMaxPlayers: 4,
            expandedGame: '',
            tab: 'play',
            tabs: TABS,
            uid: 'kiwi-gm-' + instanceCount,
        };
    },
    created() {
        this.expandedGame = this.store.state.expandedGame || '';
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
        queueInvitesLocked() {
            return Boolean(this.state.queueInviteLocked);
        },
        panelId() {
            return this.uid + '-panel';
        },
        sizeChoices() {
            const sizes = [];
            for (let n = 2; n <= 10; n++) sizes.push(n);
            return sizes;
        },
    },
    methods: {
        refresh() {
            this.store.refresh(this.network);
            if (this.tab === 'scores' && this.state.scoresOpenGame) {
                this.store.fetchScores(this.state.scoresOpenGame, this.network);
            }
        },
        tabId(id) {
            return this.uid + '-tab-' + id;
        },
        bodyId(gameId) {
            return this.uid + '-' + this.tab + '-' + gameId;
        },
        setTab(id) {
            this.tab = id;
        },
        // Arrow keys move between tabs (roving tabindex), Home/End jump to the ends.
        onTabKey(event) {
            const ids = this.tabs.map((t) => t.id);
            let i = ids.indexOf(this.tab);
            if (event.key === 'ArrowRight') i = (i + 1) % ids.length;
            else if (event.key === 'ArrowLeft') i = (i - 1 + ids.length) % ids.length;
            else if (event.key === 'Home') i = 0;
            else if (event.key === 'End') i = ids.length - 1;
            else return;
            event.preventDefault();
            this.setTab(ids[i]);
            this.$nextTick(() => {
                const el = this.$refs.tabs && this.$refs.tabs[i];
                if (el) el.focus();
            });
        },
        isRowOpen(gameId) {
            return this.tab === 'scores'
                ? this.isScoresOpen(gameId)
                : this.expandedGame === gameId;
        },
        toggleRow(gameId) {
            if (this.tab === 'scores') this.toggleScores(gameId);
            else this.toggleGame(gameId);
        },
        // Rank shows once that game's leaderboard has been loaded (no extra request).
        myRank(gameId) {
            const me = this.scoresFor(gameId).me;
            return (me && me.rank) || 0;
        },
        rankLabel(rank) {
            return rank === 1
                ? this.$t('kiwi-games:mgmt_rank_me_first')
                : this.$t('kiwi-games:mgmt_rank_me', { rank });
        },
        otherQueued(gameId) {
            return this.queueFor(gameId).filter((p) => !this.isSelf(p));
        },
        partyTitle(lobby) {
            return this.isCreator(lobby)
                ? this.$t('kiwi-games:mgmt_party_mine')
                : this.$t('kiwi-games:mgmt_party_of', { nick: lobby.createdBy });
        },
        seatCount(lobby) {
            return Math.max(Number(lobby && lobby.maxPlayers) || 0, 0);
        },
        freeSeatsLabel(lobby) {
            const free = this.seatCount(lobby) - ((lobby && lobby.players && lobby.players.length) || 0);
            return free > 1
                ? this.$t('kiwi-games:mgmt_seats_free', { count: free })
                : this.$t('kiwi-games:mgmt_seat_free');
        },
        toggleGame(gameId) {
            const next = this.expandedGame === gameId ? '' : gameId;
            this.expandedGame = next;
            this.store.setExpanded(next);
        },
        gameTitle(game) {
            const id = game && game.id;
            if (!id) return '';
            const key = 'kiwi-games:dropdown_' + id;
            const translated = this.$t(key);
            if (translated && translated !== key) return translated;
            return (game && game.label) || id;
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
            return this.$t('kiwi-games:mgmt_scores_short', {
                wins: row.wins,
                draws: row.draws,
                losses: row.losses,
            });
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
            return this.store.lobbiesFor(gameId);
        },
        inQueue(gameId) {
            if (this.store && typeof this.store.isInQueue === 'function') {
                return this.store.isInQueue(gameId);
            }
            const queues = this.state && this.state.meQueues;
            return Array.isArray(queues) && queues.includes(gameId);
        },
        inLobby(lobbyId) {
            if (this.store && typeof this.store.isInLobby === 'function') {
                return this.store.isInLobby(lobbyId);
            }
            const lobbies = this.state && this.state.meLobbies;
            return Array.isArray(lobbies) && lobbies.includes(lobbyId);
        },
        isSelf(player) {
            const meAccount = this.state.meAccount;
            if (meAccount && player.account && meAccount.toLowerCase() === String(player.account).toLowerCase()) {
                return true;
            }
            const myNick = (this.network && this.network.nick) || this.state.meNick;
            const theirNick = player.nick || player.account;
            const irc = this.network && this.network.ircClient;
            return nicksMatch(myNick, theirNick, irc);
        },
        isCreator(lobby) {
            const myNick = (this.network && this.network.nick) || this.state.meNick;
            const irc = this.network && this.network.ircClient;
            return nicksMatch(lobby && lobby.createdBy, myNick, irc);
        },
        isLobbyReady(lobby) {
            return Boolean(lobby && lobby.status === 'ready');
        },
        canKick(lobby, player) {
            if (!lobby || !player) return false;
            if (!this.isCreator(lobby) || this.isSelf(player)) return false;
            return Boolean((player.nick || player.account || '').trim());
        },
        canLaunch(lobby) {
            return this.isLobbyFull(lobby) && this.isCreator(lobby) && this.inLobby(lobby.id);
        },
        invitePlayer(gameId, nick) {
            const network = this.network;
            const buffer = this.buffer;
            const target = (nick || '').trim();
            if (!network || !buffer || !target) return;
            if (this.store.isQueueInviteLocked()) return;
            const evt = { handled: false, params: [target] };
            const ctx = { network, buffer };
            kiwi.emit(`input.command.${gameId}`, evt, gameId, target, ctx);
            this.store.lockQueueInvites();
        },
        isLobbyFull(lobby) {
            const max = Number(lobby && lobby.maxPlayers) || 0;
            const count = (lobby && lobby.players && lobby.players.length) || 0;
            return max > 0 && count >= max;
        },
        parseLaunchCommand(cmd) {
            if (!cmd || typeof cmd !== 'string') return null;
            const cleaned = cmd.replace(/^\//, '').trim();
            const parts = cleaned.split(/\s+/).filter(Boolean);
            if (parts.length < 2) return null;
            return { game: parts[0], nicks: parts.slice(1) };
        },
        runLaunchCommand(gameId, lobby) {
            const network = this.network;
            const buffer = this.buffer;
            if (!network || !buffer || !lobby) return;

            const parsed = this.parseLaunchCommand(lobby.launchCommand);
            const game = (parsed && parsed.game) || gameId;
            const nicks = parsed && parsed.nicks.length
                ? parsed.nicks.slice()
                : (lobby.players || [])
                    .filter((p) => !this.isSelf(p))
                    .map((p) => (p.nick || p.account || '').trim())
                    .filter(Boolean);
            if (!nicks.length) return;

            const paramsArg = nicks.join(' ');
            const evt = { handled: false, params: nicks.slice() };
            const ctx = { network, buffer };
            kiwi.emit(`input.command.${game}`, evt, game, paramsArg, ctx);
        },
        kickPlayer(lobby, player) {
            const nick = ((player && player.nick) || (player && player.account) || '').trim();
            if (!lobby || !nick) return;
            return this.store.lobbyKick(lobby.id, nick, this.network);
        },
        async launchLobby(gameId, lobby) {
            if (!lobby) return;
            const snapshot = {
                launchCommand: lobby.launchCommand,
                players: (lobby.players || []).slice(),
            };
            const ok = await this.store.lobbyLaunch(lobby.id, this.network);
            if (!ok) return;
            this.runLaunchCommand(gameId, snapshot);
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
        joinLobby(lobby) {
            return this.store.lobbyJoin(lobby, this.network);
        },
        leaveLobby(lobbyId) {
            return this.store.lobbyLeave(lobbyId, this.network);
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
/*
 * The panel is built from the host theme's shared objects (.ctx, .surface-head, .ctx-tabs,
 * .ctx-block, .ctx-h, .btn-*, .badge, .chip, .pres, .empty, .inline-note, .input).
 * This sheet only places them. The `kiwi-gm-fallback` layer below keeps the panel usable
 * under a theme that does not ship those objects; unlayered theme rules always win over it.
 */

.kiwi-gm.ctx {
    height: 100%;
    border-left: 0; /* the Kiwi sidebar already draws the edge */
}

/* Neither Kiwi nor the theme resets button fonts: without this, buttons fall back to the UA font. */
.kiwi-gm button,
.kiwi-gm select {
    font-family: inherit;
}

.kiwi-gm-head {
    align-items: center;
}

.kiwi-gm-head .surface-main {
    flex: 1;
    min-width: 0;
}

/* The intro sits under the title, not beside it. */
.kiwi-gm-head .surface-intro {
    flex-basis: 100%;
    margin: 0;
    font-size: var(--text-xs, 0.85em);
}

.kiwi-gm-note {
    margin-bottom: 0.6rem;
}

.kiwi-gm-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
}

.kiwi-gm-game.ctx-block {
    padding: 0;
}

/* The whole row is the toggle: one target, no nested control. */
.kiwi-gm-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 2.3rem;
    padding: 0.35rem 0.7rem;
    border: 0;
    border-radius: var(--radius-sm, 6px);
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
}

.kiwi-gm-row:hover {
    background: var(--color-bg-hover, rgba(128, 128, 128, 0.12));
}

.kiwi-gm-row:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring, 0 0 0 3px rgba(66, 185, 146, 0.5));
}

.kiwi-gm-chev {
    width: 0.8rem;
    flex-shrink: 0;
    font-size: 0.6rem;
    opacity: 0.7;
    transition: transform 0.15s ease;
}

.kiwi-gm-row[aria-expanded="true"] .kiwi-gm-chev {
    transform: rotate(90deg);
    opacity: 1;
    color: var(--color-accent, currentColor);
}

.kiwi-gm-name {
    flex: 1;
    min-width: 0;
    font-size: var(--text-sm, 1em);
    font-weight: var(--weight-bold, 700);
}

.kiwi-gm-row[aria-expanded="true"] .kiwi-gm-name {
    color: var(--color-accent, currentColor);
    font-weight: var(--weight-extrabold, 800);
}

.kiwi-gm-signals {
    display: flex;
    gap: 0.3rem;
    flex-shrink: 0;
}

.kiwi-gm-rank {
    flex-shrink: 0;
    font-size: var(--text-xs, 0.85em);
    color: var(--color-text-secondary, inherit);
    font-variant-numeric: tabular-nums;
}

.kiwi-gm-body {
    padding: 0.1rem 0.7rem 0.7rem;
}

.kiwi-gm-sec + .kiwi-gm-sec {
    margin-top: 0.9rem;
}

.kiwi-gm-sec .ctx-h {
    margin-bottom: 0.4rem;
}

.kiwi-gm-body .empty {
    padding: 0.1rem 0 0.45rem;
    text-align: left;
}

.kiwi-gm-body .empty p {
    margin: 0;
}

.kiwi-gm-status {
    margin: 0 0 0.45rem;
    font-size: var(--text-xs, 0.85em);
    color: var(--color-text-secondary, inherit);
}

.kiwi-gm-status b {
    color: var(--color-accent, inherit);
}

.kiwi-gm-people {
    list-style: none;
    margin: 0 0 0.5rem;
    padding: 0;
    --pres-ring: var(--color-bg-panel);
}

.kiwi-gm-person {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    min-height: 1.9rem;
}

.kiwi-gm-nick {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--text-sm, 1em);
    font-weight: var(--weight-medium, 600);
}

.kiwi-gm-person .btn-text {
    flex-shrink: 0;
}

.kiwi-gm-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
}

.kiwi-gm-note .kiwi-gm-actions {
    margin-top: 0.4rem;
}

.kiwi-gm-actions--end {
    justify-content: flex-end;
}

/* The theme's .btn-cta is a skin without a shape: the panel gives it the small geometry. */
.kiwi-gm .btn-cta.sm {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    min-height: 1.9rem;
    padding: 0.2rem 0.8rem;
    border: 1px solid transparent;
    border-radius: var(--radius-pill, 999px);
    font-size: var(--text-xs, 0.85em);
    line-height: 1.25;
}

.kiwi-gm .btn-cta.sm:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring, 0 0 0 3px rgba(66, 185, 146, 0.5));
}

.kiwi-gm-party {
    padding: 0.5rem 0;
}

.kiwi-gm-party + .kiwi-gm-party {
    border-top: 1px solid var(--color-border, rgba(128, 128, 128, 0.25));
}

.kiwi-gm-party-h {
    display: flex;
    align-items: baseline;
    gap: 0.45rem;
    flex-wrap: wrap;
}

.kiwi-gm-party-h b {
    font-size: var(--text-sm, 1em);
}

.kiwi-gm-count {
    font-size: var(--text-xs, 0.85em);
    color: var(--color-text-secondary, inherit);
    font-variant-numeric: tabular-nums;
}

.kiwi-gm-seats {
    display: flex;
    gap: 3px;
    margin: 0.3rem 0 0.4rem;
}

.kiwi-gm-seats i {
    width: 0.42rem;
    height: 0.42rem;
    border-radius: 50%;
    border: 1.5px solid var(--color-accent, currentColor);
}

.kiwi-gm-seats i.on {
    background: var(--color-accent, currentColor);
}

.kiwi-gm-players {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin-bottom: 0.45rem;
}

.kiwi-gm-players .chip {
    box-shadow: none;
}

/* Remove a player: the cross keeps its size inside the chip, its target reaches 24px by an
   out-of-flow overlay (a target carried by a line of text). It sits above the chip's own
   touch overlay, which would otherwise swallow the tap. */
.kiwi-gm-x {
    position: relative;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 0.8rem;
    height: 0.8rem;
    margin: 0 -0.15rem 0 0.25rem;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: none;
    color: inherit;
    font-size: 0.55rem;
    opacity: 0.75;
    cursor: pointer;
}

.kiwi-gm-x::after {
    content: "";
    position: absolute;
    inset: -0.3rem;
}

.kiwi-gm-x:hover {
    opacity: 1;
    color: var(--color-danger, #c0392b);
}

.kiwi-gm-x:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring, 0 0 0 3px rgba(66, 185, 146, 0.5));
}

.kiwi-gm-wait {
    font-size: var(--text-xs, 0.85em);
    color: var(--color-text-secondary, inherit);
}

.kiwi-gm-create {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
    margin-top: 0.5rem;
}

.kiwi-gm-create select.input {
    width: auto;
    height: 1.9rem;
    padding: 0 0.7rem;
    font-size: var(--text-xs, 0.85em);
}

.kiwi-gm-scores {
    list-style: none;
    margin: 0;
    padding: 0;
    font-size: var(--text-sm, 1em);
}

.kiwi-gm-score {
    display: grid;
    grid-template-columns: 1.8rem 1fr auto 2.6rem;
    gap: 0.4rem;
    align-items: center;
    min-height: 1.6rem;
    padding: 0 0.35rem;
    border-radius: var(--radius-sm, 6px);
}

.kiwi-gm-rk {
    color: var(--color-text-muted, inherit);
    font-variant-numeric: tabular-nums;
}

.kiwi-gm-nm {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--weight-bold, 700);
}

.kiwi-gm-st {
    font-size: var(--text-xs, 0.85em);
    color: var(--color-text-secondary, inherit);
    font-variant-numeric: tabular-nums;
}

.kiwi-gm-pc {
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-weight: var(--weight-bold, 700);
}

.kiwi-gm-score--me {
    background: var(--color-chip-bg-hero, rgba(128, 128, 128, 0.15));
    color: var(--color-accent, inherit);
}

.kiwi-gm-scores--me {
    margin-top: 0.35rem;
}

.kiwi-gm-legend {
    margin: 0.4rem 0 0;
    font-size: var(--text-2xs, 0.78em);
    color: var(--color-text-secondary, inherit);
}

/* Touch: standalone targets reach 44px (rows, buttons); a player row matches it so the
   overlays of two neighbouring "Invite" buttons do not share the gap. */
@media (pointer: coarse) {
    .kiwi-gm-row {
        min-height: 2.6rem;
    }

    .kiwi-gm-person {
        min-height: 2.4rem;
    }

    .kiwi-gm .btn-cta.sm,
    .kiwi-gm .btn-ghost.sm,
    .kiwi-gm-create select.input {
        min-height: 2.3rem;
    }

    .kiwi-gm .btn-icon {
        width: 2.3rem;
        height: 2.3rem;
    }
}

@layer kiwi-gm-fallback {
    /* Without the EuropNet objects: structure and a readable skin from Kiwi's own colours.
       Only properties the theme declares itself are set here, so none of them survives
       under the theme (a layered value the theme never restates would still apply). */
    .kiwi-gm.ctx {
        display: flex;
        flex-direction: column;
        min-height: 0;
    }

    .kiwi-gm .surface-head {
        display: flex;
        gap: 0.6rem;
        padding: 0.65rem 0.75rem;
        border-bottom: 1px solid rgba(128, 128, 128, 0.25);
    }

    .kiwi-gm .surface-title {
        font-weight: 700;
    }

    .kiwi-gm .ctx-tabs {
        display: flex;
        flex-shrink: 0;
        border-bottom: 1px solid rgba(128, 128, 128, 0.25);
    }

    .kiwi-gm .ctx-tab {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.2rem;
        padding: 0.6rem 0.4rem;
        border: 0;
        border-bottom: 2px solid transparent;
        background: none;
        color: inherit;
        font-size: 0.85em;
        cursor: pointer;
    }

    .kiwi-gm .ctx-tab.active {
        border-bottom-color: currentColor;
        font-weight: 700;
    }

    .kiwi-gm .ctx-body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 0.6rem;
    }

    .kiwi-gm .ctx-block {
        border-radius: 6px;
        box-shadow: inset 0 0 0 1px rgba(128, 128, 128, 0.3);
    }

    .kiwi-gm .ctx-h {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        margin: 0;
        font-size: 0.75em;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .kiwi-gm .btn-icon,
    .kiwi-gm .btn-text {
        border: 0;
        background: none;
        color: inherit;
        cursor: pointer;
    }

    .kiwi-gm .btn-text {
        padding: 0.2rem 0.5rem;
        font-weight: 700;
    }

    .kiwi-gm .btn-ghost,
    .kiwi-gm .btn-cta {
        padding: 0.2rem 0.8rem;
        border: 1px solid rgba(128, 128, 128, 0.4);
        border-radius: 999px;
        background: none;
        color: inherit;
        cursor: pointer;
    }

    .kiwi-gm .btn-cta {
        background: rgba(128, 128, 128, 0.2);
        font-weight: 700;
    }

    .kiwi-gm .badge {
        display: inline-flex;
        align-items: center;
        padding: 0 0.45rem;
        border-radius: 999px;
        background: rgba(128, 128, 128, 0.2);
        font-size: 0.8em;
    }

    .kiwi-gm .chip {
        display: inline-flex;
        align-items: center;
        padding: 0 0.45rem;
        border: 1px solid rgba(128, 128, 128, 0.4);
        border-radius: 999px;
        font-size: 0.85em;
    }

    .kiwi-gm .pres {
        display: inline-block;
        width: 0.5rem;
        height: 0.5rem;
        border-radius: 50%;
        background: #2ecc71;
    }

    .kiwi-gm .inline-note {
        display: flex;
        gap: 0.5rem;
        padding: 0.45rem 0.6rem;
        border-radius: 4px;
        background: rgba(128, 128, 128, 0.12);
    }

    .kiwi-gm .inline-note.danger {
        background: rgba(180, 40, 40, 0.12);
    }
}
</style>
