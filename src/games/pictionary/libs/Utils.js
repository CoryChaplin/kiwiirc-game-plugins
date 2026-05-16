import Pictionary from './Pictionary.js';
import { incrementUnread as _incrementUnread, sendData as _sendData } from '../../shared/Utils.js';
import { t } from '../../shared/locales.js';

const TAG = '+kiwiirc.com/pictionary';

const MAX_TAG_JSON_LENGTH = 400;

/**
 * InspIRCd <connect> limits (https://docs.inspircd.org/4/configuration/).
 * commandrate is millicommands/s (1000 = 1 IRC command/s, e.g. one TAGMSG).
 */
const INSPIRCD_COMMANDRATE_MILLICMD_PER_SEC = 1000;
const INSPIRCD_RECVQ_BYTES = 16384;
const EST_RECV_BYTES_PER_FRAG = 1024;

const FRAG_INTERVAL_COMMANDRATE_MS = Math.ceil(
  1_000_000 / INSPIRCD_COMMANDRATE_MILLICMD_PER_SEC,
);
const FRAG_INTERVAL_RECVQ_MS = Math.max(
  100,
  Math.ceil(((INSPIRCD_RECVQ_BYTES * 0.45) / EST_RECV_BYTES_PER_FRAG) * 14),
);
/** Respect both InspIRCd commandrate and recvq; commandrate is usually the bottleneck. */
const FRAG_SEND_INTERVAL_MS = Math.max(FRAG_INTERVAL_COMMANDRATE_MS, FRAG_INTERVAL_RECVQ_MS);

const games = {};

/** @type {Map<string, { jobs: object[], timer?: number }>} */
const outboundQueues = new Map();

function outboundQueueKey(network, target) {
  return `${network.id}\0${target}`;
}

function pumpOutbound(key) {
  const state = outboundQueues.get(key);
  if (!state || state.timer) return;

  const job = state.jobs[0];
  if (!job) {
    outboundQueues.delete(key);
    return;
  }

  const scheduleNext = (delayMs) => {
    const current = outboundQueues.get(key);
    if (!current?.jobs.length) {
      outboundQueues.delete(key);
      return;
    }
    if (delayMs <= 0) {
      pumpOutbound(key);
      return;
    }
    current.timer = globalThis.setTimeout(() => {
      delete current.timer;
      pumpOutbound(key);
    }, delayMs);
  };

  let delayAfter = 0;
  if (job.frags) {
    const idx = job.fragIndex || 0;
    _sendData(job.network, job.target, job.frags[idx], TAG);
    job.fragIndex = idx + 1;
    if (job.fragIndex >= job.frags.length) {
      state.jobs.shift();
    }
    delayAfter = FRAG_SEND_INTERVAL_MS;
  } else {
    _sendData(job.network, job.target, job.data, TAG);
    state.jobs.shift();
  }

  const nextJob = state.jobs[0];
  const delay =
    delayAfter > 0 || (nextJob && nextJob.frags) ? Math.max(delayAfter, FRAG_SEND_INTERVAL_MS) : 0;
  scheduleNext(delay);
}

function enqueueOutbound(network, target, job) {
  const key = outboundQueueKey(network, target);
  let state = outboundQueues.get(key);
  if (!state) {
    state = { jobs: [] };
    outboundQueues.set(key, state);
  }
  state.jobs.push(job);
  if (!state.timer) {
    pumpOutbound(key);
  }
}

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
    enqueueOutbound(network, target, { network, target, data });
    return;
  }
  const fragId = generateFragId();
  const frags = payloadToFrags(payload, fragId);
  enqueueOutbound(network, target, { network, target, frags, fragIndex: 0 });
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
