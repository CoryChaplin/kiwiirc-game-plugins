<template>
    <div id="connectfour">
        <!-- Invite panel -->
        <div
            v-if="game && game.getShowInvite()"
            class="cf-invite"
            :class="{ 'cf-invite--stacked': game.getShowGame() }"
        >
            <span class="cf-invite__text">You have been invited to play Connect Four</span>
            <div class="cf-invite__actions">
                <button class="u-button u-button-primary cf-invite__btn" @click="inviteClicked(true)">
                    Accept
                </button>
                <button class="cf-invite__btn cf-invite__btn--decline" @click="inviteClicked(false)">
                    Decline
                </button>
            </div>
        </div>

        <!-- Game area -->
        <div v-if="game && game.getShowGame()" class="cf-game">
            <!-- Turn / status indicator -->
            <div class="cf-status" :class="statusClass">
                <span v-if="!game.getGameOver()" class="cf-status__disc" :style="turnDiscStyle"></span>
                <span v-else class="cf-status__trophy">🏆</span>
                <span class="cf-status__text">{{ game.getGameMessage() }}</span>
            </div>

            <!-- Board wrapper -->
            <div class="cf-board-wrapper">
                <!-- Drop-zone row above the board -->
                <div class="cf-dropzone" @mouseleave="hoveredCol = null">
                    <div
                        v-for="(_, cIdx) in boardByColumns"
                        :key="cIdx"
                        class="cf-dropzone__cell"
                        :class="{ 'cf-dropzone__cell--active': isViableColumn(cIdx) }"
                        @mouseenter="hoveredCol = isViableColumn(cIdx) ? cIdx : null"
                        @click="columnClicked(cIdx)"
                    >
                        <transition name="ghost-fade">
                            <div
                                v-if="hoveredCol === cIdx && isViableColumn(cIdx)"
                                class="cf-disc cf-disc--ghost"
                                :class="myDiscClass"
                            ></div>
                        </transition>
                    </div>
                </div>

                <!-- Blue board frame -->
                <div class="cf-board" @mouseleave="hoveredCol = null">
                    <div
                        v-for="(col, cIdx) in boardByColumns"
                        :key="cIdx"
                        class="cf-board__col"
                        :class="{ 'cf-board__col--hoverable': isViableColumn(cIdx) }"
                        @mouseenter="hoveredCol = isViableColumn(cIdx) ? cIdx : null"
                        @click="columnClicked(cIdx)"
                    >
                        <div
                            v-for="(cell, rIdx) in col"
                            :key="rIdx"
                            class="cf-board__slot"
                        >
                            <div
                                v-if="cell.val !== ''"
                                :key="cell.id[0] + '-' + cell.id[1] + '-' + (isLastDrop(cell) ? lastDrop.turn : 0)"
                                class="cf-disc"
                                :class="[
                                    cell.val === 'X' ? 'cf-disc--red' : 'cf-disc--yellow',
                                    cell.win ? 'cf-disc--win' : (isLastDrop(cell) ? 'cf-disc--dropping' : ''),
                                ]"
                                :style="isLastDrop(cell) && !cell.win ? dropStyle(cell.id[0]) : {}"
                            ></div>
                            <div v-else class="cf-board__hole"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import * as Utils from '../libs/Utils.js';

export default {
    data() {
        return {
            lastDrop: null,
            hoveredCol: null,
            prevBoardSnapshot: null,
        };
    },
    computed: {
        game() {
            // eslint-disable-next-line no-undef
            let buffer = kiwi.state.getActiveBuffer();
            return Utils.getGame(buffer.name);
        },
        gameTurn() {
            return this.game ? this.game.getGameTurn() : 0;
        },
        boardByColumns() {
            const board = this.game ? this.game.getGameBoard() : [];
            const cols = [];
            for (let c = 0; c < 7; c++) {
                const col = [];
                for (let r = 0; r < 6; r++) {
                    col.push(board[r] ? board[r][c] : { val: '', win: false, id: [r, c] });
                }
                cols.push(col);
            }
            return cols;
        },
        myDiscClass() {
            if (!this.game) return '';
            return this.game.getMarker() === 'X' ? 'cf-disc--red' : 'cf-disc--yellow';
        },
        statusClass() {
            if (!this.game) return '';
            if (this.game.getGameOver()) return 'cf-status--gameover';
            return this.game.isMyTurn() ? 'cf-status--myturn' : 'cf-status--waiting';
        },
        turnDiscStyle() {
            if (!this.game || this.game.getGameOver()) return {};
            return {
                background: this.game.getMarker() === 'X'
                    ? 'radial-gradient(circle at 35% 30%, #ff8a80, #e53935 55%, #b71c1c)'
                    : 'radial-gradient(circle at 35% 30%, #fff176, #fdd835 55%, #f9a825)',
            };
        },
    },
    watch: {
        gameTurn(newVal, oldVal) {
            if (!this.game || newVal <= oldVal) return;
            const board = this.game.getGameBoard();
            if (this.prevBoardSnapshot) {
                outer: for (let r = 0; r < 6; r++) {
                    for (let c = 0; c < 7; c++) {
                        if (this.prevBoardSnapshot[r][c] !== board[r][c].val && board[r][c].val !== '') {
                            this.lastDrop = { row: r, col: c, turn: newVal };
                            break outer;
                        }
                    }
                }
            }
            this.prevBoardSnapshot = board.map((row) => row.map((cell) => cell.val));
        },
    },
    methods: {
        isViableColumn(colIndex) {
            // eslint-disable-next-line no-undef
            let buffer = kiwi.state.getActiveBuffer();
            let game = Utils.getGame(buffer.name);
            if (!game || game.getGameOver() || !game.isMyTurn()) {
                return false;
            }
            let board = game.getGameBoard();
            return board.some((row) => row[colIndex].val === '');
        },
        isLastDrop(cell) {
            return this.lastDrop &&
                this.lastDrop.row === cell.id[0] &&
                this.lastDrop.col === cell.id[1];
        },
        dropStyle(rowIndex) {
            const cellSize = 64;
            const dropPx = (rowIndex + 1) * cellSize;
            const duration = Math.max(0.35, rowIndex * 0.07 + 0.25);
            return {
                '--drop-distance': dropPx + 'px',
                '--drop-duration': duration + 's',
            };
        },
        columnClicked(colIndex) {
            // eslint-disable-next-line no-undef
            let buffer = kiwi.state.getActiveBuffer();
            let game = Utils.getGame(buffer.name);
            if (!game || !this.isViableColumn(colIndex)) {
                return;
            }

            let rowIndex = game.placeDisc(colIndex);
            if (rowIndex === -1) {
                return;
            }

            this.lastDrop = { row: rowIndex, col: colIndex, turn: game.getGameTurn() };
            this.prevBoardSnapshot = game.getGameBoard().map((row) => row.map((cell) => cell.val));

            Utils.sendData(buffer.getNetwork(), game.getRemotePlayer(), {
                cmd: 'action', column: colIndex, turn: game.getGameTurn(),
            });
            game.incrementGameTurn();
            game.checkGame();
            if (!game.getGameOver() && !game.isMyTurn()) {
                game.setTurnMessage();
            }
        },
        inviteClicked(accepted) {
            /* eslint-disable no-undef */
            let network = kiwi.state.getActiveNetwork();
            let remotePlayer = kiwi.state.getActiveBuffer().name;
            /* eslint-enable no-undef */

            let game = Utils.getGame(remotePlayer);
            game.setShowInvite(false);
            game.setInviteSent(false);
            if (accepted) {
                let startPlayer = Math.floor(Math.random() * 2) === 0 ? network.nick : remotePlayer;
                game.startGame(startPlayer);
                game.setTurnMessage();
                Utils.sendData(network, remotePlayer, {
                    cmd: 'invite_accepted', startPlayer: startPlayer,
                });
            } else {
                Utils.sendData(network, remotePlayer, { cmd: 'invite_declined' });
                // eslint-disable-next-line no-undef
                kiwi.emit('mediaviewer.hide');
            }
        },
    },
};
</script>

<style>
/* ============================================================
   Root container
   ============================================================ */
#connectfour {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 12px 8px 20px;
    font-family: 'Source Sans Pro', Helvetica, sans-serif;
    -webkit-user-select: none;
    user-select: none;
}

/* ============================================================
   Invite panel
   ============================================================ */
#connectfour .cf-invite {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 14px 20px;
    margin-bottom: 6px;
    background: var(--brand-default-bg);
    border: 1px solid var(--comp-border, #b2b2b2);
    border-radius: 8px;
    max-width: 480px;
    width: 100%;
    box-sizing: border-box;
}

#connectfour .cf-invite--stacked {
    margin-bottom: 14px;
}

#connectfour .cf-invite__text {
    color: var(--brand-default-fg);
    font-size: 1em;
    font-weight: 600;
    text-align: center;
    line-height: 1.4;
}

#connectfour .cf-invite__actions {
    display: flex;
    gap: 10px;
}

#connectfour .cf-invite__btn {
    padding: 5px 18px;
    border-radius: 5px;
    font-size: 0.95em;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: opacity 0.15s, transform 0.1s;
}

#connectfour .cf-invite__btn:hover {
    opacity: 0.85;
    transform: translateY(-1px);
}

#connectfour .cf-invite__btn:active {
    transform: translateY(0);
}

#connectfour .cf-invite__btn--decline {
    background-color: var(--brand-error, #bf5155);
    color: #fff;
}

/* ============================================================
   Status bar
   ============================================================ */
#connectfour .cf-status {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    padding: 6px 18px;
    border-radius: 20px;
    font-size: 0.95em;
    font-weight: 600;
    color: var(--brand-default-fg);
    background: var(--brand-default-bg);
    border: 1px solid var(--comp-border, #b2b2b2);
    transition: border-color 0.3s, background 0.3s;
    min-height: 34px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

#connectfour .cf-status--myturn {
    border-color: var(--brand-primary, #42b992);
    background: var(--brand-default-bg);
    box-shadow: 0 0 0 2px rgba(66, 185, 146, 0.15), 0 1px 4px rgba(0, 0, 0, 0.08);
}

#connectfour .cf-status--gameover {
    border-color: #e6a800;
    box-shadow: 0 0 0 2px rgba(230, 168, 0, 0.2), 0 1px 4px rgba(0, 0, 0, 0.08);
}

#connectfour .cf-status__disc {
    display: inline-block;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
    flex-shrink: 0;
}

#connectfour .cf-status__trophy {
    font-size: 1em;
    flex-shrink: 0;
}

#connectfour .cf-status__text {
    line-height: 1.2;
    white-space: nowrap;
}

/* ============================================================
   Board wrapper
   ============================================================ */
#connectfour .cf-board-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
}

/* ============================================================
   Drop-zone row (hover targets above board)
   ============================================================ */
#connectfour .cf-dropzone {
    display: flex;
    flex-direction: row;
    gap: 6px;
    padding: 0 10px;
    height: 44px;
    align-items: center;
    width: 100%;
    box-sizing: border-box;
}

#connectfour .cf-dropzone__cell {
    flex: 1;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: default;
}

#connectfour .cf-dropzone__cell--active {
    cursor: pointer;
}

/* Ghost disc transition */
.ghost-fade-enter-active,
.ghost-fade-leave-active {
    transition: opacity 0.1s ease, transform 0.1s ease;
}
.ghost-fade-enter-from,
.ghost-fade-leave-to {
    opacity: 0;
    transform: scale(0.75);
}

/* ============================================================
   Board frame
   ============================================================ */
#connectfour .cf-board {
    display: flex;
    flex-direction: row;
    gap: 6px;
    padding: 10px;
    background: #1a3a6b;
    border-radius: 12px;
    box-shadow:
        0 8px 28px rgba(0, 0, 0, 0.5),
        0 2px 6px rgba(0, 0, 0, 0.3),
        inset 0 2px 5px rgba(255, 255, 255, 0.1),
        inset 0 -4px 8px rgba(0, 0, 0, 0.4);
    position: relative;
}

/* Shimmer highlight */
#connectfour .cf-board::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 40%;
    border-radius: 12px 12px 0 0;
    background: linear-gradient(
        180deg,
        rgba(255, 255, 255, 0.07) 0%,
        transparent 100%
    );
    pointer-events: none;
}

/* ============================================================
   Board columns
   ============================================================ */
#connectfour .cf-board__col {
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-radius: 6px;
    padding: 2px;
    transition: background 0.15s;
}

#connectfour .cf-board__col--hoverable:hover {
    background: rgba(255, 255, 255, 0.1);
    cursor: pointer;
}

/* ============================================================
   Board slots
   ============================================================ */
#connectfour .cf-board__slot {
    width: 54px;
    height: 54px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: visible;
}

/* Empty hole */
#connectfour .cf-board__hole {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #0b1d3a;
    box-shadow:
        inset 0 4px 10px rgba(0, 0, 0, 0.8),
        inset 0 1px 3px rgba(0, 0, 0, 0.5),
        0 1px 2px rgba(255, 255, 255, 0.04);
}

/* ============================================================
   Discs
   ============================================================ */
#connectfour .cf-disc {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    position: relative;
    flex-shrink: 0;
}

/* Red disc (X — odd turns) */
#connectfour .cf-disc--red {
    background: radial-gradient(circle at 35% 30%, #ff8a80, #e53935 55%, #b71c1c);
    box-shadow:
        0 4px 10px rgba(183, 28, 28, 0.65),
        0 1px 3px rgba(0, 0, 0, 0.4),
        inset 0 -3px 6px rgba(0, 0, 0, 0.25),
        inset 0 2px 5px rgba(255, 200, 200, 0.35);
}

/* Yellow disc (O — even turns) */
#connectfour .cf-disc--yellow {
    background: radial-gradient(circle at 35% 30%, #fff176, #fdd835 55%, #f9a825);
    box-shadow:
        0 4px 10px rgba(249, 168, 37, 0.65),
        0 1px 3px rgba(0, 0, 0, 0.35),
        inset 0 -3px 6px rgba(0, 0, 0, 0.2),
        inset 0 2px 5px rgba(255, 255, 200, 0.45);
}

/* Ghost disc (hover preview) */
#connectfour .cf-disc--ghost {
    width: 38px;
    height: 38px;
    opacity: 0.5;
    pointer-events: none;
}

/* ============================================================
   Drop animation
   ============================================================ */
@keyframes disc-drop {
    0% {
        transform: translateY(calc(-1 * var(--drop-distance, 200px)));
        animation-timing-function: ease-in;
    }
    72% {
        transform: translateY(0);
        animation-timing-function: cubic-bezier(0.33, 1, 0.68, 1);
    }
    83% {
        transform: translateY(-9px);
        animation-timing-function: ease-in;
    }
    91% {
        transform: translateY(0);
        animation-timing-function: ease-out;
    }
    96% {
        transform: translateY(-4px);
        animation-timing-function: ease-in;
    }
    100% {
        transform: translateY(0);
    }
}

#connectfour .cf-disc--dropping {
    animation: disc-drop var(--drop-duration, 0.45s) forwards;
}

/* ============================================================
   Win animation
   ============================================================ */
@keyframes disc-win-pulse {
    0%, 100% {
        filter: brightness(1);
        transform: scale(1);
    }
    50% {
        filter: brightness(1.3);
        transform: scale(1.08);
        box-shadow:
            0 0 16px 5px rgba(255, 215, 0, 0.9),
            0 0 32px 12px rgba(255, 215, 0, 0.45),
            0 4px 10px rgba(0, 0, 0, 0.4);
    }
}

#connectfour .cf-disc--win {
    animation: disc-win-pulse 1s ease-in-out infinite;
    z-index: 1;
}
</style>
