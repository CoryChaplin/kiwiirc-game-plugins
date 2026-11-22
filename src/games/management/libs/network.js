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

export function addCurrentBufferMessage(message) {
    if (!message) return;
    const buffer = kiwi.state && typeof kiwi.state.getActiveBuffer === 'function'
        ? kiwi.state.getActiveBuffer()
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
