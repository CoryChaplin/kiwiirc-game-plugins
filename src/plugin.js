import { init as initTictactoe } from './games/tictactoe/index.js';
import { init as initConnectFour } from './games/connectfour/index.js';
import { init as initPictionary } from '../Pictionary/src/index.js';

/**
 * Plugin Kiwi IRC unifié regroupant tous les jeux.
 *
 * Configuration (dans config.json de KiwiIRC) :
 *
 *   "plugin_kiwi_games": {
 *     "tictactoe":   { "enabled": true, "button": true,  "command": false },
 *     "connectfour": { "enabled": true, "button": true,  "command": false },
 *     "pictionary":  { "enabled": true, "button": true,  "command": true  }
 *   }
 *
 * Chaque clé de jeu accepte :
 *   - enabled (bool) : active ou désactive le jeu (défaut : true)
 *   - button  (bool) : affiche le bouton dans le header de query (défaut : true)
 *   - command (bool) : enregistre une commande IRC /tictactoe|connectfour|pictionary <nick>
 */

// eslint-disable-next-line no-undef
kiwi.plugin('kiwi-games', function(kiwi) {
    const settings = (kiwi.state.settings && kiwi.state.settings['plugin_kiwi_games']) || {};

    const defaults = {
        tictactoe:   { enabled: true, button: true,  command: false },
        connectfour: { enabled: true, button: true,  command: false },
        pictionary:  { enabled: true, button: true,  command: true  },
    };

    const cfg = {
        tictactoe:   { ...defaults.tictactoe,   ...(settings.tictactoe   || {}) },
        connectfour: { ...defaults.connectfour, ...(settings.connectfour || {}) },
        pictionary:  { ...defaults.pictionary,  ...(settings.pictionary  || {}) },
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
});
