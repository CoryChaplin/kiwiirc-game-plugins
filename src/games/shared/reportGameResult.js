/* global kiwi:true */
import { encodeJsonBase64Url } from './base64url.js';

const GM_TAG = '+gm';

let activeManagementSalon = '';

/** Called when the management sub-plugin starts (salon from merged config). */
export function activateManagementSalon(salon) {
    activeManagementSalon = typeof salon === 'string' ? salon.trim() : '';
}

/**
 * Salon used for game.result broadcasts.
 * Prefers the salon activated by management init; falls back to config.
 */
export function getManagementSalon() {
    if (activeManagementSalon) return activeManagementSalon;
    const settings = (kiwi.state.settings && kiwi.state.settings.plugin_kiwi_games) || {};
    const mgmt = settings.management || {};
    if (mgmt.enabled === false) return '';
    return typeof mgmt.salon === 'string' ? mgmt.salon.trim() : '';
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
        console.warn('[kiwi-games] game.result TAGMSG failed', err);
        return false;
    }
    return false;
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

    const salon = getManagementSalon();
    if (!salon || !game) return;

    const net = network || (kiwi.state.getActiveNetwork && kiwi.state.getActiveNetwork());
    const irc = net && net.ircClient;
    if (!irc) return;

    const payload = {
        op: 'game.result',
        game,
        players: players.slice(),
        winner,
    };
    sendTagmsg(irc, salon, { [GM_TAG]: encodeJsonBase64Url(payload) });
}
