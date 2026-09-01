/* global kiwi:true, require,
    __KIWI_BUILD_GAME_TICTACTOE__,
    __KIWI_BUILD_GAME_CONNECTFOUR__,
    __KIWI_BUILD_GAME_PICTIONARY__,
    __KIWI_BUILD_GAME_BATTLESHIP__,
    __KIWI_BUILD_GAME_CHESS__,
    __KIWI_BUILD_MANAGEMENT__
*/
import GamesDropdown from './games/shared/components/GamesDropdown.vue';
import Locales, { getPluginBasePath } from './games/shared/locales.js';
import { BUILD_GAMES } from './build-features.js';
import { coerceBool, getGameConfig, getPluginSettings } from './games/shared/pluginConfig.js';

/**
 * Unified Kiwi IRC plugin bundling games (and optional management) selected at build time.
 *
 * Build (what ends up in the bundle) — build.config.json or CLI:
 *   yarn build
 *   yarn build --env exclude=chess,pictionary
 *   yarn build --env include=management
 *   yarn build --env config=./build.custom.json
 *
 * Runtime (KiwiIRC config.json), among modules already compiled in:
 *   "plugin_kiwi_games": {
 *     "tictactoe":   { "enabled": true, "button": true, "command": true },
 *     "management":  { "enabled": true, "button": true, "salon": "#jeux", "gameMasterNick": "gameMaster" }
 *   }
 * Also accepted (Kiwi convention = plugin name): "kiwi-games": { ... }
 *
 * Chaque clé de jeu accepte :
 *   - enabled (bool) : active ou désactive le jeu (défaut : true)
 *   - button  (bool) : affiche le bouton dans le header de query (défaut : true)
 *   - command (bool) : enregistre une commande IRC /tictactoe|connectfour|pictionary <nick>
 */

// IMPORTANT : résolu à l'évaluation du module (au moment où le script
// plugin-kiwi-games.js est parsé), pas dans le callback kiwi.plugin(),
// pour que `scripts[last]` pointe bien sur notre plugin et non sur un
// plugin chargé plus tard.
const defaultLocalesPath = getPluginBasePath() + 'kiwi-games/locales';

const gameInits = {};

if (__KIWI_BUILD_GAME_TICTACTOE__) {
    gameInits.tictactoe = require('./games/tictactoe/index.js').init;
}
if (__KIWI_BUILD_GAME_CONNECTFOUR__) {
    gameInits.connectfour = require('./games/connectfour/index.js').init;
}
if (__KIWI_BUILD_GAME_PICTIONARY__) {
    gameInits.pictionary = require('./games/pictionary/index.js').init;
}
if (__KIWI_BUILD_GAME_BATTLESHIP__) {
    gameInits.battleship = require('./games/battleship/index.js').init;
}
if (__KIWI_BUILD_GAME_CHESS__) {
    gameInits.chess = require('./games/chess/index.js').init;
}

let initManagement = null;
if (__KIWI_BUILD_MANAGEMENT__) {
    initManagement = require('./games/management/index.js').init;
}

kiwi.plugin('kiwi-games', function(kiwi) {
    const settings = getPluginSettings();

    const localesPath = settings.localesPath || defaultLocalesPath;
    new Locales().init(localesPath, 'kiwi-games', 'ttt_title');

    let anyGameEnabled = false;

    Object.keys(gameInits).forEach((id) => {
        const cfg = getGameConfig(id, settings);
        if (!cfg.enabled) return;
        gameInits[id](kiwi, cfg);
        anyGameEnabled = true;
    });

    if (initManagement) {
        const mgmtDefaults = {
            enabled: true,
            button: true,
            salon: '#jeux',
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
        if (typeof mgmtCfg.salon === 'string') {
            mgmtCfg.salon = mgmtCfg.salon.trim();
        } else {
            mgmtCfg.salon = '';
        }
        if (mgmtRaw === false) mgmtCfg.enabled = false;
        if (mgmtCfg.enabled && mgmtCfg.salon) {
            initManagement(kiwi, mgmtCfg);
        }
    }

    // Safety net: if the build included no games, do not show the dropdown
    const anyBuilt = Object.keys(BUILD_GAMES).some((id) => BUILD_GAMES[id]);
    if (anyGameEnabled && anyBuilt) {
        kiwi.addUi('header_query', GamesDropdown);
    }
});
