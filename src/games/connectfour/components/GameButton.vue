<template>
    <div class="cf-header-btn-wrap">
        <button
            v-if="showButton"
            class="u-button u-button-primary cf-header-btn"
            title="Challenge to Connect Four"
            @click="buttonClicked"
        >
            <svg class="cf-header-btn__icon" viewBox="0 0 20 20" width="13" height="13" fill="currentColor" aria-hidden="true">
                <circle cx="4"  cy="7"  r="2.5" />
                <circle cx="10" cy="7"  r="2.5" />
                <circle cx="16" cy="7"  r="2.5" />
                <circle cx="4"  cy="13" r="2.5" />
                <circle cx="10" cy="13" r="2.5" />
                <circle cx="16" cy="13" r="2.5" />
            </svg>
            Connect Four
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
            // the count = count is to force the button to update when first game is created
            // eslint-disable-next-line no-unused-expressions
            this.count;

            /* eslint-disable no-undef */
            let buffer = kiwi.state.getActiveBuffer();
            let network = kiwi.state.getActiveNetwork();
            /* eslint-enable no-undef */

            // Don't show the button if they have a chat to themself
            if (network.nick === buffer.name) {
                return false;
            }

            // If there is no game show the button
            let game = Utils.getGame(buffer.name);
            if (!game) {
                return true;
            }

            // Decide if the button is needed or not
            let gameActive = game.getShowGame() && !game.getGameOver();
            let inviteActive = game.getInviteSent() || game.getShowInvite();
            let ret = !gameActive && !inviteActive;
            return ret;
        },
    },
    mounted() {
        this.listen(kiwi, 'plugin-connectfour.update-button', () => {
            this.forceUpdateUI();
        });
    },
    methods: {
        forceUpdateUI() {
            this.count++;
        },
        buttonClicked() {
            // eslint-disable-next-line no-undef
            let buffer = kiwi.state.getActiveBuffer();
            let network = buffer.getNetwork();

            if (buffer.name === network.nick) {
                return;
            }

            if (!Utils.getGame(buffer.name)) {
                Utils.newGame(network, network.nick, buffer.name);
            }
            let game = Utils.getGame(buffer.name);

            let gameActive = game.getShowGame() && !game.getGameOver();
            let inviteActive = game.getInviteSent() && game.getShowInvite();
            if (gameActive || inviteActive) {
                return;
            }

            game.setInviteSent(true);
            if (!game.getInviteTimeout()) {
                game.setInviteTimeout(window.setTimeout(() => {
                    game.setInviteTimeout(null);
                    game.setInviteSent(false);

                    // eslint-disable-next-line no-undef
                    kiwi.state.addMessage(buffer, {
                        nick: '*',
                        message: 'The invite to ' + buffer.name +
                            ' has timed out :( maybe they don\'t have the Connect Four plugin?',
                        type: 'message',
                    });
                }, 4000));
            }
            this.forceUpdateUI();
            Utils.sendData(network, buffer.name, { cmd: 'invite' });
            // eslint-disable-next-line no-undef
            kiwi.state.addMessage(buffer, {
                nick: '*',
                message: buffer.name + ' has been invited to play Connect Four!',
                type: 'message',
            });
        },
    },
};
</script>

<style>
#connectfour .cf-header-btn-wrap {
    display: inline-flex;
    align-items: center;
}

.cf-header-btn {
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

.cf-header-btn:hover {
    opacity: 0.88;
    transform: translateY(-1px);
}

.cf-header-btn:active {
    transform: translateY(0);
}

.cf-header-btn__icon {
    flex-shrink: 0;
    opacity: 0.9;
}
</style>
