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
 * Entry point of a game script (kiwi-games/<id>.js).
 * Registers the game with Kiwi, then replays the invite or TAGMSG
 * that triggered the download.
 */
export function bootGame(gameId, init) {
    const root = typeof window !== 'undefined' ? window : null;
    if (!root) return;

    const guard = '__kiwiGameBooted_' + gameId;
    if (root[guard]) return;
    root[guard] = true;

    const kiwi = root.kiwi;
    if (!kiwi || typeof kiwi.plugin !== 'function') return;

    kiwi.plugin('kiwi-games-' + gameId, (kiwiApi) => {
        const cfg = getGameConfig(gameId, getPluginSettings());
        let started = false;
        try {
            if (cfg.enabled) {
                init(kiwiApi, cfg);
                started = true;
            }
        } catch (_) {}

        const queued = takeGameInbox(gameId);
        markGameReady(gameId);
        if (started) replayQueued(kiwiApi, gameId, queued);
    });
}
