import Pictionary from './Pictionary.js';
import { incrementUnread as _incrementUnread, sendData as _sendData } from '../../shared/Utils.js';

const TAG = '+kiwiirc.com/pictionary';

const games = {};

export function gameKey(networkId, bufferName) {
  return `${networkId}\0${bufferName}`;
}

export function getGame(key) {
  return games[key];
}

export function getGameForBuffer(buffer) {
  if (!buffer || !buffer.getNetwork) return null;
  const network = buffer.getNetwork();
  return games[gameKey(network.id, buffer.name)];
}

export function bufferIsChannel(buffer) {
  if (!buffer || !buffer.name) return false;
  if (typeof buffer.isChannel === 'function') return buffer.isChannel();
  const n = buffer.name;
  return n.startsWith('#') || n.startsWith('&');
}

export function newGame(network, localPlayer, tagTarget, isChannelGame) {
  const key = gameKey(network.id, tagTarget);
  games[key] = new Pictionary(network, localPlayer, tagTarget, isChannelGame, key);
}

export function setGame(key, game) {
  games[key] = game;
}

export function removeGame(key) {
  delete games[key];
}

export function getGames() {
  return games;
}

export function sendData(network, target, data) {
  _sendData(network, target, data, TAG);
}

export function terminateGame(game) {
  if (!game) {
    return;
  }
  const network = game.getNetwork();
  const tagTarget = game.getTagTarget();
  const buffer = kiwi.state.getBufferByName(network.id, tagTarget);

  if (game.isChannelGame() && game.getShowLobby() && !game.getShowGame()) {
    if (network) {
      sendData(network, tagTarget, { cmd: 'lobby_cancel' });
    }
  } else if (game.getShowInvite()) {
    sendData(network, tagTarget, { cmd: 'invite_declined' });
  } else if (!game.getGameOver()) {
    game.setGameOver('Partie interrompue par toi.');
    if (network) {
      sendData(network, tagTarget, { cmd: 'terminate' });
    }
    if (buffer) {
      kiwi.state.addMessage(buffer, {
        nick: '*',
        message: 'Tu as quitté la partie de Pictionary.',
        type: 'message',
      });
    }
  }
  removeGame(game.getGameKey());
}

export function incrementUnread(buffer) {
  _incrementUnread(buffer);
}
