/* global kiwi:true */
import { getConfig } from './config.js';
import { channelNamesMatch, nicksMatch } from './network.js';

let state = null;
let started = false;

function getState() {
    if (!state) {
        const initial = { byNetwork: {} };
        const vue = typeof kiwi !== 'undefined' ? kiwi.Vue : null;
        state = vue && vue.observable ? vue.observable(initial) : initial;
    }
    return state;
}

function netKey(network) {
    return network && network.id != null ? String(network.id) : '';
}

function botNick() {
    return String(getConfig().gameMasterNick || '').trim();
}

/**
 * WHOIS channel tokens look like "@#games", "+#lobby" or "!#secret".
 * A "#" or "&" name wins over a status prefix. "+" and "!" are kept
 * when the token is a channel of that type.
 */
function parseWhoisChannelList(raw) {
    const tokens = [];
    if (Array.isArray(raw)) {
        raw.forEach((item) => {
            if (typeof item === 'string') tokens.push(item);
            else if (item && typeof item.channel === 'string') tokens.push(item.channel);
        });
    } else if (typeof raw === 'string') {
        raw.split(/[\s,]+/).forEach((item) => {
            if (item) tokens.push(item);
        });
    }

    const channels = [];
    const seen = new Set();
    tokens.forEach((token) => {
        const name = channelFromWhoisToken(token);
        if (!name) return;
        const id = name.toLowerCase();
        if (seen.has(id)) return;
        seen.add(id);
        channels.push(name);
    });
    return channels;
}

function channelFromWhoisToken(token) {
    const s = String(token || '').trim();
    if (!s) return '';
    const hash = s.indexOf('#');
    if (hash >= 0) return s.slice(hash);
    const amp = s.indexOf('&');
    if (amp >= 0) return s.slice(amp);
    for (let i = 0; i < s.length; i += 1) {
        if (s[i] === '+' || s[i] === '!') return s.slice(i);
    }
    return '';
}

function setChannels(network, channels) {
    const key = netKey(network);
    if (!key) return;
    const next = Array.isArray(channels) ? channels.slice() : [];
    const current = getState();
    const vue = typeof kiwi !== 'undefined' ? kiwi.Vue : null;
    if (vue && typeof vue.set === 'function') {
        vue.set(current.byNetwork, key, next);
    } else {
        current.byNetwork[key] = next;
    }
}

/** True when the connection WHOIS listed this channel for the management bot. */
export function botSharesChannel(network, channelName) {
    if (!network || !channelName) return false;
    const list = getState().byNetwork[netKey(network)] || [];
    const cmp = network.ircClient && network.ircClient.caseCompare;
    return list.some((ch) => channelNamesMatch(ch, channelName, cmp));
}

function onWhois(event, network) {
    const nick = botNick();
    const irc = network && network.ircClient;
    const eventNick = event && event.nick;
    const matched = !!(nick && network && nicksMatch(eventNick, nick, irc));
    if (!matched) return;
    if (event.error) {
        setChannels(network, []);
        return;
    }
    setChannels(network, parseWhoisChannelList(event.channels));
}

function sendWhois(network) {
    const nick = botNick();
    const irc = network && network.ircClient;
    if (!nick || !irc) return;
    try {
        if (typeof irc.whois === 'function') {
            irc.whois(nick, nick);
            return;
        }
        if (typeof irc.raw === 'function') {
            irc.raw('WHOIS', nick, nick);
        }
    } catch (_) {
        // ignore
    }
}

function whoisOnConnect(network) {
    if (!botNick() || !network) return;
    sendWhois(network);
}

function networkFromRegistered(event, network) {
    if (network && network.ircClient) return network;
    if (event && event.network && event.network.ircClient) return event.network;
    return null;
}

/** WHOIS the management bot once at connection and keep its channel list. */
export function startBotChannelTracking() {
    if (started || !kiwi || typeof kiwi.on !== 'function') return;
    started = true;

    kiwi.on('irc.whois', onWhois);
    kiwi.on('irc.registered', (event, network) => {
        const net = networkFromRegistered(event, network);
        if (net) whoisOnConnect(net);
    });

    const networks = kiwi.state && kiwi.state.networks;
    if (!Array.isArray(networks)) return;
    networks.forEach((network) => {
        if (network && network.state === 'connected') whoisOnConnect(network);
    });
}
