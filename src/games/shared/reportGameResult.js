/* global kiwi:true */
import { encodeJsonBase64Url } from './base64url.js';

const GM_TAG = '+gm';
const BRIDGE_KEY = '__kiwiGamesBridge';

/**
 * Le script du jeu et le script principal sont deux bundles : chacun a sa
 * copie de ce module. Le nick du bot et le contrôle ISON vivent sur window.
 */
function managementState() {
    const root = typeof window !== 'undefined' ? window : globalThis;
    if (!root[BRIDGE_KEY]) root[BRIDGE_KEY] = {};
    if (!root[BRIDGE_KEY].management) {
        root[BRIDGE_KEY].management = { nick: '', onlineCheck: null };
    }
    return root[BRIDGE_KEY].management;
}

/** Called when the management sub-plugin actually starts. */
export function activateGameMaster(gameMasterNick) {
    managementState().nick = typeof gameMasterNick === 'string' ? gameMasterNick.trim() : '';
}

/** Optional ISON gate so we never TAGMSG a missing bot nick. */
export function setBotOnlineCheck(fn) {
    managementState().onlineCheck = typeof fn === 'function' ? fn : null;
}

export function getGameMasterNick() {
    return managementState().nick || '';
}

/** True when management is running with a bot nick. */
export function isManagementActive() {
    return Boolean(managementState().nick);
}

function sendTagmsg(ircClient, target, tags) {
    try {
        if (typeof ircClient.tagmsg === 'function') {
            ircClient.tagmsg(target, tags);
            return true;
        }
        if (typeof ircClient.Message === 'function' && typeof ircClient.raw === 'function') {
            const message = new ircClient.Message('TAGMSG', target);
            Object.assign(message.tags, tags);
            ircClient.raw(message);
            return true;
        }
    } catch (_) {
        return false;
    }
    return false;
}

function uniqueNicks(list) {
    const seen = new Set();
    const out = [];
    (list || []).forEach((raw) => {
        const nick = typeof raw === 'string' ? raw.trim() : '';
        if (!nick) return;
        const key = nick.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push(nick);
    });
    return out;
}

function botTagmsg(network, payload) {
    const botNick = getGameMasterNick();
    if (!isManagementActive() || !botNick || !payload) return;
    const net = network || (kiwi.state.getActiveNetwork && kiwi.state.getActiveNetwork());
    const irc = net && net.ircClient;
    if (!irc) return;

    const send = () => {
        sendTagmsg(irc, botNick, { [GM_TAG]: encodeJsonBase64Url(payload) });
    };

    const check = managementState().onlineCheck;
    if (typeof check !== 'function') {
        send();
        return;
    }

    Promise.resolve(check(net, botNick)).then(() => {
        send();
    }).catch(() => {
        send();
    });
}

/**
 * Tell gameMaster that these nicks started a match, so they leave all queues
 * and lobbies. Private TAGMSG +gm game.start to the bot.
 * Sender must be one of `players`.
 *
 * @param {object} network
 * @param {{ game: string, players: string[] }} result
 */
export function announceGameStart(network, result) {
    const game = result && result.game;
    const players = uniqueNicks(result && result.players);

    kiwi.emit('plugin-kiwi-games.game-started', {
        game,
        players: players.slice(),
        network,
    });

    if (!isManagementActive() || !game || players.length === 0) return;

    botTagmsg(network, {
        op: 'game.start',
        game,
        players,
    });
}

/**
 * Emit analytics event and, if management is active, send TAGMSG +gm
 * game.result privately to the bot. Do not broadcast to a channel:
 * every plugin client in the channel would see it and refresh.
 *
 * @param {object} network
 * @param {{ game: string, players: string[], winner: string|null }} result
 */
export function completeGame(network, result) {
    const game = result && result.game;
    const players = (result && result.players) || [];
    const winner = result && result.winner != null && result.winner !== ''
        ? result.winner
        : null;

    kiwi.emit('plugin-kiwi-games.game-completed', {
        game,
        players,
        winner,
    });

    if (!isManagementActive() || !game) return;

    botTagmsg(network, {
        op: 'game.result',
        game,
        players: players.slice(),
        winner,
    });
}
