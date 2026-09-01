/* global kiwi:true */
import { encodeJsonBase64Url } from './base64url.js';

const GM_TAG = '+gm';

let activeManagementSalon = '';

/** Called when the management sub-plugin actually starts (salon from merged config). */
export function activateManagementSalon(salon) {
    activeManagementSalon = typeof salon === 'string' ? salon.trim() : '';
}

/**
 * Salon for game.start / game.result TAGMSG.
 * Set only by management init — empty if management is not in the build,
 * disabled, or started without a salon. Never infers a salon from config alone.
 */
export function getManagementSalon() {
    return activeManagementSalon;
}

/** True when management is running and a salon channel is configured. */
export function isManagementActive() {
    return Boolean(activeManagementSalon);
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
    } catch (err) {
        console.warn('[kiwi-games] TAGMSG failed', err);
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

function salonTagmsg(network, payload) {
    const salon = getManagementSalon();
    if (!salon || !payload) return;
    const net = network || (kiwi.state.getActiveNetwork && kiwi.state.getActiveNetwork());
    const irc = net && net.ircClient;
    if (!irc) return;
    sendTagmsg(irc, salon, { [GM_TAG]: encodeJsonBase64Url(payload) });
}

/**
 * Tell gameMaster that these nicks started a match, so they leave all queues
 * and lobbies. Sends TAGMSG +gm game.start to the salon only when management
 * is active (a salon was configured and the sub-plugin started).
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

    salonTagmsg(network, {
        op: 'game.start',
        game,
        players,
    });
}

/**
 * Emit analytics event and, if a management salon is configured, broadcast
 * TAGMSG +gm game.result to that channel.
 * Every participant may send the same result; the bot is expected to dedupe
 * and validate NickServ accounts.
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

    salonTagmsg(network, {
        op: 'game.result',
        game,
        players: players.slice(),
        winner,
    });
}
