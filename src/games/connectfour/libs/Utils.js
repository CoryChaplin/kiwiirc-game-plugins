import ConnectFour from './ConnectFour.js';

const games = {};

export function newGame(network, localPlayer, remotePlayer) {
    games[remotePlayer] = new ConnectFour(network, localPlayer, remotePlayer);
}

export function getGame(key) {
    return games[key];
}

export function setGame(key, game) {
    games[key] = game;
}

export function removeGame(key) {
    delete games[key];
}

export function getGames() {
    return games;
}

export function sendData(network, target, data) {
    let msg = new network.ircClient.Message('TAGMSG', target);
    msg.prefix = network.nick;
    msg.tags['+kiwiirc.com/c4'] = JSON.stringify(data);
    network.ircClient.raw(msg);
}

export function terminateGame(game) {
    if (!game) {
        return;
    }
    let network = game.getNetwork();
    let buffer = kiwi.state.getBufferByName(network.id, game.getRemotePlayer());

    if (network && game.getShowInvite()) {
        sendData(network, game.getRemotePlayer(), { cmd: 'invite_declined' });
    } else if (!game.getGameOver()) {
        game.setGameOver(true);
        if (network) {
            sendData(network, game.getRemotePlayer(), { cmd: 'terminate' });
        }
        if (buffer) {
            kiwi.state.addMessage(buffer, {
                nick: '*',
                message: 'You ended the game of Connect Four!',
                type: 'message',
            });
        }
    }
    removeGame(game.getRemotePlayer());
}

export function incrementUnread(buffer) {
    let activeBuffer = kiwi.state.getActiveBuffer();
    if (activeBuffer && activeBuffer !== buffer) {
        buffer.incrementFlag('unread');
    }
}

export function inviteToConnectFour(network, targetNick, errorBuffer) {
    const nick = (targetNick || '').trim();
    if (!nick) {
        if (errorBuffer) {
            kiwi.state.addMessage(errorBuffer, {
                nick: '*', message: 'Usage: /connectfour <nick>', type: 'error',
            });
        }
        return false;
    }
    if (nick === network.nick) {
        if (errorBuffer) {
            kiwi.state.addMessage(errorBuffer, {
                nick: '*', message: 'You cannot invite yourself to play Connect Four.', type: 'error',
            });
        }
        return false;
    }

    const buffer = kiwi.state.getOrAddBufferByName(network.id, nick);

    if (!getGame(nick)) {
        newGame(network, network.nick, nick);
    }
    const game = getGame(nick);

    if ((game.getShowGame() && !game.getGameOver()) || game.getInviteSent()) {
        if (errorBuffer) {
            kiwi.state.addMessage(errorBuffer, {
                nick: '*',
                message: 'A game or invite is already active with ' + nick + '.',
                type: 'error',
            });
        }
        return false;
    }

    game.setInviteSent(true);
    if (!game.getInviteTimeout()) {
        game.setInviteTimeout(window.setTimeout(() => {
            game.setInviteTimeout(null);
            game.setInviteSent(false);
            kiwi.state.addMessage(buffer, {
                nick: '*',
                message: 'The invite to ' + nick + ' timed out — maybe they don\'t have the Connect Four plugin?',
                type: 'message',
            });
        }, 4000));
    }
    sendData(network, nick, { cmd: 'invite' });
    kiwi.state.addMessage(buffer, {
        nick: '*', message: nick + ' has been invited to play Connect Four!', type: 'message',
    });
    return true;
}

