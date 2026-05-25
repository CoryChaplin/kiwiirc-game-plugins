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
                        <span v-if="isMyBattleTurn" class="bs-board-panel__badge">{{ $t('kiwi-games:bs_fire_here') }}</span>
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
            if (this.game.getFirePending()) return 'ÔÅ│';
            if (this.game.getPhase() === 'placement') return 'ÔÜô';
            if (this.game.getPhase() === 'battle' && this.game.isMyTurn()) return '­ƒÄ»';
            if (this.game.getPhase() === 'battle') return 'Ôîø';
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
                // eslint-disable-next-line no-undef
                kiwi.emit('plugin-kiwi-games.game-started', { game: 'battleship' });
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
}
.bs-cell:disabled {
    cursor: default;
}
.bs-cell--ship { background: #99b8d8; }
.bs-cell--hit { background: #c0392b; }
.bs-cell--targeted { background: #95a5a6; }
.bs-cell--enemy-pending { background: #bdc3c7; opacity: 0.85; }
.bs-cell--enemy-hit { background: #e74c3c; }
.bs-cell--enemy-miss { background: #7f8c8d; }
.bs-cell--enemy-revealed {
    background: #2ecc71;
    box-shadow: inset 0 0 0 2px #27ae60;
}
</style>
