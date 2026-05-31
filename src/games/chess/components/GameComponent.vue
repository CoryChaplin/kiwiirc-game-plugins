<template>
    <div id="chess">
        <div v-if="game && game.getShowInvite()" class="chess-invite">
            <span>{{ $t('kiwi-games:ch_invite_text') }}</span>
            <div class="chess-actions">
                <button class="u-button u-button-primary" @click="inviteClicked(true)">
                    {{ $t('kiwi-games:common_accept') }}
                </button>
                <button class="u-button" @click="inviteClicked(false)">
                    {{ $t('kiwi-games:common_decline') }}
                </button>
            </div>
        </div>

        <div v-if="game && game.getShowGame()" class="chess-game">
            <div v-if="game.getGameOver()" class="chess-result" :class="resultClass">
                <span class="chess-result__icon">{{ resultIcon }}</span>
                <span class="chess-result__text">{{ game.getGameMessage() }}</span>
            </div>
            <div v-if="!game.getGameOver()" class="chess-status" :class="statusClass">
                <span v-if="isMyTurnLive" class="chess-status__pulse" aria-hidden="true"></span>
                <span class="chess-status__icon">{{ statusIcon }}</span>
                <span class="chess-status__text">{{ game.getGameMessage() }}</span>
                <span v-if="isMyTurnLive" class="chess-status__badge">{{ $t('kiwi-games:ch_your_turn_badge') }}</span>
            </div>
            <div class="chess-captured chess-captured--opponent">
                <span class="chess-captured__label">{{ opponentLabel }}</span>
                <span class="chess-captured__pieces">
                    <span
                        v-for="(piece, idx) in lostPiecesList(opponentColor)"
                        :key="'op-' + idx"
                        class="chess-piece chess-piece--sm"
                        :class="'chess-piece--' + piece.color"
                    >{{ pieceGlyph(piece.type) }}</span>
                </span>
            </div>
            <div class="chess-board-wrap" :class="{ 'chess-board-wrap--my-turn': isMyTurnLive }">
            <div class="chess-board" :class="{ 'chess-board--my-turn': isMyTurnLive }">
                <button
                    v-for="cell in boardCells"
                    :key="cell.id"
                    class="chess-square"
                    :class="squareClass(cell)"
                    @click="squareClicked(cell.r, cell.c)"
                >
                    <span
                        v-if="cell.piece"
                        class="chess-piece"
                        :class="'chess-piece--' + cell.piece.color"
                    >{{ pieceGlyph(cell.piece.type) }}</span>
                </button>
            </div>
            </div>
            <div class="chess-captured chess-captured--local">
                <span class="chess-captured__label">{{ localLabel }}</span>
                <span class="chess-captured__pieces">
                    <span
                        v-for="(piece, idx) in lostPiecesList(localColor)"
                        :key="'me-' + idx"
                        class="chess-piece chess-piece--sm"
                        :class="'chess-piece--' + piece.color"
                    >{{ pieceGlyph(piece.type) }}</span>
                </span>
            </div>
            <div v-if="pendingPromotion" class="chess-promo-overlay">
                <div class="chess-promo-box">
                    <div class="chess-promo-title">{{ $t('kiwi-games:ch_promotion_title') }}</div>
                    <div class="chess-promo-actions">
                        <button class="chess-promo-piece" @click="confirmPromotion('q')">
                            <span class="chess-piece chess-piece--promo" :class="'chess-piece--' + localColor">{{ pieceGlyph('q') }}</span>
                        </button>
                        <button class="chess-promo-piece" @click="confirmPromotion('r')">
                            <span class="chess-piece chess-piece--promo" :class="'chess-piece--' + localColor">{{ pieceGlyph('r') }}</span>
                        </button>
                        <button class="chess-promo-piece" @click="confirmPromotion('b')">
                            <span class="chess-piece chess-piece--promo" :class="'chess-piece--' + localColor">{{ pieceGlyph('b') }}</span>
                        </button>
                        <button class="chess-promo-piece" @click="confirmPromotion('n')">
                            <span class="chess-piece chess-piece--promo" :class="'chess-piece--' + localColor">{{ pieceGlyph('n') }}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import * as Utils from '../libs/Utils.js';
import { getPieceGlyph } from '../libs/pieceGlyphs.js';

export default {
    data() {
        return {
            pendingPromotion: null,
        };
    },
    computed: {
        game() {
            // eslint-disable-next-line no-undef
            const buffer = kiwi.state.getActiveBuffer();
            return buffer ? Utils.getGame(buffer.name) : null;
        },
        boardCells() {
            const out = [];
            if (!this.game) return out;
            const board = this.game.getBoard();
            const whiteBottom = this.game.getLocalColor() === 'w';
            for (let dr = 0; dr < 8; dr++) {
                for (let dc = 0; dc < 8; dc++) {
                    const r = whiteBottom ? dr : 7 - dr;
                    const c = whiteBottom ? dc : 7 - dc;
                    out.push({
                        id: `${dr}-${dc}-${r}-${c}`,
                        r,
                        c,
                        displayR: dr,
                        displayC: dc,
                        piece: board[r][c],
                    });
                }
            }
            return out;
        },
        isMyTurnLive() {
            return !!(this.game && !this.game.getGameOver() && this.game.isMyTurn());
        },
        statusClass() {
            if (!this.game) return '';
            if (this.game.getGameOver()) return 'chess-status--game-over';
            if (this.isMyTurnLive) {
                return this.game.isMyKingInCheck() ? 'chess-status--my-check' : 'chess-status--my-turn';
            }
            return 'chess-status--waiting';
        },
        statusIcon() {
            if (!this.game) return '';
            if (this.game.getGameOver()) return '🏁';
            if (this.isMyTurnLive && this.game.isMyKingInCheck()) return '⚠️';
            if (this.isMyTurnLive) return '♟️';
            return '⌛';
        },
        resultClass() {
            if (!this.game) return '';
            if (this.game.getGameDraw()) return 'chess-result--draw';
            return this.game.isLocalWinner() ? 'chess-result--win' : 'chess-result--lose';
        },
        resultIcon() {
            if (!this.game) return '';
            if (this.game.getGameDraw()) return '🤝';
            return this.game.isLocalWinner() ? '🏆' : '💥';
        },
        localColor() {
            return this.game ? this.game.getLocalColor() : 'w';
        },
        opponentColor() {
            return this.localColor === 'w' ? 'b' : 'w';
        },
        localLabel() {
            return this.$t('kiwi-games:ch_lost_pieces_you');
        },
        opponentLabel() {
            return this.$t('kiwi-games:ch_lost_pieces_opponent', { nick: this.game ? this.game.getRemotePlayer() : '' });
        },
    },
    methods: {
        pieceGlyph(type) {
            return getPieceGlyph(type);
        },
        lostPiecesList(color) {
            return this.game ? this.game.getLostPieces(color) : [];
        },
        getMovesForSelected() {
            if (!this.game || !this.game.getSelected()) return [];
            const [r, c] = this.game.getSelected();
            return this.game.getLegalMovesFrom(r, c);
        },
        squareClass(cell) {
            const selected = this.game && this.game.getSelected();
            const legal = this.getMovesForSelected();
            const isLegal = legal.some(([r, c]) => r === cell.r && c === cell.c);
            const isSelected = selected && selected[0] === cell.r && selected[1] === cell.c;
            return {
                'chess-square--dark': (cell.displayR + cell.displayC) % 2 === 1,
                'chess-square--selected': !!isSelected,
                'chess-square--legal': isLegal,
                'chess-square--check': this.game && this.game.isKingInCheckAt(cell.r, cell.c),
            };
        },
        inviteClicked(accepted) {
            // eslint-disable-next-line no-undef
            const network = kiwi.state.getActiveNetwork();
            // eslint-disable-next-line no-undef
            const remotePlayer = kiwi.state.getActiveBuffer().name;
            const game = Utils.getGame(remotePlayer);
            game.setShowInvite(false);
            game.setInviteSent(false);
            if (accepted) {
                const startPlayer = Math.floor(Math.random() * 2) === 0 ? network.nick : remotePlayer;
                game.startGame(startPlayer);
                Utils.sendData(network, remotePlayer, { cmd: 'invite_accepted', startPlayer });
                // eslint-disable-next-line no-undef
                kiwi.emit('plugin-kiwi-games.game-started', { game: 'chess' });
            } else {
                Utils.sendData(network, remotePlayer, { cmd: 'invite_declined' });
                // eslint-disable-next-line no-undef
                kiwi.emit('mediaviewer.hide');
            }
        },
        squareClicked(row, col) {
            if (!this.game || this.game.getGameOver() || this.pendingPromotion) return;
            const selected = this.game.getSelected();
            if (!selected) {
                if (this.game.isSelectable(row, col)) {
                    this.game.setSelected([row, col]);
                }
                return;
            }
            if (selected[0] === row && selected[1] === col) {
                this.game.clearSelected();
                return;
            }
            if (this.game.isSelectable(row, col)) {
                this.game.setSelected([row, col]);
                return;
            }

            const turn = this.game.getGameTurn();
            if (this.game.requiresPromotionMove(selected, [row, col])) {
                this.pendingPromotion = { from: [...selected], to: [row, col], turn };
                return;
            }
            this.commitMove(selected, [row, col], turn, 'q');
        },
        commitMove(from, to, turn, promotion) {
            const ok = this.game.applyMove(from, to, promotion);
            if (!ok) {
                return;
            }
            // eslint-disable-next-line no-undef
            const network = kiwi.state.getActiveNetwork();
            Utils.sendData(network, this.game.getRemotePlayer(), {
                cmd: 'action',
                from,
                to,
                turn,
                promotion,
            });
            if (this.game.getGameOver()) {
                // eslint-disable-next-line no-undef
                kiwi.emit('plugin-kiwi-games.game-completed', { game: 'chess' });
            }
        },
        confirmPromotion(type) {
            if (!this.pendingPromotion || !this.game) return;
            const { from, to, turn } = this.pendingPromotion;
            this.pendingPromotion = null;
            this.commitMove(from, to, turn, type);
        },
    },
};
</script>

<style>
#chess { padding: 10px; }
.chess-invite { margin-bottom: 10px; }
.chess-actions { display: flex; gap: 8px; margin-top: 8px; }
.chess-result {
    margin-bottom: 12px;
    border-radius: 10px;
    padding: 12px 14px;
    font-weight: 800;
    display: flex;
    align-items: center;
    gap: 10px;
    border: 2px solid transparent;
}
.chess-result__icon {
    font-size: 22px;
    line-height: 1;
}
.chess-result--win {
    background: linear-gradient(135deg, rgba(46, 204, 113, 0.20), rgba(39, 174, 96, 0.08));
    border-color: #2ecc71;
}
.chess-result--lose {
    background: linear-gradient(135deg, rgba(231, 76, 60, 0.20), rgba(192, 57, 43, 0.08));
    border-color: #e74c3c;
}
.chess-result--draw {
    background: linear-gradient(135deg, rgba(52, 152, 219, 0.18), rgba(41, 128, 185, 0.08));
    border-color: #3498db;
}
.chess-status {
    margin-bottom: 12px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 8px;
    border-radius: 8px;
    padding: 10px 12px;
    border: 2px solid var(--comp-border, #888);
    position: relative;
    overflow: hidden;
}
.chess-status__pulse {
    position: absolute;
    inset: 0;
    pointer-events: none;
    animation: chess-turn-pulse 1.4s ease-in-out infinite;
}
.chess-status__badge {
    margin-left: auto;
    font-size: 0.72em;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 3px 8px;
    border-radius: 999px;
    background: #2ecc71;
    color: #fff;
    animation: chess-badge-blink 1.2s ease-in-out infinite;
}
.chess-status--my-turn {
    background: linear-gradient(135deg, rgba(46, 204, 113, 0.22), rgba(46, 204, 113, 0.08));
    border-color: #2ecc71;
    box-shadow: 0 0 0 3px rgba(46, 204, 113, 0.18);
    font-size: 1.05em;
}
.chess-status--my-check {
    background: linear-gradient(135deg, rgba(231, 76, 60, 0.22), rgba(231, 76, 60, 0.08));
    border-color: #e74c3c;
    box-shadow: 0 0 0 3px rgba(231, 76, 60, 0.18);
    font-size: 1.05em;
}
.chess-status--my-check .chess-status__pulse {
    animation-name: chess-turn-pulse-danger;
}
.chess-status--my-check .chess-status__badge {
    background: #e74c3c;
}
.chess-status__icon {
    font-size: 18px;
    flex-shrink: 0;
}
.chess-status--my-turn .chess-status__icon {
    font-size: 22px;
}
.chess-status--waiting {
    background: rgba(52, 152, 219, 0.12);
    border-color: #3498db;
}
.chess-status--game-over {
    opacity: 0.8;
}
.chess-captured {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 28px;
    margin: 4px 0;
    font-size: 13px;
}
.chess-captured--opponent {
    margin-bottom: 6px;
}
.chess-captured--local {
    margin-top: 6px;
}
.chess-captured__label {
    font-weight: 600;
    opacity: 0.75;
    min-width: 90px;
    flex-shrink: 0;
}
.chess-captured__pieces {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    min-height: 24px;
    align-items: center;
}
.chess-piece {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    font-size: 34px;
    user-select: none;
    pointer-events: none;
}
.chess-piece--w {
    color: #fff;
    -webkit-text-fill-color: #fff;
    -webkit-text-stroke: 1.8px #2b2b2b;
    paint-order: stroke fill;
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.35));
}
.chess-piece--b {
    color: #141414;
    -webkit-text-fill-color: #141414;
    filter: drop-shadow(0 1px 0 rgba(255, 255, 255, 0.2));
}
.chess-piece--sm {
    font-size: 21px;
}
.chess-piece--sm.chess-piece--w {
    -webkit-text-stroke: 1.2px #2b2b2b;
}
.chess-piece--promo {
    font-size: 30px;
    pointer-events: none;
}
.chess-board-wrap {
    width: fit-content;
    border-radius: 4px;
    transition: box-shadow 0.2s;
}
.chess-board-wrap--my-turn {
    animation: chess-board-glow 1.4s ease-in-out infinite;
}
.chess-board {
    display: grid;
    grid-template-columns: repeat(8, 44px);
    border: 2px solid var(--comp-border, #777);
    width: fit-content;
}
.chess-board--my-turn {
    box-shadow: 0 0 0 4px rgba(46, 204, 113, 0.35);
}
.chess-square {
    width: 44px;
    height: 44px;
    border: none;
    background: #f0d9b5;
    padding: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}
.chess-square--dark {
    background: #b58863;
}
.chess-square--selected {
    box-shadow: inset 0 0 0 3px #2ecc71;
}
.chess-square--legal {
    box-shadow: inset 0 0 0 3px rgba(66, 185, 146, 0.5);
}
.chess-square--check {
    box-shadow: inset 0 0 0 4px rgba(231, 76, 60, 0.85);
}
.chess-promo-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
}
.chess-promo-box {
    background: var(--brand-default-bg, #fff);
    color: var(--brand-default-fg, #222);
    border: 2px solid var(--comp-border, #888);
    border-radius: 10px;
    padding: 14px;
    min-width: 260px;
}
.chess-promo-title {
    font-weight: 700;
    margin-bottom: 10px;
}
.chess-promo-actions {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
}
.chess-promo-piece {
    height: 48px;
    border: 1px solid var(--comp-border, #777);
    border-radius: 8px;
    background: #f0f0f0;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}
.chess-promo-piece:hover {
    background: #e4f5ea;
}
@keyframes chess-turn-pulse {
    0%, 100% { box-shadow: inset 0 0 0 0 rgba(46, 204, 113, 0); }
    50% { box-shadow: inset 0 0 0 3px rgba(46, 204, 113, 0.35); }
}
@keyframes chess-turn-pulse-danger {
    0%, 100% { box-shadow: inset 0 0 0 0 rgba(231, 76, 60, 0); }
    50% { box-shadow: inset 0 0 0 3px rgba(231, 76, 60, 0.35); }
}
@keyframes chess-badge-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
}
@keyframes chess-board-glow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(46, 204, 113, 0); }
    50% { box-shadow: 0 0 14px 4px rgba(46, 204, 113, 0.35); }
}
</style>
