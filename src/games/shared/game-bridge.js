/**
 * State shared by the main script and the game scripts.
 * Each webpack bundle has its own copy of this module: the state lives on
 * window so the loader and the downloaded script see the same queue.
 */

const KEY = '__kiwiGamesBridge';

function rootObject() {
    if (typeof window !== 'undefined') return window;
    return globalThis;
}

function bridge() {
    const root = rootObject();
    if (!root[KEY]) {
        root[KEY] = {
            ready: Object.create(null),
            inbox: Object.create(null),
            loading: Object.create(null),
            waiters: Object.create(null),
            loadErrors: Object.create(null),
            gamesRoot: '',
        };
    }
    return root[KEY];
}

export function setGamesRoot(url) {
    bridge().gamesRoot = url || '';
}

export function getGamesRoot() {
    return bridge().gamesRoot || '';
}

export function isGameReady(gameId) {
    return !!bridge().ready[gameId];
}

export function markGameReady(gameId) {
    const state = bridge();
    state.ready[gameId] = true;
    const waiters = state.waiters[gameId] || [];
    state.waiters[gameId] = [];
    waiters.forEach((fn) => {
        try {
            fn();
        } catch (_) {}
    });
}

export function onGameReady(gameId, fn) {
    if (isGameReady(gameId)) {
        fn();
        return;
    }
    const state = bridge();
    if (!state.waiters[gameId]) state.waiters[gameId] = [];
    state.waiters[gameId].push(fn);
}

export function enqueueGameEvent(gameId, item) {
    const state = bridge();
    if (!state.inbox[gameId]) state.inbox[gameId] = [];
    state.inbox[gameId].push(item);
}

export function takeGameInbox(gameId) {
    const state = bridge();
    const items = state.inbox[gameId] || [];
    state.inbox[gameId] = [];
    return items;
}

export function getLoading(gameId) {
    return bridge().loading[gameId] || null;
}

export function setLoading(gameId, promise) {
    const state = bridge();
    if (promise) state.loading[gameId] = promise;
    else delete state.loading[gameId];
}

export function hasReportedLoadError(gameId) {
    return !!bridge().loadErrors[gameId];
}

export function markLoadError(gameId) {
    bridge().loadErrors[gameId] = true;
}
