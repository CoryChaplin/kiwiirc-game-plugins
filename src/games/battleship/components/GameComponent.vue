<template>
    <div id="battleship">
        <div v-if="game && game.getShowInvite()" class="bs-invite">
            <span>{{ $t('kiwi-games:bs_invite_text') }}</span>
            <div class="bs-actions">
                <button class="u-button u-button-primary" @click="inviteClicked(true)">
                    {{ $t('kiwi-games:common_accept') }}
                </button>
                <button class="u-button" @click="inviteClicked(false)">
                    {{ $t('kiwi-games:common_decline') }}
                </button>
            </div>
        </div>

        <div v-if="game && game.getShowGame()" class="bs-game">
            <div
                v-if="game.getGameOver()"
                class="bs-result"
                :class="game.isLocalWinner() ? 'bs-result--won' : 'bs-result--lost'"
            >
                <span class="bs-result__icon">{{ game.isLocalWinner() ? '🏆' : '⚓' }}</span>
                <div class="bs-result__body">
                    <span class="bs-result__title">{{ game.getGameMessage() }}</span>
                </div>
            </div>
            <div v-else class="bs-status" :class="statusClass">
                <span v-if="showTurnPulse" class="bs-status__pulse" aria-hidden="true"></span>
                <span class="bs-status__icon">{{ statusIcon }}</span>
                <span class="bs-status__text">{{ game.getGameMessage() }}</span>
            </div>

            <div v-if="game.getPhase() === 'placement'" class="bs-placement-actions">
                <button class="u-button" @click="toggleOrientation">
                    {{ game.isPlacementHorizontal() ? $t('kiwi-games:bs_orientation_horizontal') : $t('kiwi-games:bs_orientation_vertical') }}
                </button>
                <button class="u-button" @click="randomPlacement">{{ $t('kiwi-games:bs_random') }}</button>
                <button class="u-button" @click="clearPlacement">{{ $t('kiwi-games:bs_clear') }}</button>
                <button class="u-button u-button-primary" :disabled="!canReady" @click="readyPlacement">
                    {{ $t('kiwi-games:bs_ready') }}
                </button>
            </div>

            <div class="bs-boards">
                <div>
                    <h4>{{ $t('kiwi-games:bs_my_board') }}</h4>
                    <div class="bs-grid">
                        <button
                            v-for="cell in myBoardCells"
                            :key="'m-' + cell.r + '-' + cell.c"
                            class="bs-cell"
                            :class="myCellClass(cell)"
                            @click="myBoardClicked(cell.r, cell.c)"
                        ></button>
                    </div>
                </div>

                <div class="bs-board-panel" :class="{ 'bs-board-panel--active': isMyBattleTurn }">
                    <h4 class="bs-board-panel__title">
                        {{ $t('kiwi-games:bs_enemy_board') }}
                        <span
                            v-if="enemyBoardBadge"
                            class="bs-board-panel__badge"
                            :class="enemyBoardBadgeClass"
                        >{{ enemyBoardBadge }}</span>
                    </h4>
                    <div class="bs-grid" :class="{ 'bs-grid--fire': isMyBattleTurn }">
                        <button
                            v-for="cell in enemyBoardCells"
                            :key="'e-' + cell.r + '-' + cell.c"
                            class="bs-cell"
                            :class="enemyCellClass(cell)"
                            :disabled="game.getGameOver()"
                            @click="enemyBoardClicked(cell.r, cell.c)"
                        ></button>
                    </div>
                </div>
            </div>

            <GameFeedback
                :show="game.getGameOver()"
                game-label="Battleship"
                :reset-key="feedbackResetKey"
            />
        </div>
    </div>
</template>

<script>
import * as Utils from '../libs/Utils.js';
import GameFeedback from '../../shared/components/GameFeedback.vue';
import { announceGameStart } from '../../shared/reportGameResult.js';

export default {
    components: { GameFeedback },
    computed: {
        game() {
            // eslint-disable-next-line no-undef
            let buffer = kiwi.state.getActiveBuffer();
            return buffer ? Utils.getGame(buffer.name) : null;
        },
        canReady() {
            return this.game && this.game.allShipsPlaced && this.game.allShipsPlaced() && !this.game.isLocalReady();
        },
        feedbackResetKey() {
            if (!this.game) return '';
            return `${this.game.getRemotePlayer()}:${this.game.getGameOver() ? '1' : '0'}`;
        },
        isMyBattleTurn() {
            return !!(
                this.game
                && this.game.getPhase() === 'battle'
                && !this.game.getGameOver()
                && this.game.isMyTurn()
                && !this.game.getFirePending()
            );
        },
        enemyBoardBadge() {
            if (!this.game || this.game.getPhase() !== 'battle' || this.game.getGameOver()) {
                return '';
            }
            if (this.isMyBattleTurn) {
                return this.$t('kiwi-games:bs_fire_here');
            }
            const result = this.game.getLastLocalShotResult();
            if (result === 'sunk') return this.$t('kiwi-games:bs_badge_sunk');
            if (result === 'hit') return this.$t('kiwi-games:bs_badge_hit');
            if (result === 'miss') return this.$t('kiwi-games:bs_badge_miss');
            return '';
        },
        enemyBoardBadgeClass() {
            if (!this.game || this.game.getPhase() !== 'battle' || this.isMyBattleTurn) {
                return {};
            }
            const result = this.game.getLastLocalShotResult();
            return {
                'bs-board-panel__badge--hit': result === 'hit',
                'bs-board-panel__badge--miss': result === 'miss',
                'bs-board-panel__badge--sunk': result === 'sunk',
            };
        },
        showTurnPulse() {
            return this.isMyBattleTurn;
        },
        statusClass() {
            if (!this.game) return '';
            if (this.game.getFirePending()) return 'bs-status--pending';
            if (this.game.getPhase() === 'placement') return 'bs-status--placement';
            if (this.game.getPhase() === 'battle' && this.game.isMyTurn()) return 'bs-status--myturn';
            if (this.game.getPhase() === 'battle') return 'bs-status--waiting';
            return '';
        },
        statusIcon() {
            if (!this.game) return '';
            if (this.game.getFirePending()) return '⏳';
            if (this.game.getPhase() === 'placement') return '⚓';
            if (this.game.getPhase() === 'battle' && this.game.isMyTurn()) return '🎯';
            if (this.game.getPhase() === 'battle') return '⌛';
            return '';
        },
        myBoardCells() {
            const out = [];
            if (!this.game) return out;
            const grid = this.game.getFleetGrid();
            for (let r = 0; r < grid.length; r++) {
                for (let c = 0; c < grid[r].length; c++) {
                    out.push({ r, c, ...grid[r][c] });
                }
            }
            return out;
        },
        enemyBoardCells() {
            const out = [];
            if (!this.game) return out;
            const grid = this.game.getTargetGrid();
            for (let r = 0; r < grid.length; r++) {
                for (let c = 0; c < grid[r].length; c++) {
                    out.push({ r, c, ...grid[r][c] });
                }
            }
            return out;
        },
    },
    methods: {
        myCellClass(cell) {
            return {
                'bs-cell--ship': !!cell.shipId,
                'bs-cell--hit': cell.hit,
                'bs-cell--targeted': cell.targeted && !cell.hit,
            };
        },
        enemyCellClass(cell) {
            return {
                'bs-cell--enemy-pending': cell.state === 'P',
                'bs-cell--enemy-hit': cell.state === 'H' || cell.state === 'S',
                'bs-cell--enemy-miss': cell.state === 'M',
                'bs-cell--enemy-revealed': cell.state === 'R',
            };
        },
        inviteClicked(accepted) {
            // eslint-disable-next-line no-undef
            let network = kiwi.state.getActiveNetwork();
            // eslint-disable-next-line no-undef
            let remotePlayer = kiwi.state.getActiveBuffer().name;
            let game = Utils.getGame(remotePlayer);
            game.setShowInvite(false);
            game.setInviteSent(false);
            if (accepted) {
                let startPlayer = Math.floor(Math.random() * 2) === 0 ? network.nick : remotePlayer;
                game.startGame(startPlayer);
                Utils.sendData(network, remotePlayer, { cmd: 'invite_accepted', startPlayer });
                announceGameStart(network, {
                    game: 'battleship',
                    players: [network.nick, remotePlayer],
                });
            } else {
                Utils.sendData(network, remotePlayer, { cmd: 'invite_declined' });
                // eslint-disable-next-line no-undef
                kiwi.emit('mediaviewer.hide');
            }
        },
        toggleOrientation() {
            if (!this.game || this.game.isLocalReady()) return;
            this.game.togglePlacementOrientation();
        },
        randomPlacement() {
            if (!this.game) return;
            this.game.randomPlacement();
        },
        clearPlacement() {
            if (!this.game) return;
            this.game.clearPlacement();
        },
        readyPlacement() {
            if (!this.game) return;
            if (this.game.setLocalReady()) {
                // eslint-disable-next-line no-undef
                let network = kiwi.state.getActiveNetwork();
                Utils.sendData(network, this.game.getRemotePlayer(), { cmd: 'placement_ready' });
            }
        },
        myBoardClicked(row, col) {
            if (!this.game || this.game.getPhase() !== 'placement' || this.game.isLocalReady()) return;
            this.game.placeNextShip(row, col);
        },
        enemyBoardClicked(row, col) {
            if (!this.game || !this.game.canFireAt(row, col)) return;
            const turn = this.game.getGameTurn();
            this.game.markPendingShot(row, col);
            // eslint-disable-next-line no-undef
            let network = kiwi.state.getActiveNetwork();
            Utils.sendData(network, this.game.getRemotePlayer(), {
                cmd: 'fire',
                row,
                col,
                turn,
            });
        },
    },
};
</script>

<style>
#battleship { padding: 10px; }
.bs-invite { margin-bottom: 10px; }
.bs-actions { display: flex; gap: 8px; margin-top: 8px; }
.bs-status {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
    padding: 10px 16px;
    font-weight: 600;
    border-radius: 10px;
    background: var(--brand-default-bg);
    border: 2px solid var(--comp-border, #b2b2b2);
    position: relative;
    overflow: hidden;
}
.bs-status__icon {
    font-size: 1.35em;
    line-height: 1;
    flex-shrink: 0;
}
.bs-status__text {
    line-height: 1.35;
}
.bs-status--myturn {
    border-color: var(--brand-primary, #42b992);
    background: linear-gradient(135deg, rgba(66, 185, 146, 0.18), rgba(66, 185, 146, 0.06));
    box-shadow: 0 0 0 3px rgba(66, 185, 146, 0.2), 0 2px 10px rgba(66, 185, 146, 0.25);
    color: #1a6b4f;
    font-size: 1.05em;
}
.bs-status--waiting {
    opacity: 0.85;
    border-color: var(--comp-border, #b2b2b2);
}
.bs-status--pending {
    border-color: #e6a800;
    background: linear-gradient(135deg, rgba(230, 168, 0, 0.12), rgba(230, 168, 0, 0.04));
    color: #8a6d00;
}
.bs-status--placement {
    border-color: #3498db;
    background: linear-gradient(135deg, rgba(52, 152, 219, 0.12), rgba(52, 152, 219, 0.04));
}
.bs-status__pulse {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    animation: bs-turn-pulse 1.4s ease-in-out infinite;
    box-shadow: inset 0 0 0 2px rgba(66, 185, 146, 0.35);
}
@keyframes bs-turn-pulse {
    0%, 100% { opacity: 0.35; }
    50% { opacity: 1; }
}
.bs-board-panel {
    padding: 8px;
    border-radius: 10px;
    border: 2px solid transparent;
    transition: border-color 0.2s, box-shadow 0.2s;
}
.bs-board-panel--active {
    border-color: var(--brand-primary, #42b992);
    box-shadow: 0 0 0 3px rgba(66, 185, 146, 0.18);
    background: rgba(66, 185, 146, 0.04);
}
.bs-board-panel__title {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin: 0 0 8px;
}
.bs-board-panel__badge {
    font-size: 0.75em;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 2px 8px;
    border-radius: 12px;
    background: var(--brand-primary, #42b992);
    color: #fff;
    animation: bs-badge-blink 1.2s ease-in-out infinite;
}
.bs-board-panel__badge--hit {
    background: #e74c3c;
    animation: none;
}
.bs-board-panel__badge--miss {
    background: #3498db;
    animation: none;
}
.bs-board-panel__badge--sunk {
    background: #922b21;
    animation: none;
}
@keyframes bs-badge-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.65; }
}
.bs-grid--fire .bs-cell:not(.bs-cell--enemy-hit):not(.bs-cell--enemy-miss):not(.bs-cell--enemy-pending):not(.bs-cell--enemy-revealed) {
    cursor: crosshair;
    box-shadow: 0 0 0 1px rgba(66, 185, 146, 0.35);
}
.bs-grid--fire .bs-cell:not(.bs-cell--enemy-hit):not(.bs-cell--enemy-miss):not(.bs-cell--enemy-pending):not(.bs-cell--enemy-revealed):hover {
    background: #b8e6d4;
    transform: scale(1.08);
}
.bs-result {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 14px;
    padding: 14px 16px;
    border-radius: 10px;
    border: 2px solid transparent;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}
.bs-result--won {
    background: linear-gradient(135deg, rgba(46, 204, 113, 0.15), rgba(39, 174, 96, 0.08));
    border-color: #27ae60;
}
.bs-result--lost {
    background: linear-gradient(135deg, rgba(231, 76, 60, 0.12), rgba(192, 57, 43, 0.06));
    border-color: #c0392b;
}
.bs-result__icon {
    font-size: 1.8em;
    line-height: 1;
    flex-shrink: 0;
}
.bs-result__body {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}
.bs-result__title {
    font-size: 1.1em;
    font-weight: 700;
    line-height: 1.35;
    color: var(--brand-default-fg);
}
.bs-result--won .bs-result__title { color: #1e8449; }
.bs-result--lost .bs-result__title { color: #922b21; }
.bs-placement-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.bs-boards { display: flex; gap: 24px; flex-wrap: wrap; }
.bs-grid {
    display: grid;
    grid-template-columns: repeat(10, 24px);
    gap: 3px;
}
.bs-cell {
    width: 24px;
    height: 24px;
    border: 1px solid var(--comp-border, #999);
    background: #e9f2fb;
    padding: 0;
    cursor: pointer;
    transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
    position: relative;
    overflow: hidden;
}
.bs-cell:disabled {
    cursor: default;
}
.bs-cell::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
}
.bs-cell--ship {
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(0, 0, 0, 0.14)),
        repeating-linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.16) 0px,
            rgba(255, 255, 255, 0.16) 3px,
            rgba(0, 0, 0, 0.06) 3px,
            rgba(0, 0, 0, 0.06) 6px
        ),
        #2f6fae;
    box-shadow:
        inset 0 0 0 1px rgba(0, 0, 0, 0.18),
        inset 0 1px 0 rgba(255, 255, 255, 0.25);
}
.bs-cell--hit,
.bs-cell--enemy-hit {
    background: #e74c3c;
    box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.18);
    animation: bs-hit-pop 260ms ease-out;
}
.bs-cell--hit::before,
.bs-cell--enemy-hit::before {
    content: '';
    position: absolute;
    inset: 0;
    background-repeat: no-repeat;
    background-position: center;
    background-size: 85% 85%;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23fff5c2' d='M12 2l1.7 5.2L19 5l-3.3 4.3L21 12l-5.3 1.3L19 19l-5.3-2.2L12 22l-1.7-5.2L5 19l3.3-5.7L3 12l5.3-2.7L5 5l5.3 2.2L12 2z'/%3E%3Ccircle cx='12' cy='12' r='2.4' fill='%23ff7a59'/%3E%3C/svg%3E");
    filter: drop-shadow(0 1px 0 rgba(0,0,0,.2));
    animation: bs-hit-burst 420ms ease-out;
}
.bs-cell--hit::after,
.bs-cell--enemy-hit::after {
    background:
        radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.65) 0%, rgba(255, 255, 255, 0.0) 60%);
    transform: scale(0.2);
    opacity: 0;
    animation: bs-hit-ring 520ms ease-out;
}
.bs-cell--targeted {
    background: #6c8aa7;
    animation: bs-miss-pop 260ms ease-out;
}
.bs-cell--targeted::before {
    content: '';
    position: absolute;
    inset: 0;
    background-repeat: no-repeat;
    background-position: center;
    background-size: 75% 75%;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='7.5' fill='none' stroke='%23eaf4ff' stroke-width='2' opacity='.85'/%3E%3Ccircle cx='12' cy='12' r='2' fill='%23eaf4ff' opacity='.9'/%3E%3C/svg%3E");
    opacity: 0.95;
    animation: bs-miss-ripple 680ms ease-out;
}
.bs-cell--targeted::after {
    background:
        radial-gradient(circle at 45% 55%, rgba(255, 255, 255, 0.55) 0 2px, transparent 3px),
        radial-gradient(circle at 60% 40%, rgba(255, 255, 255, 0.45) 0 1px, transparent 2px);
    opacity: 0;
    transform: translateY(4px);
    animation: bs-miss-bubbles 720ms ease-out;
}
.bs-cell--enemy-pending { background: #bdc3c7; opacity: 0.85; }
.bs-cell--enemy-miss {
    background: #cfe6ff;
    box-shadow: inset 0 0 0 2px #4a86c5;
    animation: bs-miss-pop 260ms ease-out;
}
.bs-cell--enemy-miss::before {
    content: '';
    position: absolute;
    inset: 0;
    background-repeat: no-repeat;
    background-position: center;
    background-size: 70% 70%;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%231a4b7a' opacity='.22' d='M12 4c2.8 4.1 6.4 6.4 6.4 9.2A6.4 6.4 0 0 1 12 19.6 6.4 6.4 0 0 1 5.6 13.2C5.6 10.4 9.2 8.1 12 4z'/%3E%3Ccircle cx='9' cy='13.2' r='1.2' fill='%231a4b7a' opacity='.35'/%3E%3Ccircle cx='15.2' cy='12.4' r='1' fill='%231a4b7a' opacity='.3'/%3E%3C/svg%3E");
    animation: bs-miss-ripple 680ms ease-out;
}
.bs-cell--enemy-revealed {
    background: #2ecc71;
    box-shadow: inset 0 0 0 2px #27ae60;
}

@keyframes bs-hit-pop {
    0% { transform: scale(0.92); }
    60% { transform: scale(1.08); }
    100% { transform: scale(1); }
}
@keyframes bs-hit-burst {
    0% { transform: scale(0.7) rotate(-6deg); opacity: 0; }
    35% { transform: scale(1.05) rotate(0deg); opacity: 1; }
    100% { transform: scale(1.0) rotate(2deg); opacity: 1; }
}
@keyframes bs-hit-ring {
    0% { transform: scale(0.15); opacity: 0; }
    25% { opacity: 0.85; }
    100% { transform: scale(1.35); opacity: 0; }
}
@keyframes bs-miss-pop {
    0% { transform: scale(0.94); }
    55% { transform: scale(1.06); }
    100% { transform: scale(1); }
}
@keyframes bs-miss-ripple {
    0% { transform: scale(0.55); opacity: 0; }
    25% { opacity: 0.95; }
    100% { transform: scale(1.15); opacity: 0; }
}
@keyframes bs-miss-bubbles {
    0% { transform: translateY(6px); opacity: 0; }
    30% { opacity: 0.65; }
    100% { transform: translateY(-6px); opacity: 0; }
}
</style>
