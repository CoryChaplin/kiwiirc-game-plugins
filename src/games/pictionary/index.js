import * as Utils from './libs/Utils.js';
import GameComponent from './components/GameComponent.vue';
import Pictionary from './libs/Pictionary.js';
import { t } from '../shared/locales.js';

function echoDrawCmd(cmd) {
  return cmd === 'stroke' || cmd === 'fill' || cmd === 'clear' || cmd === 'undo';
}

function randomRoomName() {
  const id = String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
  return `#pictionary${id}`;
}

function parsePictionaryArgs(event) {
  if (!event) return [];
  if (Array.isArray(event.params)) {
    return event.params.map((param) => String(param || '').trim()).filter(Boolean);
  }
  const raw =
    (typeof event.input === 'string' && event.input) ||
    (typeof event.message === 'string' && event.message) ||
    (typeof event.params === 'string' && event.params) ||
    '';
  const cleaned = raw.replace(/^\/pictionary\s*/i, '').trim();
  if (!cleaned) return [];
  return cleaned.split(/\s+/).filter(Boolean);
}

function joinChannel(network, channelName) {
  if (!network || !network.ircClient || !channelName) return;
  try {
    if (typeof network.ircClient.Message === 'function') {
      const joinMsg = new network.ircClient.Message('JOIN', channelName);
      joinMsg.prefix = network.nick;
      network.ircClient.raw(joinMsg);
      return;
    }
  } catch (e) {
    // fallback below
  }
  if (typeof network.ircClient.raw === 'function') {
    network.ircClient.raw(`JOIN ${channelName}`);
  }
}

function setPictionaryRoomModes(network, channelName) {
  if (!network || !network.ircClient || !channelName) return;
  if (typeof network.ircClient.raw === 'function') {
    network.ircClient.raw(`MODE ${channelName} +is`);
  }
}

function activateBuffer(kiwi, buffer) {
  if (!kiwi || !kiwi.state || !buffer) return;
  const networkId =
    buffer.networkId || buffer.networkid || (typeof buffer.getNetwork === 'function' && buffer.getNetwork().id);
  if (typeof kiwi.state.setActiveBufferByName === 'function') {
    if (networkId && buffer.name) {
      kiwi.state.setActiveBufferByName(networkId, buffer.name);
      return;
    }
  }
  if (typeof kiwi.state.setActiveBuffer === 'function') {
    if (kiwi.state.setActiveBuffer.length >= 2 && networkId && buffer.name) {
      kiwi.state.setActiveBuffer(networkId, buffer.name);
      return;
    }
    kiwi.state.setActiveBuffer(buffer);
    return;
  }
  if (kiwi.state.ui && Object.prototype.hasOwnProperty.call(kiwi.state.ui, 'active_buffer')) {
    kiwi.state.ui.active_buffer = buffer;
  }
}

function hasInputContext(context) {
  return !!(context && context.network && context.buffer);
}

function pictionaryPartChannel(event) {
  if (!event || typeof event !== 'object') return '';
  const channelFromEvent =
    event.channel ||
    event.target ||
    (Array.isArray(event.params) && event.params[0]) ||
    '';
  return String(channelFromEvent || '').trim();
}

function channelNamesMatch(channelA, channelB) {
  if (!channelA || !channelB) return false;
  return String(channelA).toLowerCase() === String(channelB).toLowerCase();
}

const FRAG_TIMEOUT_MS = 45000;
const FRAG_MAX_PARTS = 2000;

/** @type {Map<string, { partCount: number, parts: string[], timer?: number }>} */
const fragBuffers = new Map();

function cleanupFragState(reassemblyKey) {
  const entry = fragBuffers.get(reassemblyKey);
  if (entry?.timer) globalThis.clearTimeout(entry.timer);
  fragBuffers.delete(reassemblyKey);
}

function scheduleFragExpiry(reassemblyKey) {
  const entry = fragBuffers.get(reassemblyKey);
  if (!entry) return;
  if (entry.timer) globalThis.clearTimeout(entry.timer);
  entry.timer = globalThis.setTimeout(() => cleanupFragState(reassemblyKey), FRAG_TIMEOUT_MS);
}

function consumePictionaryFrag(network, event, tagPayload) {
  const fragmentId = tagPayload.id;
  const fragmentIndex = tagPayload.i;
  const partCount = tagPayload.numberOfSlices;
  const payloadChunk = tagPayload.data;
  if (
    typeof fragmentId !== 'string' ||
    !fragmentId ||
    typeof fragmentIndex !== 'number' ||
    typeof partCount !== 'number' ||
    typeof payloadChunk !== 'string'
  ) {
    return null;
  }
  if (partCount < 1 || partCount > FRAG_MAX_PARTS || fragmentIndex < 0 || fragmentIndex >= partCount) {
    return null;
  }
  const reassemblyKey = `${network.id}\0${event.nick}\0${fragmentId}`;
  let state = fragBuffers.get(reassemblyKey);
  if (!state) {
    state = { partCount, parts: new Array(partCount) };
    fragBuffers.set(reassemblyKey, state);
  } else if (state.partCount !== partCount) {
    cleanupFragState(reassemblyKey);
    return null;
  }
  state.parts[fragmentIndex] = payloadChunk;
  scheduleFragExpiry(reassemblyKey);
  for (let idx = 0; idx < partCount; idx++) {
    if (state.parts[idx] === undefined) return null;
  }
  cleanupFragState(reassemblyKey);
  const joinedPayload = state.parts.join('');
  try {
    return JSON.parse(joinedPayload);
  } catch {
    return null;
  }
}

function handlePictionaryChannelParticipantGone(kiwi, network, game, gameKey, nick, leftVerb) {
  const targetBuffer = kiwi.state.getBufferByName(network.id, game.getTagTarget());
  const removed = game.removeParticipant(nick);
  if (game.getLobbyHostNick() === nick && game.getShowLobby()) {
    Utils.removeGame(gameKey);
    if (targetBuffer) {
      kiwi.state.addMessage(targetBuffer, {
        nick: '*',
        message: t('pict_host_left'),
        type: 'message',
      });
    }
    kiwi.emit('plugin-pictionary.update-button');
    return;
  }
  if (game.getShowGame() && !game.getGameOver()) {
    const outcome = game.reconcileAfterParticipantRemoved(removed.wasParticipant, removed.wasDrawer);
    if (outcome === 'over' && targetBuffer) {
      kiwi.state.addMessage(targetBuffer, {
        nick: '*',
        message: game.getGameMessage(),
        type: 'message',
      });
    } else if (outcome === 'new_drawer' && targetBuffer) {
      kiwi.state.addMessage(targetBuffer, {
        nick: '*',
        message: t('pict_drawer_left', { nick, verb: leftVerb, drawer: game.getDrawer() }),
        type: 'message',
      });
      kiwi.emit('plugin-pictionary.redraw-canvas');
    } else if (outcome === 'continue' && targetBuffer && removed.wasParticipant) {
      kiwi.state.addMessage(targetBuffer, {
        nick: '*',
        message: t('pict_participant_left', { nick, verb: leftVerb }),
        type: 'message',
      });
    }
    kiwi.emit('plugin-pictionary.update-button');
    return;
  }
  if (game.getShowLobby() && targetBuffer && removed.wasParticipant) {
    kiwi.state.addMessage(targetBuffer, {
      nick: '*',
      message: t('pict_nick_left', { nick, verb: leftVerb }),
      type: 'message',
    });
  }
  kiwi.emit('plugin-pictionary.update-button');
}

export function init(kiwi, config) {
  const cfg = { button: true, command: true, ...config };
  let mediaViewerOpen = false;

  kiwi.on('irc.raw.TAGMSG', (command, event, network) => {
    const raw = event.tags['+kiwiirc.com/pictionary'];
    if (!raw || raw.charAt(0) !== '{') {
      return;
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return;
    }

    const target = event.params[0];
    const isChannelTarget = target.startsWith('#') || target.startsWith('&');
    const pmToMe = target === network.nick;

    if (!isChannelTarget && !pmToMe) {
      return;
    }

    if (event.nick === network.nick && data.cmd === 'frag') {
      return;
    }

    if (data.cmd === 'frag') {
      const assembled = consumePictionaryFrag(network, event, data);
      if (!assembled) {
        return;
      }
      data = assembled;
    }

    if (event.nick === network.nick && echoDrawCmd(data.cmd)) {
      return;
    }

    const gameKey = isChannelTarget
      ? Utils.gameKey(network.id, target)
      : Utils.gameKey(network.id, event.nick);

    const bufferName = isChannelTarget ? target : event.nick;
    const buffer = kiwi.state.getOrAddBufferByName(network.id, bufferName);

    let game = Utils.getGame(gameKey);

    switch (data.cmd) {
      case 'invite': {
        if (!game) {
          Utils.newGame(network, network.nick, event.nick, false);
        }
        game = Utils.getGame(gameKey);
        game.setShowInvite(true);
        kiwi.emit('plugin-pictionary.update-button');
        kiwi.state.addMessage(buffer, {
          nick: '*',
          message: t('pict_invite_received'),
          type: 'message',
        });
        Utils.sendData(network, event.nick, { cmd: 'invite_received' });
        const active = kiwi.state.getActiveBuffer();
        if (!mediaViewerOpen && active && active.name === event.nick) {
          kiwi.emit('mediaviewer.show', { component: GameComponent });
        }
        break;
      }
      case 'invite_received': {
        if (game) {
          const inviteTimeout = game.getInviteTimeout();
          if (inviteTimeout) {
            window.clearTimeout(inviteTimeout);
            game.setInviteTimeout(null);
          }
        }
        break;
      }
      case 'invite_accepted': {
        if (!game) break;
        kiwi.state.addMessage(buffer, {
          nick: '*',
          message: t('pict_invite_accepted', { nick: event.nick }),
          type: 'message',
        });
        game.startGame(data.drawer);
        game.setInviteSent(false);
        const active = kiwi.state.getActiveBuffer();
        if (!mediaViewerOpen && active && active.name === game.getTagTarget()) {
          kiwi.emit('mediaviewer.show', { component: GameComponent });
        }
        break;
      }
      case 'invite_declined': {
        if (!game) break;
        kiwi.state.addMessage(buffer, {
          nick: '*',
          message: t('pict_invite_declined', { nick: event.nick }),
          type: 'message',
        });
        game.setInviteSent(false);
        break;
      }
      case 'room_invite': {
        if (!data.room || !data.host) break;
        const roomName = String(data.room);
        const pmBuffer = kiwi.state.getOrAddBufferByName(network.id, event.nick);
        const roomKey = Utils.gameKey(network.id, roomName);
        let roomGame = Utils.getGame(roomKey);
        if (!roomGame) {
          Utils.newGame(network, network.nick, roomName, true);
          roomGame = Utils.getGame(roomKey);
        }
        roomGame.setLobbyHostNick(data.host);
        roomGame.setShowLobby(false);
        roomGame.setShowInvite(true);
        if (Array.isArray(data.participants) && data.participants.length) {
          roomGame.setParticipants(data.participants);
        } else {
          roomGame.setParticipants([data.host]);
        }
        kiwi.state.addMessage(pmBuffer, {
          nick: '*',
          message: t('pict_room_invite_pm', { host: data.host, room: roomName }),
          type: 'message',
        });
        kiwi.emit('plugin-pictionary.update-button');
        break;
      }
      case 'channel_lobby': {
        if (!data.host) break;
        if (event.nick === network.nick) break;
        if (!game) {
          Utils.newGame(network, network.nick, target, true);
          game = Utils.getGame(gameKey);
        }
        game.setLobbyHostNick(data.host);
        game.setShowLobby(true);
        game.setShowInvite(false);
        if (Array.isArray(data.participants) && data.participants.length) {
          game.setParticipants(data.participants);
        } else {
          game.setParticipants([]);
          game.addParticipant(data.host);
        }
        kiwi.state.addMessage(buffer, {
          nick: '*',
          message: t('pict_channel_lobby', { host: data.host }),
          type: 'message',
        });
        kiwi.emit('plugin-pictionary.update-button');
        const active = kiwi.state.getActiveBuffer();
        if (
          !mediaViewerOpen &&
          active &&
          active.name === target &&
          Utils.bufferIsChannel(active)
        ) {
          kiwi.emit('mediaviewer.show', { component: GameComponent });
        }
        break;
      }
      case 'lobby_join': {
        if (!game || !game.getShowLobby() || game.getShowGame()) break;
        if (typeof data.nick === 'string') {
          game.addParticipant(data.nick);
        }
        if (
          isChannelTarget &&
          game.isChannelGame() &&
          game.getLobbyHostNick() === network.nick
        ) {
          Utils.sendData(network, target, {
            cmd: 'lobby_sync',
            participants: game.getParticipants(),
          });
        }
        kiwi.emit('plugin-pictionary.update-button');
        break;
      }
      case 'lobby_sync': {
        if (!game || !game.getShowLobby() || game.getShowGame()) break;
        if (Array.isArray(data.participants) && data.participants.length) {
          game.setParticipants(data.participants);
        }
        kiwi.emit('plugin-pictionary.update-button');
        break;
      }
      case 'room_accept': {
        if (!data.room) break;
        const roomName = String(data.room);
        const roomKey = Utils.gameKey(network.id, roomName);
        const roomGame = Utils.getGame(roomKey);
        if (!roomGame) break;
        if (
          roomGame.getLobbyHostNick() === network.nick &&
          roomGame.getShowLobby() &&
          !roomGame.getShowGame() &&
          typeof event.nick === 'string' &&
          event.nick
        ) {
          roomGame.addParticipant(event.nick);
          Utils.sendData(network, roomName, {
            cmd: 'lobby_sync',
            participants: roomGame.getParticipants(),
          });
        }
        if (roomGame.getShowGame()) {
          Utils.sendData(network, event.nick, {
            cmd: 'room_sync',
            room: roomName,
            drawer: roomGame.getDrawer(),
            participants: roomGame.getParticipants(),
            turnOrder: roomGame.getTurnOrder(),
            turnsPlayedByNick: roomGame.getTurnsPlayedByNick(),
            scoresByNick: roomGame.getScoresByNick(),
            turnSolved: roomGame.getTurnSolved(),
            paintOps: roomGame.getPaintOps(),
            gameOver: roomGame.getGameOver(),
            gameMessage: roomGame.getGameMessage(),
            wordsUsedThisGame: roomGame.getWordsUsedThisGame(),
          });
        }
        break;
      }
      case 'room_sync': {
        if (!data.room || !data.drawer) break;
        const roomName = String(data.room);
        const roomKey = Utils.gameKey(network.id, roomName);
        let roomGame = Utils.getGame(roomKey);
        if (!roomGame) {
          Utils.newGame(network, network.nick, roomName, true);
          roomGame = Utils.getGame(roomKey);
        }
        if (Array.isArray(data.participants)) {
          roomGame.setParticipants(data.participants);
        }
        roomGame.setShowInvite(false);
        roomGame.setShowLobby(false);
        roomGame.startGame(
          data.drawer,
          data.turnOrder,
          data.turnsPlayedByNick,
          data.scoresByNick,
          Array.isArray(data.wordsUsedThisGame) ? data.wordsUsedThisGame : undefined,
        );
        if (Array.isArray(data.paintOps)) {
          roomGame.clearPaintOps();
          data.paintOps.forEach((op) => {
            if (op && (op.type === 'stroke' || op.type === 'fill')) {
              roomGame.addPaintOp(op);
            }
          });
        }
        if (data.gameOver) {
          roomGame.setGameOver(data.gameMessage || t('pict_game_over'));
        } else if (data.turnSolved) {
          roomGame.markTurnSolved(data.gameMessage || t('pict_word_found_msg'));
        } else {
          roomGame.setTurnMessage();
        }
        const roomBuffer = kiwi.state.getOrAddBufferByName(network.id, roomName);
        activateBuffer(kiwi, roomBuffer);
        kiwi.emit('plugin-pictionary.redraw-canvas');
        kiwi.emit('plugin-pictionary.update-button');
        kiwi.emit('mediaviewer.show', { component: GameComponent });
        break;
      }
      case 'lobby_cancel': {
        if (game && game.getShowLobby()) {
          Utils.removeGame(gameKey);
          kiwi.state.addMessage(buffer, {
            nick: '*',
            message: t('pict_lobby_cancelled'),
            type: 'message',
          });
          kiwi.emit('plugin-pictionary.update-button');
          const active = kiwi.state.getActiveBuffer();
          if (active && active.name === target) {
            kiwi.emit('mediaviewer.hide', { source: 'plugin' });
          }
        }
        break;
      }
      case 'game_start': {
        if (!game || !data.drawer) break;
        if (
          event.nick === network.nick &&
          game.getShowGame() &&
          !game.getGameOver() &&
          data.drawer === game.getDrawer()
        ) {
          break;
        }
        if (Array.isArray(data.participants)) {
          game.setParticipants(data.participants);
        }
        game.startGame(
          data.drawer,
          data.turnOrder,
          data.turnsPlayedByNick,
          data.scoresByNick,
          Array.isArray(data.wordsUsedThisGame) ? data.wordsUsedThisGame : undefined,
        );
        game.setInviteSent(false);
        kiwi.emit('plugin-kiwi-games.game-started', { game: 'pictionary' });
        kiwi.state.addMessage(buffer, {
          nick: '*',
          message: t('pict_game_start', { drawer: data.drawer }),
          type: 'message',
        });
        const active = kiwi.state.getActiveBuffer();
        if (!mediaViewerOpen && active && active.name === target) {
          kiwi.emit('mediaviewer.show', { component: GameComponent });
        }
        kiwi.emit('plugin-pictionary.update-button');
        break;
      }
      case 'stroke': {
        if (game && event.nick === game.getDrawer() && data.points && data.points.length) {
          game.addPaintOp({
            type: 'stroke',
            points: data.points,
            color: data.color || '#1a1a1a',
            width: typeof data.width === 'number' ? data.width : 3,
          });
          kiwi.emit('plugin-pictionary.redraw-canvas');
        }
        break;
      }
      case 'fill': {
        if (
          game &&
          event.nick === game.getDrawer() &&
          typeof data.nx === 'number' &&
          typeof data.ny === 'number' &&
          typeof data.color === 'string'
        ) {
          game.addPaintOp({
            type: 'fill',
            nx: Math.max(0, Math.min(1000, Math.round(data.nx))),
            ny: Math.max(0, Math.min(1000, Math.round(data.ny))),
            color: data.color,
          });
          kiwi.emit('plugin-pictionary.redraw-canvas');
        }
        break;
      }
      case 'clear': {
        if (game && event.nick === game.getDrawer()) {
          game.clearPaintOps();
          kiwi.emit('plugin-pictionary.redraw-canvas');
        }
        break;
      }
      case 'undo': {
        if (game && event.nick === game.getDrawer() && !game.getGameOver()) {
          game.popLastPaintOp();
          kiwi.emit('plugin-pictionary.redraw-canvas');
        }
        break;
      }
      case 'guess': {
        if (!game || !game.isDrawer() || typeof data.text !== 'string' || game.getGameOver()) {
          break;
        }
        if (game.getTurnSolved()) {
          break;
        }
        if (game.isChannelGame()) {
          if (!game.isParticipantNick(event.nick) || event.nick === game.getDrawer()) {
            break;
          }
        } else if (event.nick !== game.getTagTarget()) {
          break;
        }
        const ok = game.checkGuess(data.text);
        Utils.sendData(network, game.getTagTarget(), {
          cmd: 'guess_result',
          correct: ok,
          word: ok ? game.getWord() : undefined,
          guesser: event.nick,
        });
        if (ok) {
          const who = event.nick;
          const word = game.getWord();
          const msg = t('pict_found_shout', { nick: who, word });
          game.addPointForNick(who);
          game.setLastGuessWrong(false);
          game.markTurnSolved(t('pict_correct_celebrate', { nick: who, word }));
          kiwi.state.addMessage(buffer, {
            nick: '*',
            message: msg,
            type: 'message',
          });
        }
        kiwi.emit('plugin-pictionary.update-button');
        break;
      }
      case 'guess_result': {
        if (!game) break;
        if (data.correct) {
          if (event.nick === network.nick) {
            break;
          }
          if (game.getTurnSolved()) {
            break;
          }
          if (data.word) {
            game.setWordFromReveal(data.word);
          }
          if (data.guesser) {
            game.addPointForNick(data.guesser);
          }
          game.setLastGuessWrong(false);
          const who = data.guesser || t('pict_anonymous_player');
          game.markTurnSolved(t('pict_correct_celebrate', { nick: who, word: data.word || '' }));
        } else {
          if (!game.isGuesser()) break;
          if (game.isChannelGame()) {
            if (data.guesser !== network.nick) break;
          } else if (event.nick !== game.getDrawer()) break;
          game.setLastGuessWrong(true);
        }
        kiwi.emit('plugin-pictionary.update-button');
        break;
      }
      case 'next_turn': {
        if (!game) break;
        if (event.nick !== game.getDrawer()) break;
        if (event.nick === network.nick) {
          if (data.finished) {
            if (game.getGameOver()) break;
          } else if (
            data.nextDrawer &&
            game.getDrawer() === data.nextDrawer &&
            game.getShowGame() &&
            !game.getGameOver()
          ) {
            break;
          }
        }
        game.applyNextTurnPayload(data);
        if (data.finished && game.getGameOver()) {
          kiwi.emit('plugin-kiwi-games.game-completed', { game: 'pictionary' });
        }
        if (game.getShowGame() && !game.getGameOver()) {
          kiwi.state.addMessage(buffer, {
            nick: '*',
            message: t('pict_next_turn_msg', { drawer: game.getDrawer() }),
            type: 'message',
          });
        }
        kiwi.emit('plugin-pictionary.redraw-canvas');
        kiwi.emit('plugin-pictionary.update-button');
        break;
      }
      case 'error': {
        if (game) {
          game.setGameOver(data.message || t('pict_error_default'));
          kiwi.emit('plugin-pictionary.update-button');
        }
        break;
      }
      case 'terminate': {
        if (game) {
          game.setGameOver(t('pict_ended_by', { nick: event.nick }));
          kiwi.state.addMessage(buffer, {
            nick: '*',
            message: t('pict_remote_ended', { nick: event.nick }),
            type: 'message',
          });
          kiwi.emit('plugin-pictionary.update-button');
        }
        break;
      }
      default:
        break;
    }

    if (data.cmd && data.cmd !== 'invite_received') {
      Utils.incrementUnread(buffer);
    }
  });

  kiwi.on('mediaviewer.show', (viewerPayload) => {
    mediaViewerOpen = viewerPayload.component === GameComponent;
  });

  kiwi.on('mediaviewer.hide', (event) => {
    if (mediaViewerOpen && event && event.source === 'user') {
      const buffer = kiwi.state.getActiveBuffer();
      const game = Utils.getGameForBuffer(buffer);
      if (game) {
        Utils.terminateGame(game);
      }
    }
    mediaViewerOpen = false;
  });

  kiwi.on('irc.nick', (event, network) => {
    if (event.nick === network.nick) {
      Object.keys(Utils.getGames()).forEach((key) => {
        const game = Utils.getGame(key);
        if (game) {
          if (game.getDrawer() === event.nick) {
            game.setDrawer(event.new_nick);
          }
          game.setLocalPlayer(event.new_nick);
        }
      });
      return;
    }

    Object.keys(Utils.getGames()).forEach((key) => {
      const game = Utils.getGame(key);
      if (!game) return;
      if (game.isChannelGame()) {
        game.renameNickEverywhere(event.nick, event.new_nick);
        return;
      }
      const pmKey = Utils.gameKey(network.id, event.nick);
      if (key === pmKey) {
        game.renameNickEverywhere(event.nick, event.new_nick);
        game._gameKey = Utils.gameKey(network.id, event.new_nick);
        Utils.setGame(key, null);
        Utils.setGame(game._gameKey, game);
      }
    });
  });

  function launchPictionaryFromCommand(commandEvent, explicitNetwork) {
    const network = explicitNetwork || kiwi.state.getActiveNetwork();
    if (!network || !network.nick) return;
    const players = parsePictionaryArgs(commandEvent)
      .map((token) => token.replace(/^@+/, '').trim())
      .filter((token) => token && token !== network.nick);
    if (!players.length) {
      const activeBuffer = kiwi.state.getActiveBuffer();
      if (activeBuffer) {
        kiwi.state.addMessage(activeBuffer, {
          nick: '*',
          message: t('pict_usage'),
          type: 'message',
        });
      }
      return;
    }

    const uniquePlayers = Array.from(new Set(players));
    const maxRemoteInvites = Pictionary.MAX_PLAYERS - 1;
    if (uniquePlayers.length > maxRemoteInvites) {
      const activeBuffer = kiwi.state.getActiveBuffer();
      if (activeBuffer) {
        kiwi.state.addMessage(activeBuffer, {
          nick: '*',
          message: t('pict_too_many_players', { max: Pictionary.MAX_PLAYERS }),
          type: 'message',
        });
      }
      return;
    }
    const roomName = randomRoomName();
    joinChannel(network, roomName);
    setPictionaryRoomModes(network, roomName);
    const roomBuffer = kiwi.state.getOrAddBufferByName(network.id, roomName);
    const roomKey = Utils.gameKey(network.id, roomName);
    let roomGame = Utils.getGame(roomKey);
    if (!roomGame) {
      Utils.newGame(network, network.nick, roomName, true);
      roomGame = Utils.getGame(roomKey);
    }
    const participants = [network.nick];
    roomGame.setLobbyHostNick(network.nick);
    roomGame.setShowLobby(true);
    roomGame.setShowInvite(false);
    roomGame.setParticipants(participants);
    roomGame.addParticipant(network.nick);

    Utils.sendData(network, roomName, {
      cmd: 'channel_lobby',
      host: network.nick,
      participants: participants.slice(),
    });

    uniquePlayers.forEach((nick) => {
      Utils.ircInviteToChannel(network, nick, roomName);
      Utils.sendData(network, nick, {
        cmd: 'room_invite',
        host: network.nick,
        room: roomName,
        participants: participants.slice(),
      });
    });
    kiwi.emit('plugin-kiwi-games.game-proposed', { game: 'pictionary' });

    kiwi.state.addMessage(roomBuffer, {
      nick: '*',
      message: t('pict_room_created', { room: roomName, list: uniquePlayers.join(', ') }),
      type: 'message',
    });
    activateBuffer(kiwi, roomBuffer);
    kiwi.emit('plugin-pictionary.update-button');
    kiwi.emit('mediaviewer.show', { component: GameComponent });
  }

  if (cfg.command) {
    kiwi.on('input.command.pictionary', (event, _command, _params, context) => {
      if (event && event.handled) return;
      event.handled = true;
      const network = (context && context.network) || kiwi.state.getActiveNetwork();
      launchPictionaryFromCommand(event, network);
    });
  }

  kiwi.on('irc.quit', (event, network) => {
    if (event.nick === network.nick) {
      Object.keys(Utils.getGames()).forEach((key) => {
        const game = Utils.getGame(key);
        if (game && game.getInviteSent()) {
          Utils.removeGame(key);
        }
      });
      kiwi.emit('plugin-pictionary.update-button');
      return;
    }

    Object.keys(Utils.getGames()).forEach((key) => {
      const game = Utils.getGame(key);
      if (!game) return;

      if (game.isChannelGame()) {
        handlePictionaryChannelParticipantGone(kiwi, network, game, key, event.nick, t('pict_left_irc'));
        return;
      }

      const pmKey = Utils.gameKey(network.id, event.nick);
      if (key === pmKey && game.getInviteSent()) {
        Utils.removeGame(key);
        kiwi.emit('plugin-pictionary.update-button');
      }
    });
  });

  kiwi.on('irc.part', (event, network) => {
    const nick = event && event.nick;
    const channel = pictionaryPartChannel(event);
    if (!nick || !channel) return;
    Object.keys(Utils.getGames()).forEach((key) => {
      const game = Utils.getGame(key);
      if (!game || !game.isChannelGame()) return;
      if (!channelNamesMatch(game.getTagTarget(), channel)) return;
      handlePictionaryChannelParticipantGone(kiwi, network, game, key, nick, t('pict_left_channel'));
    });
  });

  kiwi.state.$watch('ui.active_buffer', () => {
    const buffer = kiwi.state.getActiveBuffer();
    const game = Utils.getGameForBuffer(buffer);
    if (
      game &&
      (game.getShowGame() || game.getShowInvite() || game.getShowLobby()) &&
      !mediaViewerOpen
    ) {
      kiwi.emit('mediaviewer.show', { component: GameComponent });
    } else if (!game && mediaViewerOpen) {
      kiwi.emit('mediaviewer.hide');
    }
  });
}
