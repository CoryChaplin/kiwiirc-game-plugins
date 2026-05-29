import { init as initTictactoe } from './games/tictactoe/index.js';
import { init as initConnectFour } from './games/connectfour/index.js';
import { init as initPictionary } from './games/pictionary/index.js';
import { init as initBattleship } from './games/battleship/index.js';
import { init as initChess } from './games/chess/index.js';
import GamesDropdown from './games/shared/components/GamesDropdown.vue';
import Locales, { getPluginBasePath } from './games/shared/locales.js';

/**
 * Plugin Kiwi IRC unifié regroupant tous les jeux.
 *
 * Configuration (dans config.json de KiwiIRC) :
 *
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

// eslint-disable-next-line no-undef
kiwi.plugin('kiwi-games', function(kiwi) {
    const settings = (kiwi.state.settings && kiwi.state.settings['plugin_kiwi_games']) || {};

    const localesPath = settings.localesPath || defaultLocalesPath;
    new Locales().init(localesPath, 'kiwi-games', 'ttt_title');

    const defaults = {
        tictactoe:   { enabled: true, button: true, command: true },
        connectfour: { enabled: true, button: true, command: true },
        pictionary:  { enabled: true, button: true, command: true },
        battleship:  { enabled: true, button: true, command: true },
        chess:       { enabled: true, button: true, command: true },
    };

    const cfg = {
        tictactoe:   { ...defaults.tictactoe,   ...(settings.tictactoe   || {}) },
        connectfour: { ...defaults.connectfour, ...(settings.connectfour || {}) },
        pictionary:  { ...defaults.pictionary,  ...(settings.pictionary  || {}) },
        battleship:  { ...defaults.battleship,  ...(settings.battleship  || {}) },
        chess:       { ...defaults.chess,       ...(settings.chess       || {}) },
    };

    if (cfg.tictactoe.enabled) {
        initTictactoe(kiwi, cfg.tictactoe);
    }
    if (cfg.connectfour.enabled) {
        initConnectFour(kiwi, cfg.connectfour);
    }
    if (cfg.pictionary.enabled) {
        initPictionary(kiwi, cfg.pictionary);
    }
    if (cfg.battleship.enabled) {
        initBattleship(kiwi, cfg.battleship);
    }
    if (cfg.chess.enabled) {
        initChess(kiwi, cfg.chess);
    }

    const anyEnabled = cfg.tictactoe.enabled || cfg.connectfour.enabled || cfg.pictionary.enabled || cfg.battleship.enabled || cfg.chess.enabled;
    if (anyEnabled) {
        kiwi.addUi('header_query', GamesDropdown);
    }
});
