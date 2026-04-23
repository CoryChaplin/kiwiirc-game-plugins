<template>
  <div id="pictionary" class="pict-header-btn-wrap" v-if="showButton">
    <button type="button" class="pict-header-btn" @click="buttonClicked">
      <span class="pict-header-btn__icon" aria-hidden="true">🖌</span>
      {{ $t('kiwi-games:pict_title') }}
    </button>
  </div>
</template>

<script>
/* global kiwi:true */

import * as Utils from '../libs/Utils.js';
import GameComponent from './GameComponent.vue';

const ROOM_NAME_RE = /^#pictionary\d{8}$/i;

function getChannelMemberNicks(buffer, localNick) {
  if (!buffer) return [];
  let rawUsers = null;
  if (Array.isArray(buffer.users)) {
    rawUsers = buffer.users;
  } else if (buffer.users && typeof buffer.users === 'object') {
    rawUsers = Object.values(buffer.users);
  } else if (typeof buffer.getUsers === 'function') {
    rawUsers = buffer.getUsers();
  }
  if (!Array.isArray(rawUsers)) return [];
  const nicks = rawUsers
    .map((u) => {
      if (!u) return '';
      if (typeof u === 'string') return u;
      if (typeof u.nick === 'string') return u.nick;
      if (typeof u.username === 'string') return u.username;
      return '';
    })
    .map((n) => n.trim())
    .filter(Boolean)
    .filter((n) => n !== localNick);
  return Array.from(new Set(nicks));
}

export default {
  data() {
    return { count: 0 };
  },
  computed: {
    showButton() {
      // eslint-disable-next-line no-unused-expressions
      this.count;

      const buffer = kiwi.state.getActiveBuffer();
      const network = kiwi.state.getActiveNetwork();
      if (!buffer || !network) {
        return false;
      }
      if (!Utils.bufferIsChannel(buffer) || !ROOM_NAME_RE.test(buffer.name)) {
        return false;
      }

      const game = Utils.getGameForBuffer(buffer);
      if (!game) {
        return true;
      }

      const gameActive = game.getShowGame() && !game.getGameOver();
      const lobbyActive = game.getShowLobby();
      const inviteActive = game.getInviteSent() || game.getShowInvite();
      return !gameActive && !lobbyActive && !inviteActive;
    },
  },
  mounted() {
    this.listen(kiwi, 'plugin-pictionary.update-button', () => {
      this.forceUpdateUI();
    });
  },
  methods: {
    forceUpdateUI() {
      this.count++;
    },
    buttonClicked() {
      const buffer = kiwi.state.getActiveBuffer();
      const network = buffer.getNetwork();
      if (!Utils.bufferIsChannel(buffer) || !ROOM_NAME_RE.test(buffer.name)) {
        return;
      }

      const key = Utils.gameKey(network.id, buffer.name);
      let game = Utils.getGame(key);
      if (!game) {
        Utils.newGame(network, network.nick, buffer.name, true);
        game = Utils.getGame(key);
      }
      const gameActive = game.getShowGame() && !game.getGameOver();
      const lobbyActive = game.getShowLobby();
      const inviteActive = game.getShowInvite();
      if (gameActive || lobbyActive || inviteActive) return;

      const invitees = getChannelMemberNicks(buffer, network.nick);
      if (!invitees.length) {
        kiwi.state.addMessage(buffer, {
          nick: '*',
          message: kiwi.i18n.t('kiwi-games:pict_no_other_members'),
          type: 'message',
        });
        return;
      }

      game.setLobbyHostNick(network.nick);
      game.setShowInvite(false);
      game.setShowLobby(true);
      game.setParticipants([network.nick]);

      Utils.sendData(network, buffer.name, {
        cmd: 'channel_lobby',
        host: network.nick,
        participants: [network.nick],
      });
      invitees.forEach((nick) => {
        Utils.ircInviteToChannel(network, nick, buffer.name);
        Utils.sendData(network, nick, {
          cmd: 'room_invite',
          host: network.nick,
          room: buffer.name,
          participants: [network.nick],
        });
      });

      this.forceUpdateUI();
      kiwi.state.addMessage(buffer, {
        nick: '*',
        message: kiwi.i18n.t('kiwi-games:pict_relaunch', { room: buffer.name, list: invitees.join(', ') }),
        type: 'message',
      });
      kiwi.emit('mediaviewer.show', { component: GameComponent });
    },
  },
};
</script>

<style scoped>
#pictionary .pict-header-btn-wrap {
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
