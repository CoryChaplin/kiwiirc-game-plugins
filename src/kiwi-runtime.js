/**
 * Proxy résolvant `kiwi` depuis window.kiwi au moment de l'exécution.
 * Utilisé par webpack ProvidePlugin en mode développement (sans Kiwi IRC réel).
 * En production, KiwiIRC définit window.kiwi avant de charger les plugins.
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
