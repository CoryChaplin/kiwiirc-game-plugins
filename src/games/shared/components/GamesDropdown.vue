<template>
    <div><div v-if="showButton">
        <a title="Jeux" class="games-dropdown-button" @click="toggleDropdown">🎮</a>
        <ul
            v-if="open"
            class="games-dropdown-menu"
            :style="{ top: menuTop + 'px', right: menuRight + 'px' }"
        >
            <li
                v-for="game in enabledGames"
                :key="game.id"
                class="games-dropdown-item"
                @click="launchGame(game.id)"
            >
                <i class="games-dropdown-item__icon" v-html="game.icon"></i>{{ game.label }}
            </li>
        </ul>
    </div></div>
</template>

<script>
/* global kiwi:true */

const tttSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">'
    + '<line x1="8" y1="2" x2="8" y2="22"/><line x1="16" y1="2" x2="16" y2="22"/>'
    + '<line x1="2" y1="8" x2="22" y2="8"/><line x1="2" y1="16" x2="22" y2="16"/>'
    + '<line x1="1.5" y1="1.5" x2="6" y2="6"/><line x1="6" y1="1.5" x2="1.5" y2="6"/>'
    + '<circle cx="12" cy="12" r="1.8"/>'
    + '<line x1="18" y1="18" x2="22.5" y2="22.5"/><line x1="22.5" y1="18" x2="18" y2="22.5"/>'
    + '</svg>';

const c4Svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">'
    + '<circle cx="6" cy="18" r="2.5" fill="currentColor"/>'
    + '<circle cx="10" cy="14" r="2.5" fill="currentColor"/>'
    + '<circle cx="14" cy="10" r="2.5" fill="currentColor"/>'
    + '<circle cx="18" cy="6" r="2.5" fill="currentColor"/>'
    + '</svg>';

const GAME_DEFS = [
    { id: 'connectfour', label: 'Puissance 4', icon: c4Svg },
    { id: 'tictactoe',   label: 'Morpion',     icon: tttSvg },
    { id: 'pictionary',  label: 'Pictionary',   icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M5.6 11.6l-1.2-1.2c-0.8-0.2-2-0.1-2.7 1-0.8 1.1-0.3 2.8-1.7 4.6 0 0 3.5 0 4.8-1.3 1.2-1.2 1.2-2.2 1-3l-0.2-0.1z"/><path d="M5.8 8.1c-0.2 0.3-0.5 0.7-0.7 1 0 0.2-0.1 0.3-0.2 0.4l1.5 1.5c0.1-0.1 0.3-0.2 0.4-0.3 0.3-0.2 0.7-0.4 1-0.7 0.4 0 0.6-0.2 0.8-0.4l-2.2-2.2c-0.2 0.2-0.4 0.4-0.6 0.7z"/><path d="M15.8 0.2c-0.3-0.3-0.7-0.3-1-0.1 0 0-3 2.5-5.9 5.1-0.4 0.4-0.7 0.7-1.1 1-0.2 0.2-0.4 0.4-0.6 0.5l2.1 2.1c0.2-0.2 0.4-0.4 0.5-0.7 0.3-0.4 0.6-0.7 0.9-1.1 2.5-3 5.1-5.9 5.1-5.9 0.3-0.2 0.3-0.6 0-0.9z"/></svg>' },
];

export default {
    data() {
        return { open: false, count: 0, menuTop: 0, menuRight: 0 };
    },
    computed: {
        showButton() {
            // eslint-disable-next-line no-unused-expressions
            this.count;

            /* eslint-disable no-undef */
            let buffer = kiwi.state.getActiveBuffer();
            let network = kiwi.state.getActiveNetwork();
            /* eslint-enable no-undef */

            if (!buffer || !network) return false;
            if (network.nick === buffer.name) return false;
            return true;
        },
        enabledGames() {
            const settings = (kiwi.state.settings && kiwi.state.settings['plugin_kiwi_games']) || {};
            return GAME_DEFS.filter(({ id }) => {
                const cfg = settings[id] || {};
                return cfg.enabled !== false && cfg.button !== false;
            });
        },
    },
    mounted() {
        this.listen(kiwi, 'plugin-kiwi-games.update-button', () => {
            this.count++;
        });
        this._closeOnOutside = (e) => {
            if (this.open && !this.$el.contains(e.target)) {
                this.open = false;
            }
        };
        document.addEventListener('click', this._closeOnOutside, true);
    },
    beforeDestroy() {
        document.removeEventListener('click', this._closeOnOutside, true);
    },
    methods: {
        toggleDropdown(event) {
            if (this.open) {
                this.open = false;
                return;
            }
            const rect = event.currentTarget.getBoundingClientRect();
            this.menuTop = rect.bottom + 4;
            this.menuRight = window.innerWidth - rect.right;
            this.open = true;
        },
        launchGame(gameId) {
            this.open = false;
            /* eslint-disable no-undef */
            const buffer = kiwi.state.getActiveBuffer();
            const network = kiwi.state.getActiveNetwork();
            /* eslint-enable no-undef */
            if (!network || !buffer) return;
            const evt = { handled: false, params: [buffer.name] };
            const ctx = { network, buffer };
            kiwi.emit(`input.command.${gameId}`, evt, gameId, buffer.name, ctx);
        },
    },
};
</script>

<style>
.games-dropdown-button {
    font-size: 20px;
    padding: 0 5px;
}

.games-dropdown-menu {
    position: fixed;
    z-index: 9999;
    list-style: none;
    margin: 0;
    padding: 4px 0;
    background: var(--brand-default-bg, #fff);
    color: var(--brand-default-fg, #333);
    border: 1px solid var(--comp-border, #ccc);
    border-radius: 4px;
    box-shadow: 0 2px 8px var(--brand-shadow, rgba(0, 0, 0, 0.15));
    min-width: 150px;
    /* Absolute size to escape font-size: 0.8em inherited header */
    font-size: 14px;
    font-weight: normal;
}

/* Caret pointing up toward the trigger button */
.games-dropdown-menu::before,
.games-dropdown-menu::after {
    content: '';
    position: absolute;
    right: 10px;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
}
.games-dropdown-menu::before {
    top: -7px;
    border-bottom: 7px solid var(--comp-border, #ccc);
}
.games-dropdown-menu::after {
    top: -6px;
    border-bottom: 6px solid var(--brand-default-bg, #fff);
}

.games-dropdown-item {
    display: flex;
    align-items: center;
    padding: 7px 14px;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s;
}

.games-dropdown-item:hover {
    background: var(--comp-header-bg, #eee);
}

.games-dropdown-item__icon {
    width: 24px;
    height: 24px;
    margin-right: 8px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    line-height: 1;
}

.games-dropdown-item__icon svg {
    width: 24px;
    height: 24px;
}
</style>
