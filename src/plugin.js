/* global kiwi:true, require,
    __KIWI_BUILD_MANAGEMENT__
*/
import GamesDropdown from './games/shared/components/GamesDropdown.vue';
import Locales, { getPluginBasePath } from './games/shared/locales.js';
import { BUILD_GAMES } from './build-features.js';
import { coerceBool, getGameConfig, getPluginSettings } from './games/shared/pluginConfig.js';
import { installGameLoader } from './games/shared/game-loader.js';

/**
 * Plugin Kiwi IRC : menu pour lancer les jeux, et management si le build l'inclut.
 * Le script de chaque jeu (dist/kiwi-games/<jeu>.js) n'est téléchargé que lorsque
 * l'utilisateur invite, rejoint une file, crée ou rejoint un lobby, ou reçoit un TAGMSG.
 *
 * Build (ce qui est compilé) — build.config.json ou CLI :
 *   yarn build
 *   yarn build --env exclude=chess,pictionary
 *   yarn build --env include=management
 *   yarn build --env config=./build.custom.json
 *
 * Runtime (KiwiIRC config.json), parmi les modules déjà compilés :
 *   "plugin_kiwi_games": {
 *     "gamesPath": "https://example/plugins/kiwi-games",
 *     "tictactoe":   { "enabled": true, "button": true, "command": true },
 *     "management":  { "enabled": true, "button": true, "gameMasterNick": "gameMaster" }
 *   }
 * Also accepted (Kiwi convention = plugin name): "kiwi-games": { ... }
 *
 * Chaque clé de jeu accepte :
 *   - enabled (bool) : active ou désactive le jeu (défaut : true)
 *   - button  (bool) : affiche le bouton dans le header de query (défaut : true)
 *   - command (bool) : enregistre une commande IRC /tictactoe|connectfour|pictionary <nick>
 * gamesPath (string) : dossier des scripts de jeu, sans slash final.
 *   Défaut : dossier de plugin-kiwi-games.js + "kiwi-games".
 */

// Résolu à l'évaluation du module (script principal en cours d'exécution),
// pas plus tard : un script de jeu injecté ensuite ne doit pas fausser ce chemin.
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
