import { randomWord, normalizeGuess } from './words.js';

export default class Pictionary {
  constructor(network, localPlayer, remotePlayer) {
    this.data = new kiwi.Vue({
      data() {
        return {
          network,
          localPlayer,
          remotePlayer,
          drawer: null,
          secretWord: '',
          inviteTimeout: null,
          inviteSent: false,
          showInvite: false,
          showGame: false,
          gameOver: false,
          gameMessage: '',
          paintOps: [],
          lastGuessWrong: false,
        };
      },
    });
  }

  startGame(drawerNick) {
    const d = this.data;
    d.drawer = drawerNick;
    d.showGame = true;
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
    return !this.isDrawer();
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
      this.data.gameMessage = 'Tu dessines — ' + this.data.remotePlayer + ' devine.';
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

  getRemotePlayer() {
    return this.data.remotePlayer;
  }

  setRemotePlayer(val) {
    this.data.remotePlayer = val;
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
