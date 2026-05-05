import Pictionary from './Pictionary.js';
import { incrementUnread as _incrementUnread, sendData as _sendData } from '../../shared/Utils.js';
import { t } from '../../shared/locales.js';

const TAG = '+kiwiirc.com/pictionary';

const MAX_TAG_JSON_LENGTH = 400;

const games = {};

function generateFragId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

function payloadToFrags(payload, fragId) {
  let chunkSize = Math.min(300, Math.max(1, payload.length));
  while (chunkSize >= 24) {
    const slices = [];
    for (let offset = 0; offset < payload.length; offset += chunkSize) {
      slices.push(payload.slice(offset, offset + chunkSize));
    }
    const numberOfSlices = slices.length;
    const allFit = slices.every((sliceText, fragmentIndex) => {
      const json = JSON.stringify({
        cmd: 'frag',
        id: fragId,
        i: fragmentIndex,
        numberOfSlices,
        data: sliceText,
      });
      return json.length <= MAX_TAG_JSON_LENGTH;
    });
    if (allFit) {
      return slices.map((sliceText, fragmentIndex) => ({
        cmd: 'frag',
        id: fragId,
        i: fragmentIndex,
        numberOfSlices,
        data: sliceText,
      }));
    }
    chunkSize = Math.floor(chunkSize * 0.75);
  }
  const slices = [];
  const minimumChunkSize = 16;
  for (let offset = 0; offset < payload.length; offset += minimumChunkSize) {
    slices.push(payload.slice(offset, offset + minimumChunkSize));
  }
  const numberOfSlices = slices.length;
  return slices.map((sliceText, fragmentIndex) => ({
    cmd: 'frag',
    id: fragId,
    i: fragmentIndex,
    numberOfSlices,
    data: sliceText,
  }));
}

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
  const bufferName = buffer.name;
  return bufferName.startsWith('#') || bufferName.startsWith('&');
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
  const payload = JSON.stringify(data);
  if (payload.length <= MAX_TAG_JSON_LENGTH) {
    _sendData(network, target, data, TAG);
    return;
  }
  const fragId = generateFragId();
  const frags = payloadToFrags(payload, fragId);
  frags.forEach((frag) => _sendData(network, target, frag, TAG));
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
    game.setGameOver(t('pict_you_interrupted'));
    if (network) {
      sendData(network, tagTarget, { cmd: 'terminate' });
    }
    if (buffer) {
      kiwi.state.addMessage(buffer, {
        nick: '*',
        message: t('pict_you_ended'),
        type: 'message',
      });
    }
  }
  removeGame(game.getGameKey());
}

export function incrementUnread(buffer) {
  _incrementUnread(buffer);
}

export function ircInviteToChannel(network, nick, channelName) {
  if (!network || !network.ircClient || !nick || !channelName) return;
  if (nick === network.nick) return;
  try {
    if (typeof network.ircClient.raw === 'function') {
      network.ircClient.raw(`INVITE ${nick} ${channelName}`);
    }
  } catch (_) {
    /* ignore */
  }
}
