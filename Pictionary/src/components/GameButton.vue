<template>
    <div class="pict-header-btn-wrap">
        <button
            v-if="showButton"
            class="u-button u-button-primary pict-header-btn"
            title="Play Pictionary"
            @click="buttonClicked"
        >
            <svg
                class="pict-header-btn__icon"
                viewBox="0 0 20 20"
                width="13"
                height="13"
                fill="currentColor"
                aria-hidden="true"
            >
                <path d="M14.7 2.3a1 1 0 0 1 1.4 0l1.6 1.6a1 1 0 0 1 0 1.4l-9.5 9.5-3.5.5.5-3.5 9.5-9.5z" />
                <line x1="12" y1="4" x2="16" y2="8" stroke="currentColor" stroke-width="1" />
                <path d="M2 18 h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
            Pictionary
        </button>
    </div>
</template>

<script>
/* global kiwi:true */

import * as Utils from '../libs/Utils.js';

export default {
    data() {
        return { count: 0 };
    },
    computed: {
        showButton() {
            // count access forces the computed to re-evaluate when the game registry changes
            // eslint-disable-next-line no-unused-expressions
            this.count;

            /* eslint-disable no-undef */
            let buffer = kiwi.state.getActiveBuffer();
            let network = kiwi.state.getActiveNetwork();
            /* eslint-enable no-undef */

            // Don't show the button if the user is chatting with themselves
            if (network.nick === buffer.name) {
                return false;
            }

            let game = Utils.getGame(buffer.name);
            if (!game) {
                return true;
            }

            let gameActive = game.getShowGame() && !game.getGameOver();
            let inviteActive = game.getInviteSent() || game.getShowInvite();
            return !gameActive && !inviteActive;
        },
    },
    mounted() {
        // eslint-disable-next-line no-undef
        this.listen(kiwi, 'plugin-pictionary.update-button', () => {
            this.forceUpdateUI();
        });
    },
    methods: {
        forceUpdateUI() {
            this.count++;
        },
        buttonClicked() {
            /* eslint-disable no-undef */
            let buffer = kiwi.state.getActiveBuffer();
            let network = buffer.getNetwork();
            /* eslint-enable no-undef */

            if (buffer.name === network.nick) {
                return;
            }

            Utils.inviteToPictionary(network, buffer.name, buffer);
            this.forceUpdateUI();
        },
    },
};
</script>

<style>
.pict-header-btn-wrap {
    display: inline-flex;
    align-items: center;
}

.pict-header-btn {
    display: inline-flex !important;
    align-items: center;
    gap: 5px;
    padding: 3px 10px !important;
    font-size: 0.85em;
    border-radius: 5px;
    cursor: pointer;
    transition: opacity 0.2s, transform 0.1s;
    white-space: nowrap;
}

.pict-header-btn:hover {
    opacity: 0.88;
    transform: translateY(-1px);
}

.pict-header-btn:active {
    transform: translateY(0);
}

.pict-header-btn__icon {
    flex-shrink: 0;
    opacity: 0.9;
}
</style>
