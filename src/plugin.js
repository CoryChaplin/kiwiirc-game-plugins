/* global kiwi:true, require,
    __KIWI_BUILD_MANAGEMENT__
*/
import GamesDropdown from './games/shared/components/GamesDropdown.vue';
import Locales, { getPluginBasePath } from './games/shared/locales.js';
import { BUILD_GAMES } from './build-features.js';
import { coerceBool, getGameConfig, getPluginSettings } from './games/shared/pluginConfig.js';
import { installGameLoader } from './games/shared/game-loader.js';

/**
 * Kiwi IRC plugin: menu to start games, plus management when the build includes it.
 * Each game script (dist/kiwi-games/<game>.js) is downloaded only when
 * the user invites, joins a queue, creates or joins a lobby, or receives a TAGMSG.
 *
 * Build (what gets compiled) — build.config.json or CLI:
 *   yarn build
 *   yarn build --env exclude=chess,pictionary
 *   yarn build --env include=management
 *   yarn build --env config=./build.custom.json
 *
 * Runtime (KiwiIRC config.json), among modules already compiled:
 *   "plugin_kiwi_games": {
 *     "gamesPath": "https://example/plugins/kiwi-games",
 *     "tictactoe":   { "enabled": true, "button": true, "command": true },
 *     "management":  { "enabled": true, "button": true, "gameMasterNick": "gameMaster" }
 *   }
 * Also accepted (Kiwi convention = plugin name): "kiwi-games": { ... }
 *
 * Each game key accepts:
 *   - enabled (bool): turn the game on or off (default: true)
 *   - button  (bool): show the button in the query header (default: true)
 *   - command (bool): register /tictactoe|connectfour|pictionary <nick>
 * gamesPath (string): folder of game scripts, no trailing slash.
 *   Default: folder of plugin-kiwi-games.js + "kiwi-games".
 */

// Resolved when this module is evaluated (the main script is running),
// not later: a game script injected afterwards must not change this path.
const pluginBasePath = getPluginBasePath();
const defaultLocalesPath = pluginBasePath + 'kiwi-games/locales';
const defaultGamesRoot = pluginBasePath + 'kiwi-games';

let initManagement = null;
if (__KIWI_BUILD_MANAGEMENT__) {
    initManagement = require('./games/management/index.js').init;
}

kiwi.plugin('kiwi-games', function (kiwi) {
    const settings = getPluginSettings();

    const localesPath = settings.localesPath || defaultLocalesPath;
    new Locales().init(localesPath, 'kiwi-games', 'ttt_title');

    const configuredGamesPath = typeof settings.gamesPath === 'string'
        ? settings.gamesPath.trim()
        : '';
    const gamesRoot = (configuredGamesPath || defaultGamesRoot).replace(/\/+$/, '');
    installGameLoader(kiwi, { gamesRoot });

    if (initManagement) {
        const mgmtDefaults = {
            enabled: true,
            button: true,
            gameMasterNick: 'gameMaster',
            requestTimeoutMs: 8000,
        };
        const mgmtRaw = settings.management;
        const mgmtCfg = {
            ...mgmtDefaults,
            ...(mgmtRaw && typeof mgmtRaw === 'object' ? mgmtRaw : {}),
        };
        mgmtCfg.enabled = coerceBool(mgmtCfg.enabled, true);
        mgmtCfg.button = coerceBool(mgmtCfg.button, true);
        if (typeof mgmtCfg.gameMasterNick === 'string') {
            mgmtCfg.gameMasterNick = mgmtCfg.gameMasterNick.trim();
        } else {
            mgmtCfg.gameMasterNick = '';
        }
        if (mgmtRaw === false) mgmtCfg.enabled = false;
        if (mgmtCfg.enabled && mgmtCfg.gameMasterNick) {
            initManagement(kiwi, mgmtCfg);
        }
    }

    const anyGameEnabled = Object.keys(BUILD_GAMES).some((id) => (
        BUILD_GAMES[id] && getGameConfig(id, settings).enabled
    ));
    if (anyGameEnabled) {
        kiwi.addUi('header_query', GamesDropdown);
    }
});
