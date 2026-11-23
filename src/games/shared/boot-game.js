import { getGameConfig, getPluginSettings } from './pluginConfig.js';
import { markGameReady, takeGameInbox } from './game-bridge.js';

function replayQueued(kiwiApi, gameId, queued) {
    queued.forEach((item) => {
        if (!item) return;
        if (item.type === 'command') {
            kiwiApi.emit(
                'input.command.' + gameId,
                item.event,
                item.command,
                item.params,
                item.context,
            );
            return;
        }
        if (item.type === 'tagmsg') {
            if (item.event) item.event.__kiwiReplay = true;
            kiwiApi.emit('irc.raw.TAGMSG', item.command, item.event, item.network);
        }
    });
}

/**
 * Point d'entrée d'un script de jeu (kiwi-games/<id>.js).
 * Enregistre le jeu auprès de Kiwi, puis rejoue l'invitation ou le TAGMSG
 * qui a déclenché le téléchargement.
 */
export function bootGame(gameId, init) {
    const root = typeof window !== 'undefined' ? window : null;
    if (!root) return;

    const guard = '__kiwiGameBooted_' + gameId;
    if (root[guard]) return;
    root[guard] = true;

    const kiwi = root.kiwi;
    if (!kiwi || typeof kiwi.plugin !== 'function') {
        console.error('[kiwi-games] window.kiwi.plugin indisponible — ' + gameId);
        return;
    }

    kiwi.plugin('kiwi-games-' + gameId, (kiwiApi) => {
        const cfg = getGameConfig(gameId, getPluginSettings());
        let started = false;
        try {
            if (cfg.enabled) {
                init(kiwiApi, cfg);
                started = true;
            }
        } catch (err) {
            console.error('[kiwi-games] init ' + gameId, err);
        }

        const queued = takeGameInbox(gameId);
        markGameReady(gameId);
        if (started) replayQueued(kiwiApi, gameId, queued);
    });
}
