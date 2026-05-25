const DEFAULT_FEEDBACK_CHANNEL = '#beta';
const MAX_COMMENT_LENGTH = 400;

export function sanitizeFeedbackText(text) {
    const raw = typeof text === 'string' ? text : '';
    return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_COMMENT_LENGTH);
}

export function submitGameFeedback(network, gameLabel, rating, comment, channel = DEFAULT_FEEDBACK_CHANNEL) {
    if (!network || !network.ircClient || typeof network.ircClient.raw !== 'function') {
        return false;
    }
    const safeRating = Math.max(1, Math.min(5, Math.floor(Number(rating) || 5)));
    const safeComment = sanitizeFeedbackText(comment) || '-';
    const stars = `${'\u2605'.repeat(safeRating)}${'\u2606'.repeat(5 - safeRating)}`;
    const label = String(gameLabel || 'Game').trim() || 'Game';
    const payload = `[${label}] ${stars} (${safeRating}/5) - Desktop - Commentaire : ${safeComment}]`;
    try {
        network.ircClient.raw(`PRIVMSG ${channel} :${payload}`);
        return true;
    } catch (_) {
        return false;
    }
}
