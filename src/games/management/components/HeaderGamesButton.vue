<template>
    <div
        :class="{
            'kiwi-header-option--active': isActive,
            'kiwi-header-option-games--hidden': !showButton,
        }"
        class="kiwi-header-option-games"
    >
        <a
            :title="$t('kiwi-games:mgmt_button_title')"
            href="#"
            @click.prevent="onClick"
        ><span class="kiwi-header-option-games-icon" aria-hidden="true">🎮</span></a>
    </div>
</template>

<script>
/* global kiwi:true */
import { SIDEBAR_PLUGIN_ID } from '../libs/constants.js';
import { getConfig } from '../libs/config.js';
import { getGameStore } from '../libs/game-store.js';
import { channelNamesMatch } from '../libs/network.js';
import GamesSidebar from './GamesSidebar.vue';

export default {
    props: {
        buffer: { type: Object, default: null },
        network: { type: Object, default: null },
        sidebarState: { type: Object, default: null },
    },
    computed: {
        showButton() {
            const buffer = this.buffer;
            const network = this.network;
            if (!buffer || !network) return false;
            if (typeof buffer.isChannel === 'function' && !buffer.isChannel()) return false;
            return channelNamesMatch(
                buffer.name,
                getConfig().salon,
                network.ircClient && network.ircClient.caseCompare,
            );
        },
        isActive() {
            const sb = this.sidebarState;
            if (!sb || sb.sidebarSection !== 'component') return false;
            const props = sb.activeComponentProps;
            return !!(props && props.pluginId === SIDEBAR_PLUGIN_ID);
        },
    },
    watch: {
        showButton(visible) {
            if (!visible) this.closeGamesPanel();
        },
    },
    beforeDestroy() {
        this.closeGamesPanel();
    },
    methods: {
        closeGamesPanel() {
            if (!this.isActive) return;
            const sb = this.sidebarState;
            if (sb && typeof sb.close === 'function') {
                sb.close();
                return;
            }
            if (typeof kiwi.showInSidebar === 'function') {
                kiwi.showInSidebar(null);
            }
        },
        onClick(event) {
            if (event && typeof event.stopPropagation === 'function') {
                event.stopPropagation();
            }

            const sb = this.sidebarState;
            if (!kiwi.showInSidebar || !sb) return;

            if (this.isActive) {
                this.closeGamesPanel();
                return;
            }

            kiwi.showInSidebar(GamesSidebar, { pluginId: SIDEBAR_PLUGIN_ID });
            getGameStore().refresh(this.network);
        },
    },
};
</script>

<style>
.kiwi-header-option.kiwi-header-option-games--hidden {
    display: none !important;
}

.kiwi-header-option-games a {
    font-size: inherit;
    line-height: 43px;
    min-width: 38px;
    padding: 0 10px;
}

.kiwi-header-option-games a .kiwi-header-option-games-icon {
    font-size: 1.4em;
    line-height: 43px;
    display: block;
}
</style>
