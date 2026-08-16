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

export function isIdentified(network) {
    const account = (network && network.ircClient && network.ircClient.user && network.ircClient.user.account)
        || (network && typeof network.currentUser === 'function' && network.currentUser() && network.currentUser().account);
    return typeof account === 'string' && account.length > 0;
}
