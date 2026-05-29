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
                <span class="chess-status__icon">{{ statusIcon }}</span>
                <span class="chess-status__text">{{ game.getGameMessage() }}</span>
            </div>
            <div class="chess-board" :class="{ 'chess-board--my-turn': isMyTurnLive }">
                <button
                    v-for="cell in boardCells"
                    :key="cell.id"
                    class="chess-square"
                    :class="squareClass(cell)"
                    @click="squareClicked(cell.r, cell.c)"
                >
                    {{ pieceSymbol(cell.piece) }}
                </button>
            </div>
            <div v-if="pendingPromotion" class="chess-promo-overlay">
                <div class="chess-promo-box">
                    <div class="chess-promo-title">{{ $t('kiwi-games:ch_promotion_title') }}</div>
                    <div class="chess-promo-actions">
                        <button class="chess-promo-piece" @click="confirmPromotion('q')">{{ promotionSymbol('q') }}</button>
                        <button class="chess-promo-piece" @click="confirmPromotion('r')">{{ promotionSymbol('r') }}</button>
                        <button class="chess-promo-piece" @click="confirmPromotion('b')">{{ promotionSymbol('b') }}</button>
                        <button class="chess-promo-piece" @click="confirmPromotion('n')">{{ promotionSymbol('n') }}</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import * as Utils from '../libs/Utils.js';

const PIECES = {
    wp: '♙',
    wn: '♘',
    wb: '♗',
    wr: '♖',
    wq: '♕',
    wk: '♔',
    bp: '♟',
    bn: '♞',
    bb: '♝',
    br: '♜',
    bq: '♛',
    bk: '♚',
};

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
    },
    methods: {
        pieceSymbol(piece) {
            if (!piece) return '';
            return PIECES[piece.color + piece.type] || '';
        },
        promotionSymbol(type) {
            if (!this.game) return '';
            const color = this.game.getLocalColor();
            return PIECES[color + type] || '';
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
}
.chess-status__icon {
    font-size: 18px;
}
.chess-status--my-turn {
    background: rgba(46, 204, 113, 0.15);
    border-color: #2ecc71;
}
.chess-status--my-check {
    background: rgba(231, 76, 60, 0.18);
    border-color: #e74c3c;
}
.chess-status--waiting {
    background: rgba(52, 152, 219, 0.12);
    border-color: #3498db;
}
.chess-status--game-over {
    opacity: 0.8;
}
.chess-board {
    display: grid;
    grid-template-columns: repeat(8, 44px);
    border: 2px solid var(--comp-border, #777);
    width: fit-content;
}
.chess-board--my-turn {
    box-shadow: 0 0 0 4px rgba(46, 204, 113, 0.22);
}
.chess-square {
    width: 44px;
    height: 44px;
    font-size: 28px;
    border: none;
    background: #f0d9b5;
    padding: 0;
    line-height: 44px;
    text-align: center;
    cursor: pointer;
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
    font-size: 28px;
    border: 1px solid var(--comp-border, #777);
    border-radius: 8px;
    background: #f0f0f0;
    cursor: pointer;
}
.chess-promo-piece:hover {
    background: #e4f5ea;
}
</style>
