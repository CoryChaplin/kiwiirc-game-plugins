/* global kiwi:true, require,
    __KIWI_BUILD_GAME_TICTACTOE__,
    __KIWI_BUILD_GAME_CONNECTFOUR__,
    __KIWI_BUILD_GAME_PICTIONARY__,
    __KIWI_BUILD_GAME_BATTLESHIP__,
    __KIWI_BUILD_GAME_CHESS__
*/
import GamesDropdown from './games/shared/components/GamesDropdown.vue';
import Locales, { getPluginBasePath } from './games/shared/locales.js';
import { BUILD_GAMES } from './build-features.js';

/**
 * Unified Kiwi IRC plugin bundling games selected at build time.
 *
 * Build (what ends up in the bundle) — build.config.json or CLI:
 *   yarn build
 *   yarn build --env exclude=chess,pictionary
 *   yarn build --env config=./build.custom.json
 *
 * Runtime (KiwiIRC config.json), among games already compiled in:
 *   "plugin_kiwi_games": {
 *     "tictactoe":   { "enabled": true, "button": true, "command": true },
 *     "connectfour": { "enabled": true, "button": true, "command": true },
 *     "pictionary":  { "enabled": true, "button": true, "command": true }
 *   }
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

kiwi.plugin('kiwi-games', function(kiwi) {
    const settings = (kiwi.state.settings && kiwi.state.settings['plugin_kiwi_games']) || {};

    const localesPath = settings.localesPath || defaultLocalesPath;
    new Locales().init(localesPath, 'kiwi-games', 'ttt_title');

    const defaultGameCfg = { enabled: true, button: true, command: true };
    let anyEnabled = false;

    Object.keys(gameInits).forEach((id) => {
        const cfg = { ...defaultGameCfg, ...(settings[id] || {}) };
        if (!cfg.enabled) return;
        gameInits[id](kiwi, cfg);
        anyEnabled = true;
    });

    // Safety net: if the build included no games, do not show the dropdown
    const anyBuilt = Object.keys(BUILD_GAMES).some((id) => BUILD_GAMES[id]);
    if (anyEnabled && anyBuilt) {
        kiwi.addUi('header_query', GamesDropdown);
    }
});
