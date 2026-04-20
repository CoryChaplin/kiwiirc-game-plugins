import { randomWord, normalizeGuess } from './words.js';

export default class Pictionary {
  static TURNS_PER_PLAYER = 5;

  constructor(network, localPlayer, tagTarget, isChannelGame, gameKey) {
    this._gameKey = gameKey;
    this.data = new kiwi.Vue({
      data() {
        return {
          network,
          localPlayer,
          tagTarget,
          isChannelGame,
          drawer: null,
          secretWord: '',
          inviteTimeout: null,
          inviteSent: false,
          showInvite: false,
          showLobby: false,
          lobbyHostNick: null,
          /** @type {string[]} */
          participants: [],
          /** @type {string[]} */
          turnOrder: [],
          /** @type {Record<string, number>} */
          turnsPlayedByNick: {},
          /** @type {Record<string, number>} */
          scoresByNick: {},
          turnSolved: false,
          showGame: false,
          gameOver: false,
          gameMessage: '',
          /** @type {Array<{type:'stroke',points:object[],color:string,width:number}|{type:'fill',nx:number,ny:number,color:string}>} */
          paintOps: [],
          lastGuessWrong: false,
        };
      },
    });
  }

  getGameKey() {
    return this._gameKey;
  }

  isChannelGame() {
    return this.data.isChannelGame;
  }

  startGame(drawerNick, turnOrder, turnsPlayedByNick, scoresByNick) {
    const d = this.data;
    const providedOrder = Array.isArray(turnOrder) && turnOrder.length ? turnOrder.slice() : null;
    const order =
      providedOrder ||
      (d.turnOrder && d.turnOrder.length ? d.turnOrder.slice() : d.participants.slice());
    const counts = {};
    const scores = {};
    order.forEach((nick) => {
      const n =
        turnsPlayedByNick && typeof turnsPlayedByNick[nick] === 'number'
          ? turnsPlayedByNick[nick]
          : d.turnsPlayedByNick && typeof d.turnsPlayedByNick[nick] === 'number'
            ? d.turnsPlayedByNick[nick]
            : 0;
      counts[nick] = Math.max(0, Math.min(Pictionary.TURNS_PER_PLAYER, Math.floor(n)));
      const s =
        scoresByNick && typeof scoresByNick[nick] === 'number'
          ? scoresByNick[nick]
          : d.scoresByNick && typeof d.scoresByNick[nick] === 'number'
            ? d.scoresByNick[nick]
            : 0;
      scores[nick] = Math.max(0, Math.floor(s));
    });
    d.drawer = drawerNick;
    d.turnOrder = order;
    d.turnsPlayedByNick = counts;
    d.scoresByNick = scores;
    d.turnSolved = false;
    d.showGame = true;
    d.showLobby = false;
    d.gameOver = false;
    d.gameMessage = '';
    d.paintOps = [];
    d.lastGuessWrong = false;
    d.secretWord = '';
    if (d.localPlayer === drawerNick) {
      d.secretWord = randomWord();
    }
    this.setTurnMessage();
  }

  isDrawer() {
    return this.data.localPlayer === this.data.drawer;
  }

  isGuesser() {
    if (this.data.drawer == null) {
      return false;
    }
    if (this.data.isChannelGame) {
      return !this.isDrawer() && this.isLocalParticipant();
    }
    return !this.isDrawer();
  }

  isSpectator() {
    return this.data.isChannelGame && !this.isDrawer() && !this.isLocalParticipant();
  }

  isParticipantNick(nick) {
    return this.data.participants.indexOf(nick) !== -1;
  }

  isLocalParticipant() {
    return this.isParticipantNick(this.data.localPlayer);
  }

  addParticipant(nick) {
    if (!nick || this.isParticipantNick(nick)) return;
    this.data.participants.push(nick);
  }

  removeParticipant(nick) {
    const i = this.data.participants.indexOf(nick);
    if (i !== -1) {
      this.data.participants.splice(i, 1);
    }
  }

  renameNickEverywhere(oldNick, newNick) {
    const d = this.data;
    if (d.tagTarget === oldNick) {
      d.tagTarget = newNick;
    }
    if (d.drawer === oldNick) {
      d.drawer = newNick;
    }
    if (d.lobbyHostNick === oldNick) {
      d.lobbyHostNick = newNick;
    }
    const i = d.participants.indexOf(oldNick);
    if (i !== -1) {
      d.participants.splice(i, 1, newNick);
    }
  }

  setParticipants(list) {
    this.data.participants = Array.isArray(list) ? list.slice() : [];
  }

  getParticipants() {
    return this.data.participants.slice();
  }

  getLobbyHostNick() {
    return this.data.lobbyHostNick;
  }

  setLobbyHostNick(nick) {
    this.data.lobbyHostNick = nick;
  }

  getShowLobby() {
    return this.data.showLobby;
  }

  setShowLobby(v) {
    this.data.showLobby = v;
  }

  canStartLobby() {
    return (
      this.data.isChannelGame &&
      this.data.showLobby &&
      !this.data.showGame &&
      this.data.lobbyHostNick === this.data.localPlayer &&
      this.data.participants.length >= 2
    );
  }

  getTurnOrder() {
    return this.data.turnOrder.slice();
  }

  getTurnsPlayedByNick() {
    return { ...this.data.turnsPlayedByNick };
  }

  getTurnSolved() {
    return this.data.turnSolved;
  }

  getScoresByNick() {
    return { ...this.data.scoresByNick };
  }

  addPointForNick(nick) {
    if (!nick) return;
    if (typeof this.data.scoresByNick[nick] !== 'number') {
      this.data.scoresByNick[nick] = 0;
    }
    this.data.scoresByNick[nick] += 1;
  }

  setTurnSolved(v) {
    this.data.turnSolved = !!v;
  }

  markTurnSolved(msg) {
    this.data.turnSolved = true;
    this.data.gameMessage = msg || this.data.gameMessage;
  }

  canGoNextTurn() {
    return this.isDrawer() && this.data.showGame && !this.data.gameOver && this.data.turnSolved;
  }

  buildNextTurnPayload() {
    if (!this.canGoNextTurn()) return null;
    const order = this.getTurnOrder();
    if (!order.length) return null;
    const counts = this.getTurnsPlayedByNick();
    const current = this.data.drawer;
    if (!current || order.indexOf(current) === -1) return null;

    counts[current] = Math.min(
      Pictionary.TURNS_PER_PLAYER,
      (typeof counts[current] === 'number' ? counts[current] : 0) + 1,
    );
    const finished = order.every((nick) => (counts[nick] || 0) >= Pictionary.TURNS_PER_PLAYER);
    if (finished) {
      return {
        finished: true,
        turnOrder: order,
        turnsPlayedByNick: counts,
        scoresByNick: this.getScoresByNick(),
        message: 'Partie terminée — tout le monde a dessiné 5 fois.',
      };
    }

    const currentIndex = order.indexOf(current);
    let nextDrawer = null;
    for (let i = 1; i <= order.length; i++) {
      const candidate = order[(currentIndex + i) % order.length];
      if ((counts[candidate] || 0) < Pictionary.TURNS_PER_PLAYER) {
        nextDrawer = candidate;
        break;
      }
    }
    if (!nextDrawer) {
      return {
        finished: true,
        turnOrder: order,
        turnsPlayedByNick: counts,
        scoresByNick: this.getScoresByNick(),
        message: 'Partie terminée — tout le monde a dessiné 5 fois.',
      };
    }

    return {
      finished: false,
      nextDrawer,
      turnOrder: order,
      turnsPlayedByNick: counts,
      scoresByNick: this.getScoresByNick(),
    };
  }

  applyNextTurnPayload(payload) {
    if (!payload) return;
    if (Array.isArray(payload.turnOrder)) {
      this.data.turnOrder = payload.turnOrder.slice();
    }
    if (payload.turnsPlayedByNick && typeof payload.turnsPlayedByNick === 'object') {
      this.data.turnsPlayedByNick = { ...payload.turnsPlayedByNick };
    }
    if (payload.scoresByNick && typeof payload.scoresByNick === 'object') {
      this.data.scoresByNick = { ...payload.scoresByNick };
    }
    if (payload.finished) {
      this.data.turnSolved = false;
      this.setGameOver(payload.message || 'Partie terminée.');
      return;
    }
    if (!payload.nextDrawer) return;
    this.startGame(
      payload.nextDrawer,
      this.data.turnOrder,
      this.data.turnsPlayedByNick,
      this.data.scoresByNick,
    );
  }

  checkGuess(text) {
    const word = normalizeGuess(this.data.secretWord);
    const g = normalizeGuess(text);
    return word.length > 0 && g === word;
  }

  getWord() {
    return this.data.secretWord;
  }

  setWordFromReveal(w) {
    this.data.secretWord = w;
  }

  addPaintOp(op) {
    this.data.paintOps.push(op);
  }

  clearPaintOps() {
    this.data.paintOps = [];
  }

  popLastPaintOp() {
    const p = this.data.paintOps;
    if (p.length > 0) {
      p.pop();
    }
  }

  getPaintOps() {
    return this.data.paintOps;
  }

  setGameOver(msg) {
    this.data.gameOver = true;
    this.data.gameMessage = msg;
  }

  setTurnMessage() {
    if (this.data.gameOver) return;
    if (this.isDrawer()) {
      if (this.data.turnSolved) {
        this.data.gameMessage = 'Mot trouvé ! Clique sur "Tour suivant".';
      } else {
        this.data.gameMessage = this.data.isChannelGame
          ? 'Tu dessines — les autres devinent.'
          : 'Tu dessines — ' + this.data.tagTarget + ' devine.';
      }
    } else if (this.isSpectator()) {
      this.data.gameMessage = this.data.drawer + ' dessine — tu observes cette partie.';
    } else {
      this.data.gameMessage = this.data.drawer + ' dessine — à toi de deviner !';
    }
  }

  getNetwork() {
    return this.data.network;
  }

  setLocalPlayer(val) {
    this.data.localPlayer = val;
  }

  getTagTarget() {
    return this.data.tagTarget;
  }

  getDrawer() {
    return this.data.drawer;
  }

  setDrawer(val) {
    this.data.drawer = val;
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

  getGameMessage() {
    return this.data.gameMessage;
  }

  setGameMessage(val) {
    this.data.gameMessage = val;
  }

  getLastGuessWrong() {
    return this.data.lastGuessWrong;
  }

  setLastGuessWrong(v) {
    this.data.lastGuessWrong = v;
  }
}
