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
            :aria-label="$t('kiwi-games:mgmt_button_title')"
            role="button"
            tabindex="0"
            @click.prevent="onClick"
            @keydown.enter.space.prevent="onClick"
        ><i class="kiwi-header-option-games-icon" aria-hidden="true">🎮</i></a>
    </div>
</template>

<script>
/* global kiwi:true */
import { SIDEBAR_PLUGIN_ID } from '../libs/constants.js';
import { getGameStore } from '../libs/game-store.js';
import { channelNamesMatch } from '../libs/network.js';
import { botSharesChannel } from '../libs/bot-channels.js';
import GamesSidebar from './GamesSidebar.vue';

function networkForBuffer(buffer, fallbackNetwork) {
    if (buffer && typeof buffer.getNetwork === 'function') {
        const net = buffer.getNetwork();
        if (net) return net;
    }
    const id = buffer && (buffer.networkid != null ? buffer.networkid : buffer.networkId);
    if (id != null && kiwi.state && typeof kiwi.state.getNetwork === 'function') {
        const net = kiwi.state.getNetwork(id);
        if (net) return net;
    }
    return fallbackNetwork;
}

function activeBufferHasBot(fallbackNetwork) {
    const active = kiwi.state && kiwi.state.getActiveBuffer && kiwi.state.getActiveBuffer();
    if (!active) return false;
    if (typeof active.isChannel === 'function' && !active.isChannel()) return false;
    return botSharesChannel(networkForBuffer(active, fallbackNetwork), active.name);
}

function closeSidebar(sidebarState) {
    if (sidebarState && typeof sidebarState.close === 'function') {
        sidebarState.close();
        return;
    }
    if (typeof kiwi.showInSidebar === 'function') {
        kiwi.showInSidebar(null);
    }
}

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
            if (!buffer) return false;
            if (typeof buffer.isChannel === 'function' && !buffer.isChannel()) return false;
            if (!network) return false;
            return botSharesChannel(network, buffer.name);
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
            if (!visible && this.isActiveBuffer()) this.closeGamesPanel();
        },
    },
    beforeDestroy() {
        if (!this.isActive) return;
        const network = this.network;
        const sidebarState = this.sidebarState;
        setTimeout(() => {
            if (activeBufferHasBot(network)) return;
            closeSidebar(sidebarState);
        }, 0);
    },
    methods: {
        isActiveBuffer() {
            const active = kiwi.state && kiwi.state.getActiveBuffer && kiwi.state.getActiveBuffer();
            if (!active || !this.buffer) return false;
            if (active === this.buffer) return true;
            const cmp = this.network && this.network.ircClient && this.network.ircClient.caseCompare;
            return channelNamesMatch(active.name, this.buffer.name, cmp);
        },
        closeGamesPanel() {
            if (!this.isActive) return;
            closeSidebar(this.sidebarState);
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

/* The emoji takes the size of the native header icons; an <i> keeps it visible where the
   theme hides header labels (<span>) on narrow screens. */
.kiwi-header-option-games-icon {
    font-style: normal;
}
</style>
