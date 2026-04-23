import { t } from '../../shared/locales.js';
import {
  randomWord,
  pickUnusedWords,
  normalizeGuess,
  dedupeWordsUsedList,
  isDictionaryPoolExhausted,
} from './words.js';

function listHasNormalizedWord(list, word) {
  const sig = normalizeGuess(word);
  if (!sig) return false;
  return list.some((entry) => normalizeGuess(entry) === sig);
}

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
          wordsUsedThisGame: [],
          /** @type {string[]} */
          wordChoices: [],
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

  startGame(drawerNick, turnOrder, turnsPlayedByNick, scoresByNick, wordsUsedOverride) {
    const state = this.data;
    const resetWordHistory = !state.showGame || state.gameOver;
    const providedOrder = Array.isArray(turnOrder) && turnOrder.length ? turnOrder.slice() : null;
    const order =
      providedOrder ||
      (state.turnOrder && state.turnOrder.length ? state.turnOrder.slice() : state.participants.slice());
    const counts = {};
    const scores = {};
    order.forEach((nick) => {
      const priorTurnsPlayed =
        turnsPlayedByNick && typeof turnsPlayedByNick[nick] === 'number'
          ? turnsPlayedByNick[nick]
          : state.turnsPlayedByNick && typeof state.turnsPlayedByNick[nick] === 'number'
            ? state.turnsPlayedByNick[nick]
            : 0;
      counts[nick] = Math.max(0, Math.min(Pictionary.TURNS_PER_PLAYER, Math.floor(priorTurnsPlayed)));
      const priorScore =
        scoresByNick && typeof scoresByNick[nick] === 'number'
          ? scoresByNick[nick]
          : state.scoresByNick && typeof state.scoresByNick[nick] === 'number'
            ? state.scoresByNick[nick]
            : 0;
      scores[nick] = Math.max(0, Math.floor(priorScore));
    });
    if (Array.isArray(wordsUsedOverride)) {
      state.wordsUsedThisGame = dedupeWordsUsedList(wordsUsedOverride);
    } else if (resetWordHistory) {
      state.wordsUsedThisGame = [];
    } else if (state.secretWord && !listHasNormalizedWord(state.wordsUsedThisGame, state.secretWord)) {
      state.wordsUsedThisGame.push(state.secretWord);
    }
    state.drawer = drawerNick;
    state.turnOrder = order;
    state.turnsPlayedByNick = counts;
    state.scoresByNick = scores;
    state.turnSolved = false;
    state.showGame = true;
    state.showLobby = false;
    state.gameOver = false;
    state.gameMessage = '';
    state.paintOps = [];
    state.lastGuessWrong = false;
    state.secretWord = '';
    state.wordChoices = [];
    if (state.localPlayer === drawerNick) {
      if (isDictionaryPoolExhausted(state.wordsUsedThisGame)) {
        state.wordsUsedThisGame = [];
      }
      const choices = pickUnusedWords(3, state.wordsUsedThisGame);
      state.wordChoices = choices;
      if (choices.length <= 1) {
        if (choices.length === 1) {
          state.secretWord = choices[0];
        } else {
          const one = pickUnusedWords(1, state.wordsUsedThisGame);
          state.secretWord = one.length ? one[0] : randomWord();
        }
        state.wordChoices = [];
      }
    }
    this.setTurnMessage();
  }

  getWordChoices() {
    return this.data.wordChoices.slice();
  }

  hasPendingDrawerWordChoice() {
    return (
      this.isDrawer() &&
      !this.data.gameOver &&
      !this.data.turnSolved &&
      !normalizeGuess(this.data.secretWord) &&
      this.data.wordChoices.length > 0
    );
  }

  chooseDrawerWord(chosen) {
    if (!this.hasPendingDrawerWordChoice() || typeof chosen !== 'string') return;
    const pickSig = normalizeGuess(chosen);
    if (!pickSig) return;
    const match = this.data.wordChoices.find((w) => normalizeGuess(w) === pickSig);
    if (!match) return;
    const proposalExact = new Set(this.data.wordChoices);
    this.data.wordsUsedThisGame = dedupeWordsUsedList(
      this.data.wordsUsedThisGame.filter((w) => !proposalExact.has(w) || w === match),
    );
    this.data.secretWord = match;
    this.data.wordChoices = [];
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
    if (!nick) {
      return { wasParticipant: false, wasDrawer: false };
    }
    const state = this.data;
    const wasParticipant = this.isParticipantNick(nick);
    const wasDrawer = wasParticipant && state.drawer === nick;

    const participantIdx = state.participants.indexOf(nick);
    if (participantIdx !== -1) {
      state.participants.splice(participantIdx, 1);
    }
    const turnOrderIdx = state.turnOrder.indexOf(nick);
    if (turnOrderIdx !== -1) {
      state.turnOrder.splice(turnOrderIdx, 1);
    }
    if (state.turnsPlayedByNick && Object.prototype.hasOwnProperty.call(state.turnsPlayedByNick, nick)) {
      delete state.turnsPlayedByNick[nick];
    }
    if (state.scoresByNick && Object.prototype.hasOwnProperty.call(state.scoresByNick, nick)) {
      delete state.scoresByNick[nick];
    }
    return { wasParticipant, wasDrawer };
  }

  pickNextEligibleDrawer() {
    const state = this.data;
    const order = state.turnOrder.length ? state.turnOrder.slice() : state.participants.slice();
    for (let orderIndex = 0; orderIndex < order.length; orderIndex++) {
      const candidate = order[orderIndex];
      if (!this.isParticipantNick(candidate)) {
        continue;
      }
      const turnsPlayed = state.turnsPlayedByNick[candidate];
      const played = typeof turnsPlayed === 'number' ? turnsPlayed : 0;
      if (played < Pictionary.TURNS_PER_PLAYER) {
        return candidate;
      }
    }
    return null;
  }

  reconcileAfterParticipantRemoved(wasParticipant, wasDrawer) {
    if (!wasParticipant) {
      return null;
    }
    const state = this.data;
    if (!state.showGame || state.gameOver) {
      return 'lobby';
    }
    if (state.participants.length < 2) {
      this.setGameOver(t('pict_not_enough_players'));
      return 'over';
    }
    const drawerStillIn = state.drawer && this.isParticipantNick(state.drawer);
    if (wasDrawer || !drawerStillIn) {
      const nextDrawer = this.pickNextEligibleDrawer();
      if (!nextDrawer) {
        this.setGameOver(t('pict_no_more_turns'));
        return 'over';
      }
      this.startGame(nextDrawer, state.turnOrder.slice(), state.turnsPlayedByNick, state.scoresByNick);
      return 'new_drawer';
    }
    this.setTurnMessage();
    return 'continue';
  }

  renameNickEverywhere(oldNick, newNick) {
    const state = this.data;
    if (state.tagTarget === oldNick) {
      state.tagTarget = newNick;
    }
    if (state.drawer === oldNick) {
      state.drawer = newNick;
    }
    if (state.lobbyHostNick === oldNick) {
      state.lobbyHostNick = newNick;
    }
    const participantIdx = state.participants.indexOf(oldNick);
    if (participantIdx !== -1) {
      state.participants.splice(participantIdx, 1, newNick);
    }
    const turnOrderIdx = state.turnOrder.indexOf(oldNick);
    if (turnOrderIdx !== -1) {
      state.turnOrder.splice(turnOrderIdx, 1, newNick);
    }
    if (state.turnsPlayedByNick && Object.prototype.hasOwnProperty.call(state.turnsPlayedByNick, oldNick)) {
      const turnsPlayed = state.turnsPlayedByNick[oldNick];
      delete state.turnsPlayedByNick[oldNick];
      state.turnsPlayedByNick[newNick] = turnsPlayed;
    }
    if (state.scoresByNick && Object.prototype.hasOwnProperty.call(state.scoresByNick, oldNick)) {
      const score = state.scoresByNick[oldNick];
      delete state.scoresByNick[oldNick];
      state.scoresByNick[newNick] = score;
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

  setShowLobby(value) {
    this.data.showLobby = value;
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

  getWordsUsedThisGame() {
    return dedupeWordsUsedList(this.data.wordsUsedThisGame.slice());
  }

  getWordsUsedPayloadList() {
    const state = this.data;
    const proposalExact = new Set(state.wordChoices || []);
    const chosen = state.secretWord;
    let list = dedupeWordsUsedList(state.wordsUsedThisGame.slice());
    if (proposalExact.size) {
      list = list.filter((w) => !proposalExact.has(w) || w === chosen);
    }
    if (typeof state.secretWord === 'string' && state.secretWord && !listHasNormalizedWord(list, state.secretWord)) {
      list.push(state.secretWord);
    }
    return list;
  }

  addPointForNick(nick) {
    if (!nick) return;
    if (typeof this.data.scoresByNick[nick] !== 'number') {
      this.data.scoresByNick[nick] = 0;
    }
    this.data.scoresByNick[nick] += 1;
  }

  setTurnSolved(solved) {
    this.data.turnSolved = !!solved;
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
        message: t('pict_all_done', { turns: Pictionary.TURNS_PER_PLAYER }),
        wordsUsedThisGame: this.getWordsUsedPayloadList(),
      };
    }

    const currentIndex = order.indexOf(current);
    let nextDrawer = null;
    for (let stepOffset = 1; stepOffset <= order.length; stepOffset++) {
      const candidate = order[(currentIndex + stepOffset) % order.length];
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
        message: t('pict_all_done', { turns: Pictionary.TURNS_PER_PLAYER }),
        wordsUsedThisGame: this.getWordsUsedPayloadList(),
      };
    }

    return {
      finished: false,
      nextDrawer,
      turnOrder: order,
      turnsPlayedByNick: counts,
      scoresByNick: this.getScoresByNick(),
      wordsUsedThisGame: this.getWordsUsedPayloadList(),
    };
  }

  applyNextTurnPayload(payload) {
    if (!payload) return;
    if (Array.isArray(payload.wordsUsedThisGame)) {
      this.data.wordsUsedThisGame = dedupeWordsUsedList(payload.wordsUsedThisGame);
    }
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
      this.setGameOver(payload.message || t('pict_game_over'));
      return;
    }
    if (!payload.nextDrawer) return;
    this.startGame(
      payload.nextDrawer,
      this.data.turnOrder,
      this.data.turnsPlayedByNick,
      this.data.scoresByNick,
      this.data.wordsUsedThisGame.slice(),
    );
  }

  checkGuess(text) {
    const normalizedWord = normalizeGuess(this.data.secretWord);
    const normalizedGuess = normalizeGuess(text);
    return normalizedWord.length > 0 && normalizedGuess === normalizedWord;
  }

  getWord() {
    return this.data.secretWord;
  }

  setWordFromReveal(word) {
    this.data.secretWord = word;
  }

  addPaintOp(op) {
    this.data.paintOps.push(op);
  }

  clearPaintOps() {
    this.data.paintOps = [];
  }

  popLastPaintOp() {
    const paintOps = this.data.paintOps;
    if (paintOps.length > 0) {
      paintOps.pop();
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
        this.data.gameMessage = t('pict_word_found_drawer');
      } else if (this.hasPendingDrawerWordChoice()) {
        this.data.gameMessage = t('pict_choose_word_hint');
      } else {
        this.data.gameMessage = this.data.isChannelGame
          ? t('pict_drawer_channel')
          : t('pict_drawer_pm', { nick: this.data.tagTarget });
      }
    } else if (this.isSpectator()) {
      this.data.gameMessage = t('pict_spectating', { drawer: this.data.drawer });
    } else {
      this.data.gameMessage = t('pict_guessing', { drawer: this.data.drawer });
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

  setDrawer(nick) {
    this.data.drawer = nick;
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

  setInviteSent(sent) {
    this.data.inviteSent = sent;
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

  setGameMessage(message) {
    this.data.gameMessage = message;
  }

  getLastGuessWrong() {
    return this.data.lastGuessWrong;
  }

  setLastGuessWrong(wrong) {
    this.data.lastGuessWrong = wrong;
  }
}
