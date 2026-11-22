import { setConfig } from './libs/config.js';
import { defaultConfig } from './libs/constants.js';
import { GmClient } from './libs/gm-client.js';
import { initGameStore } from './libs/game-store.js';
import { activateGameMaster, setBotOnlineCheck } from '../shared/reportGameResult.js';
import { ensureGameMasterOnline } from './libs/bot-presence.js';
import { startBotChannelTracking } from './libs/bot-channels.js';
import HeaderGamesButton from './components/HeaderGamesButton.vue';

/**
 * Lobby / queue management sub-plugin (requires a gameMaster bot).
 * Opt-in at build time: yarn build --env include=management
 */
export function init(kiwi, config) {
    const cfg = { ...defaultConfig, ...config };
    setConfig(cfg);
    activateGameMaster(cfg.gameMasterNick);
    setBotOnlineCheck((network, nick) => ensureGameMasterOnline(network, nick));

    startBotChannelTracking();

    const client = new GmClient();
    client.bind();
    const store = initGameStore(client);
    client.setPushHandler((payload, network) => {
        store.handlePush(payload, network);
    });

    if (cfg.button !== false && typeof kiwi.addUi === 'function') {
        kiwi.addUi('header_channel', HeaderGamesButton);
    }
}
