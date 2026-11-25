/**
 * Proxy that resolves `kiwi` from window.kiwi at call time.
 * Used by webpack ProvidePlugin in development (no real Kiwi IRC).
 * In production, KiwiIRC sets window.kiwi before loading plugins.
 */
function getKiwi() {
    if (typeof window === 'undefined') return undefined;
    return window.kiwi;
}

module.exports = new Proxy({}, {
    get(_, prop) {
        const k = getKiwi();
        return k && k[prop];
    },
});
