/* global kiwi:true */
import { incrementUnread } from '../../shared/Utils.js';

export function normalizeChannelName(name) {
    return (name || '').trim().toLowerCase();
}

export function channelNamesMatch(a, b, caseCompare) {
    if (!a || !b) return false;
    if (typeof caseCompare === 'function') {
        try {
            return caseCompare(a, b);
        } catch (_) {
            // fall through
        }
    }
    return normalizeChannelName(a) === normalizeChannelName(b);
}

export function nicksMatch(a, b, irc) {
    if (!a || !b) return false;
    const caseCompare = irc && irc.caseCompare;
    if (typeof caseCompare === 'function') {
        try {
            return caseCompare(a, b);
        } catch (_) {
            // fall through
        }
    }
    return String(a).toLowerCase() === String(b).toLowerCase();
}

export function addChannelSystemMessage(network, channel, message) {
    if (!network || !channel || !message) return;
    const getBuffer = kiwi.state && kiwi.state.getBufferByName;
    const buffer = typeof getBuffer === 'function'
        ? getBuffer.call(kiwi.state, network.id, channel)
        : null;
    if (!buffer) return;
    kiwi.state.addMessage(buffer, { nick: '*', message, type: 'message' });
    incrementUnread(buffer);
}

export function isIdentified(network) {
    const account = (network && network.ircClient && network.ircClient.user && network.ircClient.user.account)
        || (network && typeof network.currentUser === 'function' && network.currentUser() && network.currentUser().account);
    return typeof account === 'string' && account.length > 0;
}
