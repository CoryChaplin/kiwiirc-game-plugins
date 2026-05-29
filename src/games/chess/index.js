import * as Utils from './libs/Utils.js';
import GameComponent from './components/GameComponent.vue';
import { t } from '../shared/locales.js';

export function init(kiwi, config) {
    const cfg = { button: true, command: true, ...config };
    let mediaViewerOpen = false;

    function inviteToChess(network, targetNick, errorBuffer) {
        const nick = (targetNick || '').trim();
        if (!nick) {
            kiwi.state.addMessage(errorBuffer, { nick: '*', message: t('ch_usage'), type: 'error' });
            return;
        }
        if (nick === network.nick) {
            kiwi.state.addMessage(errorBuffer, { nick: '*', message: t('ch_cannot_invite_self'), type: 'error' });
            return;
        }
        const buffer = kiwi.state.getOrAddBufferByName(network.id, nick);
        if (!Utils.getGame(nick)) {
            Utils.newGame(network, network.nick, nick);
        }
        const game = Utils.getGame(nick);
        if ((game.getShowGame() && !game.getGameOver()) || game.getInviteSent()) {
            kiwi.state.addMessage(errorBuffer, { nick: '*', message: t('ch_already_active', { nick }), type: 'error' });
            return;
        }
        const feedbackBuffer = errorBuffer || buffer;
        game.setInviteSent(true);
        if (!game.getInviteTimeout()) {
            game.setInviteTimeout(window.setTimeout(() => {
                game.setInviteTimeout(null);
                game.setInviteSent(false);
                kiwi.state.addMessage(feedbackBuffer, { nick: '*', message: t('ch_invite_timeout', { nick }), type: 'message' });
            }, 4000));
        }
        Utils.sendData(network, nick, { cmd: 'invite' });
        kiwi.emit('plugin-kiwi-games.game-proposed', { game: 'chess' });
        kiwi.state.addMessage(feedbackBuffer, { nick: '*', message: t('ch_invite_sent', { nick }), type: 'message' });
    }

    if (cfg.command) {
        kiwi.on('input.command.chess', (eventObj, command, params, context) => {
            eventObj.handled = true;
            const { network, buffer } = context;
            if (!network || !buffer) return;
            inviteToChess(network, params, buffer);
        });
    }

    kiwi.on('irc.raw.TAGMSG', (command, event, network) => {
        if (
            event.params[0] !== network.nick ||
            event.nick === network.nick ||
            !event.tags['+kiwiirc.com/chess'] ||
            event.tags['+kiwiirc.com/chess'].charAt(0) !== '{'
        ) {
            return;
        }
        let data;
        try {
            data = JSON.parse(event.tags['+kiwiirc.com/chess']);
        } catch (_) {
            return;
        }
        const buffer = kiwi.state.getOrAddBufferByName(network.id, event.nick);
        let game = Utils.getGame(event.nick);
        if (data.cmd !== 'invite' && !game) {
            return;
        }

        switch (data.cmd) {
        case 'invite': {
            if (!game) {
                Utils.newGame(network, network.nick, event.nick);
            }
            game = Utils.getGame(event.nick);
            game.setShowInvite(true);
            kiwi.state.addMessage(buffer, { nick: '*', message: t('ch_invite_received'), type: 'message' });
            Utils.sendData(network, event.nick, { cmd: 'invite_received' });
            if (!mediaViewerOpen && kiwi.state.getActiveBuffer().name === event.nick) {
                kiwi.emit('mediaviewer.show', { component: GameComponent });
            }
            break;
        }
        case 'invite_received': {
            const inviteTimeout = game.getInviteTimeout();
            if (inviteTimeout) {
                window.clearTimeout(inviteTimeout);
                game.setInviteTimeout(null);
            }
            break;
        }
        case 'invite_accepted': {
            kiwi.state.addMessage(buffer, { nick: '*', message: t('ch_invite_accepted', { nick: event.nick }), type: 'message' });
            game.startGame(data.startPlayer);
            game.setInviteSent(false);
            kiwi.emit('plugin-kiwi-games.game-started', { game: 'chess' });
            if (!mediaViewerOpen && kiwi.state.getActiveBuffer().name === game.getRemotePlayer()) {
                kiwi.emit('mediaviewer.show', { component: GameComponent });
            }
            break;
        }
        case 'invite_declined': {
            kiwi.state.addMessage(buffer, { nick: '*', message: t('ch_invite_declined', { nick: event.nick }), type: 'message' });
            game.setInviteSent(false);
            break;
        }
        case 'action': {
            if (!Array.isArray(data.from) || !Array.isArray(data.to) || game.getGameTurn() !== data.turn) {
                game.setGameOver(true);
                const message = t('common_turn_out_of_sync');
                game.setGameMessage(message);
                Utils.sendData(network, game.getRemotePlayer(), { cmd: 'error', message });
                break;
            }
            const ok = game.applyMove(data.from, data.to, data.promotion);
            if (!ok) {
                game.setGameOver(true);
                const message = t('common_turn_out_of_sync');
                game.setGameMessage(message);
                Utils.sendData(network, game.getRemotePlayer(), { cmd: 'error', message });
            } else if (game.getGameOver()) {
                kiwi.emit('plugin-kiwi-games.game-completed', { game: 'chess' });
            }
            break;
        }
        case 'error': {
            game.setGameOver(true);
            game.setGameMessage(data.message || t('common_turn_out_of_sync'));
            break;
        }
        case 'terminate': {
            game.setGameOver(true);
            game.setGameMessage(t('ch_ended_by', { nick: event.nick }));
            kiwi.state.addMessage(buffer, { nick: '*', message: t('ch_remote_ended', { nick: event.nick }), type: 'message' });
            break;
        }
        default:
            break;
        }
        if (data.cmd && data.cmd !== 'invite_received') {
            Utils.incrementUnread(buffer);
        }
    });

    kiwi.on('mediaviewer.show', (url) => {
        mediaViewerOpen = url.component === GameComponent;
    });

    kiwi.on('mediaviewer.hide', (event) => {
        if (mediaViewerOpen && event && event.source === 'user') {
            const buffer = kiwi.state.getActiveBuffer();
            const game = buffer ? Utils.getGame(buffer.name) : null;
            if (game) {
                Utils.terminateGame(game);
            }
        }
        mediaViewerOpen = false;
    });

    kiwi.on('irc.nick', (event, network) => {
        if (event.nick === network.nick) {
            Object.keys(Utils.getGames()).forEach((key) => {
                const game = Utils.getGame(key);
                if (!game) return;
                if (game.getStartPlayer() === event.nick) {
                    game.setStartPlayer(event.new_nick);
                }
                game.setLocalPlayer(event.new_nick);
            });
            return;
        }
        const game = Utils.getGame(event.nick);
        if (!game) return;
        if (game.getStartPlayer() === event.nick) {
            game.setStartPlayer(event.new_nick);
        }
        game.setRemotePlayer(event.new_nick);
        Utils.setGame(event.new_nick, game);
        Utils.setGame(event.nick, null);
    });

    kiwi.on('irc.quit', (event, network) => {
        if (event.nick === network.nick) {
            Object.keys(Utils.getGames()).forEach((key) => {
                const game = Utils.getGame(key);
                if (!game) return;
                if (game.getShowGame() && !game.getGameOver()) {
                    Utils.terminateGame(game);
                } else if (game.getInviteSent() || game.getShowInvite()) {
                    Utils.removeGame(key);
                }
            });
            return;
        }
        const game = Utils.getGame(event.nick);
        if (!game) return;
        if (game.getShowGame() && !game.getGameOver()) {
            game.setGameOver(true);
            game.setGameMessage(t('ch_ended_by', { nick: event.nick }));
            const buffer = kiwi.state.getBufferByName(network.id, event.nick);
            if (buffer) {
                kiwi.state.addMessage(buffer, { nick: '*', message: t('ch_remote_ended', { nick: event.nick }), type: 'message' });
            }
        }
        Utils.removeGame(event.nick);
    });

    kiwi.state.$watch('ui.active_buffer', () => {
        const buffer = kiwi.state.getActiveBuffer();
        if (!buffer) return;
        const game = Utils.getGame(buffer.name);
        if (game && (game.getShowGame() || game.getShowInvite()) && !mediaViewerOpen) {
            kiwi.emit('mediaviewer.show', { component: GameComponent });
        } else if (!game && mediaViewerOpen) {
            kiwi.emit('mediaviewer.hide');
        }
    });
}
