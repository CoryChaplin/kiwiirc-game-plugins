import { t } from '../../shared/locales.js';

function createInitialBoard() {
    const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
    const board = [];
    for (let r = 0; r < 8; r++) {
        const row = [];
        for (let c = 0; c < 8; c++) {
            row.push(null);
        }
        board.push(row);
    }
    for (let c = 0; c < 8; c++) {
        board[0][c] = { color: 'b', type: back[c] };
        board[1][c] = { color: 'b', type: 'p' };
        board[6][c] = { color: 'w', type: 'p' };
        board[7][c] = { color: 'w', type: back[c] };
    }
    return board;
}

function inBounds(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function cloneBoard(board) {
    return board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
}

function setBoardCellReactive(board, row, col, value) {
    board[row].splice(col, 1, value);
}

function normalizePromotionType(type) {
    const val = (type || '').toLowerCase();
    return ['q', 'r', 'b', 'n'].includes(val) ? val : 'q';
}

function cloneRights(rights) {
    return {
        whiteKingMoved: rights.whiteKingMoved,
        blackKingMoved: rights.blackKingMoved,
        whiteRookAMoved: rights.whiteRookAMoved,
        whiteRookHMoved: rights.whiteRookHMoved,
        blackRookAMoved: rights.blackRookAMoved,
        blackRookHMoved: rights.blackRookHMoved,
    };
}

function opposite(color) {
    return color === 'w' ? 'b' : 'w';
}

function findKing(board, color) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece.color === color && piece.type === 'k') {
                return [r, c];
            }
        }
    }
    return null;
}

function getPseudoMoves(board, fromR, fromC, enPassant) {
    const piece = board[fromR][fromC];
    if (!piece) return [];
    const moves = [];
    const push = (r, c) => {
        if (!inBounds(r, c)) return;
        const target = board[r][c];
        if (!target || target.color !== piece.color) {
            moves.push([r, c]);
        }
    };

    if (piece.type === 'p') {
        const dir = piece.color === 'w' ? -1 : 1;
        const startRow = piece.color === 'w' ? 6 : 1;
        const oneR = fromR + dir;
        if (inBounds(oneR, fromC) && !board[oneR][fromC]) {
            moves.push([oneR, fromC]);
            const twoR = fromR + dir * 2;
            if (fromR === startRow && !board[twoR][fromC]) {
                moves.push([twoR, fromC]);
            }
        }
        const capCols = [fromC - 1, fromC + 1];
        capCols.forEach((capC) => {
            if (!inBounds(oneR, capC)) return;
            const target = board[oneR][capC];
            if (target && target.color !== piece.color) {
                moves.push([oneR, capC]);
            }
            if (
                !target &&
                enPassant &&
                enPassant.row === oneR &&
                enPassant.col === capC &&
                enPassant.captureColor !== piece.color
            ) {
                moves.push([oneR, capC]);
            }
        });
        return moves;
    }

    if (piece.type === 'n') {
        const deltas = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
        deltas.forEach(([dr, dc]) => push(fromR + dr, fromC + dc));
        return moves;
    }

    const dirs = [];
    if (piece.type === 'b' || piece.type === 'q') {
        dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
    }
    if (piece.type === 'r' || piece.type === 'q') {
        dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
    }
    if (piece.type === 'k') {
        dirs.push([-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]);
        dirs.forEach(([dr, dc]) => push(fromR + dr, fromC + dc));
        return moves;
    }

    dirs.forEach(([dr, dc]) => {
        let r = fromR + dr;
        let c = fromC + dc;
        while (inBounds(r, c)) {
            const target = board[r][c];
            if (!target) {
                moves.push([r, c]);
            } else {
                if (target.color !== piece.color) {
                    moves.push([r, c]);
                }
                break;
            }
            r += dr;
            c += dc;
        }
    });
    return moves;
}

function isSquareAttacked(board, row, col, byColor) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (!piece || piece.color !== byColor) continue;
            if (piece.type === 'p') {
                const dir = piece.color === 'w' ? -1 : 1;
                if (r + dir === row && (c - 1 === col || c + 1 === col)) {
                    return true;
                }
                continue;
            }
            const pseudo = getPseudoMoves(board, r, c, null);
            if (pseudo.some(([mr, mc]) => mr === row && mc === col)) {
                return true;
            }
        }
    }
    return false;
}

function canCastle(board, color, side, rights) {
    const row = color === 'w' ? 7 : 0;
    const enemy = opposite(color);
    const kingFrom = [row, 4];
    const kingTo = side === 'king' ? [row, 6] : [row, 2];
    const rookCol = side === 'king' ? 7 : 0;
    const rookToCol = side === 'king' ? 5 : 3;
    const between = side === 'king' ? [5, 6] : [1, 2, 3];
    const passSquares = side === 'king' ? [4, 5, 6] : [4, 3, 2];
    const king = board[kingFrom[0]][kingFrom[1]];
    const rook = board[row][rookCol];
    if (!king || king.type !== 'k' || king.color !== color) return false;
    if (!rook || rook.type !== 'r' || rook.color !== color) return false;
    if (color === 'w') {
        if (rights.whiteKingMoved) return false;
        if (side === 'king' && rights.whiteRookHMoved) return false;
        if (side === 'queen' && rights.whiteRookAMoved) return false;
    } else {
        if (rights.blackKingMoved) return false;
        if (side === 'king' && rights.blackRookHMoved) return false;
        if (side === 'queen' && rights.blackRookAMoved) return false;
    }
    if (between.some((c) => !!board[row][c])) return false;
    if (passSquares.some((c) => isSquareAttacked(board, row, c, enemy))) return false;
    if (rookToCol === 5 && board[row][5]) return false;
    return true;
}

function applyMoveOnBoard(next, fromR, fromC, toR, toC, enPassant) {
    const moving = next[fromR][fromC];
    next[fromR][fromC] = null;
    if (
        moving &&
        moving.type === 'p' &&
        enPassant &&
        enPassant.row === toR &&
        enPassant.col === toC &&
        !next[toR][toC]
    ) {
        next[enPassant.captureRow][enPassant.captureCol] = null;
    }
    next[toR][toC] = moving;
    if (moving && moving.type === 'k' && Math.abs(toC - fromC) === 2) {
        const rookFrom = toC === 6 ? 7 : 0;
        const rookTo = toC === 6 ? 5 : 3;
        next[toR][rookTo] = next[toR][rookFrom];
        next[toR][rookFrom] = null;
    }
    if (moving && moving.type === 'p' && (toR === 0 || toR === 7)) {
        next[toR][toC] = { color: moving.color, type: 'q' };
    }
}

function getLegalMoves(board, fromR, fromC, rights, enPassant) {
    const piece = board[fromR][fromC];
    if (!piece) return [];
    const pseudo = getPseudoMoves(board, fromR, fromC, enPassant);
    if (piece.type === 'k' && fromC === 4) {
        if (canCastle(board, piece.color, 'king', rights)) pseudo.push([fromR, 6]);
        if (canCastle(board, piece.color, 'queen', rights)) pseudo.push([fromR, 2]);
    }
    return pseudo.filter(([toR, toC]) => {
        const next = cloneBoard(board);
        applyMoveOnBoard(next, fromR, fromC, toR, toC, enPassant);
        const kingPos = findKing(next, piece.color);
        if (!kingPos) return false;
        return !isSquareAttacked(next, kingPos[0], kingPos[1], opposite(piece.color));
    });
}

function hasAnyLegalMove(board, color, rights, enPassant) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece.color === color && getLegalMoves(board, r, c, rights, enPassant).length > 0) {
                return true;
            }
        }
    }
    return false;
}

function getBoardPieces(board) {
    const out = { w: [], b: [] };
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece.type !== 'k') {
                out[piece.color].push({ type: piece.type, squareColor: (r + c) % 2 });
            }
        }
    }
    return out;
}

function isInsufficientMaterial(board) {
    const pieces = getBoardPieces(board);
    const w = pieces.w;
    const b = pieces.b;
    if (w.length === 0 && b.length === 0) {
        return true;
    }
    const hasMajor = (list) => list.some((p) => p.type === 'q' || p.type === 'r' || p.type === 'p');
    if (hasMajor(w) || hasMajor(b)) {
        return false;
    }
    const minorCount = w.length + b.length;
    if (minorCount <= 1) {
        return true;
    }
    if (minorCount === 2 && w.length === 1 && b.length === 1) {
        const wp = w[0];
        const bp = b[0];
        if (wp.type === 'n' && bp.type === 'n') {
            return true;
        }
        if (wp.type === 'b' && bp.type === 'b') {
            return wp.squareColor === bp.squareColor;
        }
    }
    return false;
}

const PIECE_SORT = { q: 0, r: 1, b: 2, n: 3, p: 4 };

export default class Chess {
    constructor(network, localPlayer, remotePlayer) {
        this.data = new kiwi.Vue({
            data() {
                return {
                    network,
                    localPlayer,
                    remotePlayer,
                    startPlayer: null,
                    inviteTimeout: null,
                    inviteSent: false,
                    showInvite: false,
                    showGame: false,
                    gameOver: false,
                    gameTurn: 1,
                    gameWinner: '',
                    gameDraw: false,
                    gameMessage: '',
                    board: createInitialBoard(),
                    selected: null,
                    enPassant: null,
                    castlingRights: {
                        whiteKingMoved: false,
                        blackKingMoved: false,
                        whiteRookAMoved: false,
                        whiteRookHMoved: false,
                        blackRookAMoved: false,
                        blackRookHMoved: false,
                    },
                    checkState: {
                        w: null,
                        b: null,
                    },
                    lostPieces: {
                        w: [],
                        b: [],
                    },
                    lastMove: null,
                };
            },
        });
    }

    startGame(startPlayer) {
        const data = this.data;
        data.startPlayer = startPlayer;
        data.showGame = true;
        data.gameOver = false;
        data.gameTurn = 1;
        data.gameWinner = '';
        data.gameDraw = false;
        data.gameMessage = '';
        data.board = createInitialBoard();
        data.selected = null;
        data.enPassant = null;
        data.castlingRights = {
            whiteKingMoved: false,
            blackKingMoved: false,
            whiteRookAMoved: false,
            whiteRookHMoved: false,
            blackRookAMoved: false,
            blackRookHMoved: false,
        };
        data.checkState = { w: null, b: null };
        data.lostPieces = { w: [], b: [] };
        data.lastMove = null;
        this.refreshCheckState();
        this.setTurnMessage();
    }

    getTurnColor() {
        return this.data.gameTurn % 2 === 1 ? 'w' : 'b';
    }

    getLocalColor() {
        return this.data.startPlayer === this.data.localPlayer ? 'w' : 'b';
    }

    isMyTurn() {
        return this.getTurnColor() === this.getLocalColor();
    }

    getOpponentColor() {
        return this.getLocalColor() === 'w' ? 'b' : 'w';
    }

    canPlayLocalMove(from, to, turn) {
        if (this.data.gameOver || !this.isMyTurn()) {
            return false;
        }
        if (this.data.gameTurn !== turn) {
            return false;
        }
        if (!Array.isArray(from) || from.length !== 2 || !Array.isArray(to) || to.length !== 2) {
            return false;
        }
        const piece = this.data.board[from[0]][from[1]];
        if (!piece || piece.color !== this.getLocalColor()) {
            return false;
        }
        return this.getLegalMovesFrom(from[0], from[1]).some(([r, c]) => r === to[0] && c === to[1]);
    }

    validateIncomingMove(from, to, turn) {
        if (this.data.gameOver) {
            return 'ignore';
        }
        if (!Array.isArray(from) || from.length !== 2 || !Array.isArray(to) || to.length !== 2) {
            return 'ignore';
        }
        if (this.wasMoveAlreadyApplied(from, to, turn)) {
            return 'duplicate';
        }
        if (this.getGameTurn() !== turn) {
            return 'desync';
        }
        if (this.isMyTurn()) {
            return 'ignore';
        }
        const piece = this.data.board[from[0]][from[1]];
        if (!piece || piece.color !== this.getTurnColor()) {
            return 'ignore';
        }
        return 'ok';
    }

    getLegalMovesFrom(row, col) {
        return getLegalMoves(this.data.board, row, col, this.data.castlingRights, this.data.enPassant);
    }

    isSelectable(row, col) {
        if (this.data.gameOver || !this.isMyTurn()) return false;
        const piece = this.data.board[row][col];
        return !!piece && piece.color === this.getLocalColor();
    }

    setSelected(val) {
        this.data.selected = val;
    }

    getSelected() {
        return this.data.selected;
    }

    clearSelected() {
        this.data.selected = null;
    }

    requiresPromotionMove(from, to) {
        const [fromR, fromC] = from;
        const [toR] = to;
        const piece = this.data.board[fromR][fromC];
        if (!piece || piece.type !== 'p') {
            return false;
        }
        return toR === 0 || toR === 7;
    }

    applyMove(from, to, promotionType = 'q') {
        const [fromR, fromC] = from;
        const [toR, toC] = to;
        const piece = this.data.board[fromR][fromC];
        if (!piece) return false;
        const legal = this.getLegalMovesFrom(fromR, fromC)
            .some(([r, c]) => r === toR && c === toC);
        if (!legal) return false;
        const targetBefore = this.data.board[toR][toC];
        this.updateCastlingRightsBeforeMove(piece, fromR, fromC, targetBefore, toR, toC);

        if (targetBefore) {
            this.recordLostPiece(targetBefore);
        }

        const enPassantCapture =
            piece.type === 'p' &&
            !targetBefore &&
            this.data.enPassant &&
            this.data.enPassant.row === toR &&
            this.data.enPassant.col === toC
                ? [this.data.enPassant.captureRow, this.data.enPassant.captureCol]
                : null;

        setBoardCellReactive(this.data.board, fromR, fromC, null);
        if (enPassantCapture) {
            const epPiece = this.data.board[enPassantCapture[0]][enPassantCapture[1]];
            if (epPiece) {
                this.recordLostPiece(epPiece);
            }
            setBoardCellReactive(
                this.data.board,
                enPassantCapture[0],
                enPassantCapture[1],
                null
            );
        }
        setBoardCellReactive(this.data.board, toR, toC, piece);

        if (piece.type === 'k' && Math.abs(toC - fromC) === 2) {
            const rookFrom = toC === 6 ? 7 : 0;
            const rookTo = toC === 6 ? 5 : 3;
            const rook = this.data.board[toR][rookFrom];
            setBoardCellReactive(this.data.board, toR, rookFrom, null);
            setBoardCellReactive(this.data.board, toR, rookTo, rook);
        }

        if (piece.type === 'p' && (toR === 0 || toR === 7)) {
            setBoardCellReactive(this.data.board, toR, toC, {
                color: piece.color,
                type: normalizePromotionType(promotionType),
            });
        }
        this.updateEnPassantAfterMove(piece, fromR, fromC, toR, toC);
        const lastMove = {
            from: [fromR, fromC],
            to: [toR, toC],
            by: piece.color,
        };
        if (enPassantCapture) {
            lastMove.capture = enPassantCapture;
        }
        if (piece.type === 'k' && Math.abs(toC - fromC) === 2) {
            lastMove.rookFrom = [toR, toC === 6 ? 7 : 0];
            lastMove.rookTo = [toR, toC === 6 ? 5 : 3];
        }
        this.data.lastMove = lastMove;
        this.data.gameTurn++;
        this.clearSelected();
        this.refreshCheckState();
        this.updateStateAfterMove(piece.color);
        return true;
    }

    updateCastlingRightsBeforeMove(piece, fromR, fromC, capturedPiece, toR, toC) {
        const rights = cloneRights(this.data.castlingRights);
        if (piece.color === 'w') {
            if (piece.type === 'k') rights.whiteKingMoved = true;
            if (piece.type === 'r' && fromR === 7 && fromC === 0) rights.whiteRookAMoved = true;
            if (piece.type === 'r' && fromR === 7 && fromC === 7) rights.whiteRookHMoved = true;
        } else {
            if (piece.type === 'k') rights.blackKingMoved = true;
            if (piece.type === 'r' && fromR === 0 && fromC === 0) rights.blackRookAMoved = true;
            if (piece.type === 'r' && fromR === 0 && fromC === 7) rights.blackRookHMoved = true;
        }
        if (capturedPiece && capturedPiece.type === 'r') {
            if (toR === 7 && toC === 0) rights.whiteRookAMoved = true;
            if (toR === 7 && toC === 7) rights.whiteRookHMoved = true;
            if (toR === 0 && toC === 0) rights.blackRookAMoved = true;
            if (toR === 0 && toC === 7) rights.blackRookHMoved = true;
        }
        this.data.castlingRights = rights;
    }

    updateEnPassantAfterMove(piece, fromR, fromC, toR, toC) {
        if (piece.type === 'p' && Math.abs(toR - fromR) === 2) {
            const step = piece.color === 'w' ? -1 : 1;
            this.data.enPassant = {
                row: fromR + step,
                col: fromC,
                captureRow: toR,
                captureCol: toC,
                captureColor: piece.color,
            };
            return;
        }
        this.data.enPassant = null;
    }

    refreshCheckState() {
        const whiteKing = findKing(this.data.board, 'w');
        const blackKing = findKing(this.data.board, 'b');
        this.data.checkState = {
            w: whiteKing && isSquareAttacked(this.data.board, whiteKing[0], whiteKing[1], 'b') ? whiteKing : null,
            b: blackKing && isSquareAttacked(this.data.board, blackKing[0], blackKing[1], 'w') ? blackKing : null,
        };
    }

    recordLostPiece(piece) {
        this.data.lostPieces[piece.color].push({ color: piece.color, type: piece.type });
    }

    getLostPieces(color) {
        return [...this.data.lostPieces[color]].sort(
            (a, b) => (PIECE_SORT[a.type] ?? 9) - (PIECE_SORT[b.type] ?? 9)
        );
    }

    updateStateAfterMove(movingColor) {
        const enemyColor = opposite(movingColor);
        const enemyKing = findKing(this.data.board, enemyColor);
        if (!enemyKing) {
            this.data.gameOver = true;
            this.data.gameWinner = movingColor === this.getLocalColor() ? this.data.localPlayer : this.data.remotePlayer;
            this.data.gameMessage = t('ch_king_captured', { nick: this.data.gameWinner });
            return;
        }

        const hasMoves = hasAnyLegalMove(
            this.data.board,
            enemyColor,
            this.data.castlingRights,
            this.data.enPassant
        );
        const enemyInCheck = isSquareAttacked(this.data.board, enemyKing[0], enemyKing[1], movingColor);
        if (!hasMoves) {
            this.data.gameOver = true;
            if (enemyInCheck) {
                this.data.gameWinner = movingColor === this.getLocalColor() ? this.data.localPlayer : this.data.remotePlayer;
                this.data.gameMessage = t('ch_checkmate', { nick: this.data.gameWinner });
            } else {
                this.data.gameDraw = true;
                this.data.gameMessage = t('ch_stalemate');
            }
            return;
        }

        if (isInsufficientMaterial(this.data.board)) {
            this.data.gameOver = true;
            this.data.gameDraw = true;
            this.data.gameMessage = t('ch_insufficient_material');
            return;
        }

        this.setTurnMessage();
    }

    getPieceAt(row, col) {
        return this.data.board[row][col];
    }

    getBoard() {
        return this.data.board;
    }

    getNetwork() {
        return this.data.network;
    }

    setLocalPlayer(val) {
        this.data.localPlayer = val;
    }

    getLocalPlayer() {
        return this.data.localPlayer;
    }

    getRemotePlayer() {
        return this.data.remotePlayer;
    }

    setRemotePlayer(val) {
        this.data.remotePlayer = val;
    }

    getStartPlayer() {
        return this.data.startPlayer;
    }

    setStartPlayer(val) {
        this.data.startPlayer = val;
    }

    getInviteTimeout() {
        return this.data.inviteTimeout;
    }

    setInviteTimeout(val) {
        this.data.inviteTimeout = val;
    }

    getInviteSent() {
        return this.data.inviteSent;
    }

    setInviteSent(val) {
        this.data.inviteSent = val;
    }

    getShowInvite() {
        return this.data.showInvite;
    }

    setShowInvite(val) {
        this.data.showInvite = val;
    }

    getShowGame() {
        return this.data.showGame;
    }

    getGameOver() {
        return this.data.gameOver;
    }

    setGameOver(val) {
        this.data.gameOver = val;
    }

    endInterrupted(message) {
        this.data.gameOver = true;
        this.data.gameDraw = false;
        this.data.gameWinner = '';
        this.data.gameMessage = message;
    }

    getGameTurn() {
        return this.data.gameTurn;
    }

    getGameMessage() {
        return this.data.gameMessage;
    }

    setGameMessage(val) {
        this.data.gameMessage = val;
    }

    getGameWinner() {
        return this.data.gameWinner;
    }

    getGameDraw() {
        return this.data.gameDraw;
    }

    setTurnMessage() {
        const turnColor = this.getTurnColor();
        const checkPos = this.data.checkState[turnColor];
        if (this.isMyTurn()) {
            this.data.gameMessage = checkPos
                ? t('ch_your_turn_check')
                : t('ch_your_turn');
            return;
        }
        this.data.gameMessage = checkPos
            ? t('ch_waiting_check', { nick: this.data.remotePlayer })
            : t('ch_waiting', { nick: this.data.remotePlayer });
    }

    isMyKingInCheck() {
        return !!this.data.checkState[this.getLocalColor()];
    }

    isLocalWinner() {
        return this.data.gameOver && !this.data.gameDraw && this.data.gameWinner === this.data.localPlayer;
    }

    isDecisiveEnd() {
        return this.data.gameDraw || !!this.data.gameWinner;
    }

    wasMoveAlreadyApplied(from, to, turn) {
        if (this.data.gameTurn !== turn + 1) {
            return false;
        }
        const lm = this.data.lastMove;
        if (!lm) {
            return false;
        }
        return (
            lm.from[0] === from[0] &&
            lm.from[1] === from[1] &&
            lm.to[0] === to[0] &&
            lm.to[1] === to[1]
        );
    }

    isKingInCheckAt(row, col) {
        const w = this.data.checkState.w;
        const b = this.data.checkState.b;
        if (w && w[0] === row && w[1] === col) return true;
        if (b && b[0] === row && b[1] === col) return true;
        return false;
    }

    isOpponentLastMoveFrom(row, col) {
        const lm = this.data.lastMove;
        if (!lm || lm.by === this.getLocalColor()) {
            return false;
        }
        if (lm.from[0] === row && lm.from[1] === col) {
            return true;
        }
        if (lm.capture && lm.capture[0] === row && lm.capture[1] === col) {
            return true;
        }
        if (lm.rookFrom && lm.rookFrom[0] === row && lm.rookFrom[1] === col) {
            return true;
        }
        return false;
    }

    isOpponentLastMoveTo(row, col) {
        const lm = this.data.lastMove;
        if (!lm || lm.by === this.getLocalColor()) {
            return false;
        }
        if (lm.to[0] === row && lm.to[1] === col) {
            return true;
        }
        if (lm.rookTo && lm.rookTo[0] === row && lm.rookTo[1] === col) {
            return true;
        }
        return false;
    }
}
