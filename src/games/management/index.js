import { setConfig } from './libs/config.js';
import { defaultConfig } from './libs/constants.js';
import { GmClient } from './libs/gm-client.js';
import { initGameStore } from './libs/game-store.js';
import { activateManagementSalon } from '../shared/reportGameResult.js';
import HeaderGamesButton from './components/HeaderGamesButton.vue';

/**
 * Lobby / queue management sub-plugin (requires a gameMaster bot).
 * Opt-in at build time: yarn build --env include=management
 */
export function init(kiwi, config) {
    const cfg = { ...defaultConfig, ...config };
    setConfig(cfg);
    activateManagementSalon(cfg.salon);

    const client = new GmClient();
    client.bind();
    const store = initGameStore(client);
    client.setSalonUpdateHandler((network) => {
        store.refresh(network);
    });
    client.setSalonEventHandler((network, event, payload) => {
        store.handleSalonEvent(network, event, payload);
    });
    client.setPushHandler((payload, network) => {
        store.handlePush(payload, network);
    });

    kiwi.on('plugin-kiwi-games.game-started', (ev) => {
        const net = (ev && ev.network)
            || (kiwi.state.getActiveNetwork && kiwi.state.getActiveNetwork());
        if (net) store.refresh(net);
    });

    if (cfg.button !== false && typeof kiwi.addUi === 'function') {
        kiwi.addUi('header_channel', HeaderGamesButton);
    }
}
