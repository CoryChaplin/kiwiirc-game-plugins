const ROWS = 6;
const COLS = 7;

// Pré-calcul de toutes les lignes gagnantes possibles (4 pions alignés)
const WIN_LINES = (() => {
    const lines = [];

    // Horizontales
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c <= COLS - 4; c++) {
            lines.push([[r, c], [r, c + 1], [r, c + 2], [r, c + 3]]);
        }
    }

    // Verticales
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r <= ROWS - 4; r++) {
            lines.push([[r, c], [r + 1, c], [r + 2, c], [r + 3, c]]);
        }
    }

    // Diagonales descendantes (↘)
    for (let r = 0; r <= ROWS - 4; r++) {
        for (let c = 0; c <= COLS - 4; c++) {
            lines.push([[r, c], [r + 1, c + 1], [r + 2, c + 2], [r + 3, c + 3]]);
        }
    }

    // Diagonales montantes (↗)
    for (let r = 3; r < ROWS; r++) {
        for (let c = 0; c <= COLS - 4; c++) {
            lines.push([[r, c], [r - 1, c + 1], [r - 2, c + 2], [r - 3, c + 3]]);
        }
    }

    return lines;
})();

export default class ConnectFour {
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
                    gameDraw: false,
                    gameTurn: 1,
                    gameWinner: '',
                    gameMessage: '',
                    gameBoard: ConnectFour.createEmptyBoard(),
                };
            },
        });
    }

    static createEmptyBoard() {
        const board = [];
        for (let r = 0; r < ROWS; r++) {
            const row = [];
            for (let c = 0; c < COLS; c++) {
                row.push({ id: [r, c], val: '', win: false });
            }
            board.push(row);
        }
        return board;
    }

    startGame(startPlayer) {
        const data = this.data;
        data.startPlayer = startPlayer;
        data.showGame = true;
        data.gameOver = false;
        data.gameDraw = false;
        data.gameTurn = 1;
        data.gameWinner = '';
        data.gameMessage = '';
        data.gameBoard.forEach((row) => {
            row.forEach((cell) => {
                cell.val = '';
                cell.win = false;
            });
        });
    }

    placeDisc(column) {
        if (this.data.gameOver || column < 0 || column >= COLS) {
            return -1;
        }

        const board = this.data.gameBoard;
        for (let r = ROWS - 1; r >= 0; r--) {
            const cell = board[r][column];
            if (cell.val === '') {
                cell.val = this.getMarker();
                return r;
            }
        }

        return -1;
    }

    checkGame() {
        const board = this.data.gameBoard;
        let winningLine = null;
        let winner = '';

        for (const coords of WIN_LINES) {
            const [r0, c0] = coords[0];
            const firstVal = board[r0][c0].val;

            if (!firstVal) {
                continue;
            }

            let same = true;
            for (let j = 1; j < 4; j++) {
                const [r, c] = coords[j];
                if (board[r][c].val !== firstVal) {
                    same = false;
                    break;
                }
            }

            if (same) {
                winner = firstVal;
                winningLine = coords;
                break;
            }
        }

        if (winningLine) {
            this.data.gameMessage = 'Winner: ' + winner;
            this.data.gameOver = true;
            winningLine.forEach(([r, c]) => {
                board[r][c].win = true;
            });
            return;
        }

        // Vérifie le match nul seulement si pas de gagnant
        const isDraw = board.every((row) => row.every((cell) => cell.val !== ''));
        if (isDraw) {
            this.data.gameMessage = 'Winner: Draw';
            this.data.gameDraw = true;
            this.data.gameOver = true;
        }
    }

    isMyTurn() {
        const isEvenTurn = this.data.gameTurn % 2 === 0;
        return (this.data.startPlayer === this.data.localPlayer) ? !isEvenTurn : isEvenTurn;
    }

    getMarker() {
        return this.data.gameTurn % 2 === 0 ? 'O' : 'X';
    }

    getNetwork() {
        return this.data.network;
    }

    setLocalPlayer(val) {
        this.data.localPlayer = val;
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

    setShowGame(val) {
        this.data.showGame = val;
    }

    getGameOver() {
        return this.data.gameOver;
    }

    setGameOver(val) {
        this.data.gameOver = val;
    }

    getGameTurn() {
        return this.data.gameTurn;
    }

    incrementGameTurn() {
        this.data.gameTurn++;
    }

    getGameBoard() {
        return this.data.gameBoard;
    }

    getGameMessage() {
        return this.data.gameMessage;
    }

    setGameMessage(val) {
        this.data.gameMessage = val;
    }

    setTurnMessage() {
        this.data.gameMessage = this.isMyTurn()
            ? 'Your turn!'
            : 'Waiting for ' + this.data.remotePlayer;
    }

    getBoardValues() {
        return this.data.gameBoard.map((row) => row.map((cell) => cell.val));
    }
}

