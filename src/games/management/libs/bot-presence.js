/* global kiwi:true */
import { nicksMatch } from './network.js';

const ISON_TIMEOUT_MS = 15000;
const CACHE_ONLINE_MS = 20000;
const CACHE_OFFLINE_MS = 10000;

const cache = new Map();
const inflight = new Map();

function cacheKey(network, botNick) {
    const netId = network && network.id != null ? String(network.id) : '';
    return netId + '|' + String(botNick || '').toLowerCase();
}

function readCache(key) {
    const row = cache.get(key);
    if (!row) return null;
    if (Date.now() > row.until) {
        cache.delete(key);
        return null;
    }
    return row.online;
}

function writeCache(key, online, ttl) {
    cache.set(key, { online: Boolean(online), until: Date.now() + ttl });
}

export function markGameMasterOnline(network, botNick) {
    if (!botNick) return;
    writeCache(cacheKey(network, botNick), true, CACHE_ONLINE_MS);
}

export function markGameMasterOffline(network, botNick) {
    if (!botNick) return;
    writeCache(cacheKey(network, botNick), false, CACHE_OFFLINE_MS);
}

function nicksFromIsonEvent(event) {
    if (!event) return [];
    if (Array.isArray(event.nicks)) return event.nicks.filter(Boolean);
    const params = event.params || (event.event && event.event.params);
    if (Array.isArray(params) && params.length) {
        const last = params[params.length - 1];
        if (typeof last === 'string') {
            return last.trim() ? last.trim().split(/\s+/) : [];
        }
    }
    return [];
}

function sendIson(irc, botNick) {
    if (typeof irc.raw === 'function') {
        irc.raw('ISON', botNick);
        return;
    }
    if (typeof irc.write === 'function') {
        irc.write('ISON ' + botNick);
    }
}

const isonWaiters = new Set();
let isonListenersBound = false;

function detachWaiter(waiter) {
    isonWaiters.delete(waiter);
    if (waiter.timer) clearTimeout(waiter.timer);
}

function onIsonReply(event, network) {
    const nicks = nicksFromIsonEvent(event);
    let matched = false;
    isonWaiters.forEach((waiter) => {
        if (network && waiter.network && network.id !== waiter.network.id) return;
        const irc = waiter.network && waiter.network.ircClient;
        if (nicks.some((nick) => nicksMatch(nick, waiter.botNick, irc))) {
            matched = true;
            waiter.resolve(true);
            detachWaiter(waiter);
            return;
        }
        if (nicks.length === 0) {
            waiter.resolve(false);
            detachWaiter(waiter);
        }
    });
    if (!matched && network && nicks.length) {
        nicks.forEach((nick) => markGameMasterOnline(network, nick));
    }
}

function bindIsonListeners() {
    if (isonListenersBound || !kiwi || typeof kiwi.on !== 'function') return;
    isonListenersBound = true;
    kiwi.on('irc.users online', onIsonReply);
}

function probeIson(network, botNick) {
    const irc = network && network.ircClient;
    if (!irc) return Promise.resolve(false);

    bindIsonListeners();

    return new Promise((resolve) => {
        const waiter = {
            network,
            botNick,
            resolve: (online) => {
                waiter.resolve = () => {};
                resolve(Boolean(online));
            },
            timer: null,
        };
        waiter.timer = setTimeout(() => {
            waiter.resolve(false);
            detachWaiter(waiter);
        }, ISON_TIMEOUT_MS);
        isonWaiters.add(waiter);
        sendIson(irc, botNick);
    });
}

/**
 * True if gameMaster is online. ISON only: TAGMSG is sent to the bot nick.
 * Results are cached so we do not ISON on every click.
 */
export function ensureGameMasterOnline(network, botNick) {
    const nick = typeof botNick === 'string' ? botNick.trim() : '';
    if (!network || !nick) return Promise.resolve(false);

    const key = cacheKey(network, nick);
    const cached = readCache(key);
    if (cached != null) return Promise.resolve(cached);

    const pending = inflight.get(key);
    if (pending) return pending;

    const probe = probeIson(network, nick).then((online) => {
        writeCache(key, online, online ? CACHE_ONLINE_MS : CACHE_OFFLINE_MS);
        inflight.delete(key);
        return online;
    }).catch(() => {
        writeCache(key, false, CACHE_OFFLINE_MS);
        inflight.delete(key);
        return false;
    });

    inflight.set(key, probe);
    return probe;
}
