/* global kiwi:true */
import { BUILD_GAMES } from '../../build-features.js';
import { t } from './locales.js';
import { isGameEnabled, getGameConfig } from './pluginConfig.js';
import {
    enqueueGameEvent,
    getGamesRoot,
    getLoading,
    hasReportedLoadError,
    isGameReady,
    markLoadError,
    onGameReady,
    setGamesRoot,
    setLoading,
} from './game-bridge.js';

const GAME_TAGS = {
    tictactoe: '+kiwiirc.com/ttt',
    connectfour: '+kiwiirc.com/c4',
    pictionary: '+kiwiirc.com/pictionary',
    battleship: '+kiwiirc.com/bs',
    chess: '+kiwiirc.com/chess',
};

let installed = false;

function canLoad(gameId) {
    return !!(gameId && BUILD_GAMES[gameId] && isGameEnabled(gameId));
}

function scriptUrl(gameId) {
    const root = getGamesRoot().replace(/\/+$/, '');
    if (!root) return '';
    return root + '/' + gameId + '.js';
}

function gameIdFromEvent(event) {
    const tags = event && event.tags;
    if (!tags) return '';
    const ids = Object.keys(GAME_TAGS);
    for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const raw = tags[GAME_TAGS[id]];
        if (typeof raw === 'string' && raw.charAt(0) === '{') return id;
    }
    return '';
}

function cloneCommandEvent(eventObj, params) {
    const src = eventObj && typeof eventObj === 'object' ? eventObj : {};
    let eventParams = src.params;
    if (!Array.isArray(eventParams)) {
        if (Array.isArray(params)) eventParams = params.slice();
        else if (typeof params === 'string' && params.trim()) eventParams = params.trim().split(/\s+/);
        else eventParams = [];
    }
    return {
        handled: false,
        __kiwiReplay: true,
        params: eventParams,
        input: src.input,
        message: src.message,
    };
}

function reportLoadError(gameId, err) {
    const url = err && err.message ? err.message : '';
    console.error('[kiwi-games] échec du téléchargement (' + gameId + ')', url);
    if (hasReportedLoadError(gameId)) return;
    markLoadError(gameId);
    if (!kiwi || !kiwi.state || typeof kiwi.state.getActiveBuffer !== 'function') return;
    const buffer = kiwi.state.getActiveBuffer();
    if (!buffer || typeof kiwi.state.addMessage !== 'function') return;
    kiwi.state.addMessage(buffer, {
        nick: '*',
        message: t('common_game_load_error'),
        type: 'error',
    });
}

/**
 * Télécharge kiwi-games/<gameId>.js une seule fois.
 * Résout quand le script a appelé markGameReady.
 */
export function loadGame(gameId) {
    if (!canLoad(gameId)) return Promise.resolve(false);
    if (isGameReady(gameId)) return Promise.resolve(true);

    const existing = getLoading(gameId);
    if (existing) return existing;

    const url = scriptUrl(gameId);
    if (!url || typeof document === 'undefined') {
        const failed = Promise.reject(new Error(url || gameId));
        failed.catch(() => {});
        reportLoadError(gameId, new Error(url || 'gamesRoot'));
        return failed;
    }

    const promise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.async = true;
        script.dataset.kiwiGame = gameId;
        script.onload = () => {
            onGameReady(gameId, () => resolve(true));
        };
        script.onerror = () => {
            script.remove();
            setLoading(gameId, null);
            reject(new Error(url));
        };
        document.head.appendChild(script);
    });

    const tracked = promise.catch((err) => {
        reportLoadError(gameId, err);
        return Promise.reject(err);
    });
    setLoading(gameId, tracked);
    return tracked;
}

export function ensureGameLoaded(gameId) {
    return loadGame(gameId).then((ok) => ok !== false).catch(() => false);
}

/**
 * Pose les écouteurs légers : commande d'invitation, TAGMSG entrant.
 * Le script du jeu n'est injecté qu'à ce moment-là.
 */
export function installGameLoader(kiwiApi, options) {
    if (installed) return;
    installed = true;

    const gamesRoot = options && options.gamesRoot;
    setGamesRoot(typeof gamesRoot === 'string' ? gamesRoot : '');

    Object.keys(BUILD_GAMES).forEach((gameId) => {
        if (!BUILD_GAMES[gameId]) return;
        const cfg = getGameConfig(gameId);
        if (!cfg.enabled || !cfg.command) return;

        kiwiApi.on('input.command.' + gameId, (eventObj, command, params, context) => {
            if ((eventObj && eventObj.__kiwiReplay) || isGameReady(gameId)) return;
            if (eventObj && typeof eventObj === 'object') eventObj.handled = true;
            enqueueGameEvent(gameId, {
                type: 'command',
                event: cloneCommandEvent(eventObj, params),
                command,
                params,
                context,
            });
            loadGame(gameId).catch(() => {});
        });
    });

    kiwiApi.on('irc.raw.TAGMSG', (command, event, network) => {
        if (!event || !network || event.nick === network.nick || event.__kiwiReplay) return;
        const gameId = gameIdFromEvent(event);
        if (!canLoad(gameId) || isGameReady(gameId)) return;

        const target = event.params && event.params[0];
        const addressedToUs = target === network.nick;
        // Un TAGMSG de salon (coups de pictionary) ne doit pas faire télécharger
        // le jeu à tout le monde : on ne le met en file que si le chargement a déjà commencé
        // (invitation en message privé).
        if (!addressedToUs && !getLoading(gameId)) return;

        enqueueGameEvent(gameId, {
            type: 'tagmsg',
            command,
            event,
            network,
        });
        if (addressedToUs) loadGame(gameId).catch(() => {});
    });
}
