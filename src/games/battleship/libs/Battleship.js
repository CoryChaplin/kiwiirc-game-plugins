import { t } from '../../shared/locales.js';

export const GRID_SIZE = 10;

export const SHIP_FLEET = [
    { id: 'carrier', length: 5 },
    { id: 'battleship', length: 4 },
    { id: 'cruiser', length: 3 },
    { id: 'submarine', length: 3 },
    { id: 'destroyer', length: 2 },
];

function createEmptyGrid() {
    const grid = [];
    for (let r = 0; r < GRID_SIZE; r++) {
        const row = [];
        for (let c = 0; c < GRID_SIZE; c++) {
            row.push({ shipId: null, hit: false, targeted: false });
        }
        grid.push(row);
    }
    return grid;
}

function createEmptyTargetGrid() {
    const grid = [];
    for (let r = 0; r < GRID_SIZE; r++) {
        const row = [];
        for (let c = 0; c < GRID_SIZE; c++) {
            row.push({ state: '', sunkShipId: null });
        }
        grid.push(row);
    }
    return grid;
}

export default class Battleship {
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
                    gameMessage: '',
                    phase: 'placement',
                    localReady: false,
                    opponentReady: false,
                    fleetGrid: createEmptyGrid(),
                    targetGrid: createEmptyTargetGrid(),
                    placedShips: [],
                    shipsToPlace: SHIP_FLEET.map((ship) => ({ ...ship })),
                    placementHorizontal: true,
                    activeShipIndex: 0,
                    firePending: false,
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
        data.gameMessage = '';
        data.phase = 'placement';
        data.localReady = false;
        data.opponentReady = false;
        data.fleetGrid = createEmptyGrid();
        data.targetGrid = createEmptyTargetGrid();
        data.placedShips = [];
        data.shipsToPlace = SHIP_FLEET.map((ship) => ({ ...ship }));
        data.placementHorizontal = true;
        data.activeShipIndex = 0;
        data.firePending = false;
        this.setPlacementMessage();
    }

    getPlacementCells(row, col, length, horizontal) {
        const cells = [];
        for (let i = 0; i < length; i++) {
            const r = horizontal ? row : row + i;
            const c = horizontal ? col + i : col;
            cells.push([r, c]);
        }
        return cells;
    }

    canPlaceAt(row, col, length, horizontal) {
        const cells = this.getPlacementCells(row, col, length, horizontal);
        return cells.every(([r, c]) => {
            if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) {
                return false;
            }
            return !this.data.fleetGrid[r][c].shipId;
        });
    }

    placeShipAt(row, col, length, horizontal, shipId) {
        if (!this.canPlaceAt(row, col, length, horizontal)) {
            return false;
        }
        const cells = this.getPlacementCells(row, col, length, horizontal);
        cells.forEach(([r, c]) => {
            this.data.fleetGrid[r][c].shipId = shipId;
        });
        this.data.placedShips.push({ id: shipId, length, cells: cells.map(([r, c]) => [r, c]) });
        return true;
    }

    placeNextShip(row, col) {
        const data = this.data;
        if (data.phase !== 'placement' || data.localReady || data.activeShipIndex >= data.shipsToPlace.length) {
            return false;
        }
        const ship = data.shipsToPlace[data.activeShipIndex];
        if (!this.placeShipAt(row, col, ship.length, data.placementHorizontal, ship.id)) {
            return false;
        }
        data.activeShipIndex++;
        if (data.activeShipIndex >= data.shipsToPlace.length) {
            data.gameMessage = t('bs_placement_done');
        } else {
            this.setPlacementMessage();
        }
        return true;
    }

    randomPlacement() {
        const data = this.data;
        if (data.phase !== 'placement' || data.localReady) {
            return;
        }
        data.fleetGrid = createEmptyGrid();
        data.placedShips = [];
        data.activeShipIndex = 0;

        for (const ship of data.shipsToPlace) {
            let placed = false;
            for (let attempt = 0; attempt < 300 && !placed; attempt++) {
                const horizontal = Math.random() < 0.5;
                const row = Math.floor(Math.random() * GRID_SIZE);
                const col = Math.floor(Math.random() * GRID_SIZE);
                placed = this.placeShipAt(row, col, ship.length, horizontal, ship.id);
            }
            if (!placed) {
                data.activeShipIndex = 0;
                data.placedShips = [];
                data.fleetGrid = createEmptyGrid();
                this.setPlacementMessage();
                return;
            }
            data.activeShipIndex++;
        }
        data.gameMessage = t('bs_placement_done');
    }

    clearPlacement() {
        const data = this.data;
        if (data.phase !== 'placement' || data.localReady) {
            return;
        }
        data.fleetGrid = createEmptyGrid();
        data.placedShips = [];
        data.activeShipIndex = 0;
        this.setPlacementMessage();
    }

    allShipsPlaced() {
        return this.data.activeShipIndex >= this.data.shipsToPlace.length;
    }

    setLocalReady() {
        if (!this.allShipsPlaced()) {
            return false;
        }
        this.data.localReady = true;
        if (this.data.opponentReady) {
            this.startBattle();
        } else {
            this.data.gameMessage = t('bs_waiting_opponent_placement');
        }
        return true;
    }

    setOpponentReady() {
        this.data.opponentReady = true;
        if (this.data.localReady) {
            this.startBattle();
        }
    }

    startBattle() {
        this.data.phase = 'battle';
        this.data.gameTurn = 1;
        this.data.firePending = false;
        this.setTurnMessage();
    }

    isMyTurn() {
        const isOddTurn = this.data.gameTurn % 2 === 1;
        return (this.data.startPlayer === this.data.localPlayer) ? isOddTurn : !isOddTurn;
    }

    canFireAt(row, col) {
        if (this.data.phase !== 'battle' || this.data.gameOver || this.data.firePending || !this.isMyTurn()) {
            return false;
        }
        const cell = this.data.targetGrid[row][col];
        return cell.state === '';
    }

    markPendingShot(row, col) {
        this.data.firePending = true;
        this.data.targetGrid[row][col].state = 'P';
        this.data.gameMessage = t('bs_shot_pending');
    }

    clearFirePending() {
        this.data.firePending = false;
        if (!this.data.gameOver && this.data.phase === 'battle') {
            this.setTurnMessage();
        }
    }

    getFirePending() {
        return this.data.firePending;
    }

    processIncomingFire(row, col) {
        const cell = this.data.fleetGrid[row][col];
        if (cell.targeted) {
            return { valid: false, duplicate: true };
        }
        cell.targeted = true;

        const hit = !!cell.shipId;
        if (hit) {
            cell.hit = true;
        }

        let sunk = false;
        let sunkCells = null;
        if (hit && cell.shipId) {
            const ship = this.data.placedShips.find((s) => s.id === cell.shipId);
            if (ship && ship.cells.every(([r, c]) => this.data.fleetGrid[r][c].hit)) {
                sunk = true;
                sunkCells = ship.cells;
            }
        }

        const allSunk = this.data.placedShips.every((ship) =>
            ship.cells.every(([r, c]) => this.data.fleetGrid[r][c].hit)
        );

        return { valid: true, hit, sunk, sunkCells, allSunk };
    }

    applyFireResult(row, col, hit, sunk, sunkCells) {
        const cell = this.data.targetGrid[row][col];
        cell.state = hit ? (sunk ? 'S' : 'H') : 'M';
        if (sunk && sunkCells) {
            sunkCells.forEach(([r, c]) => {
                this.data.targetGrid[r][c].state = 'S';
            });
        }
    }

    getFleetCellsForReveal() {
        return this.data.placedShips.flatMap((ship) => ship.cells);
    }

    applyFleetReveal(fleetCells) {
        if (!fleetCells) {
            return;
        }
        fleetCells.forEach(([r, c]) => {
            const cell = this.data.targetGrid[r][c];
            if (cell.state === '') {
                cell.state = 'R';
            }
        });
    }

    setWinner(winnerNick) {
        this.data.gameWinner = winnerNick;
        const localWon = winnerNick === this.data.localPlayer;
        this.data.gameMessage = localWon
            ? t('bs_you_won')
            : t('bs_you_lost', { winner: winnerNick });
        this.data.gameOver = true;
    }

    isLocalWinner() {
        return this.data.gameOver && this.data.gameWinner === this.data.localPlayer;
    }

    setPlacementMessage() {
        const remaining = this.data.shipsToPlace.length - this.data.activeShipIndex;
        if (remaining <= 0) {
            this.data.gameMessage = t('bs_placement_done');
            return;
        }
        const ship = this.data.shipsToPlace[this.data.activeShipIndex];
        this.data.gameMessage = t('bs_place_ship', { length: ship.length, remaining });
    }

    setTurnMessage() {
        if (this.data.phase === 'placement') {
            this.setPlacementMessage();
            return;
        }
        this.data.gameMessage = this.isMyTurn()
            ? t('bs_your_turn')
            : t('bs_waiting', { nick: this.data.remotePlayer });
    }

    togglePlacementOrientation() {
        this.data.placementHorizontal = !this.data.placementHorizontal;
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

    getGameTurn() {
        return this.data.gameTurn;
    }

    incrementGameTurn() {
        this.data.gameTurn++;
    }

    getGameMessage() {
        return this.data.gameMessage;
    }

    setGameMessage(val) {
        this.data.gameMessage = val;
    }

    getPhase() {
        return this.data.phase;
    }

    getFleetGrid() {
        return this.data.fleetGrid;
    }

    getTargetGrid() {
        return this.data.targetGrid;
    }

    isLocalReady() {
        return this.data.localReady;
    }

    isPlacementHorizontal() {
        return this.data.placementHorizontal;
    }
}
