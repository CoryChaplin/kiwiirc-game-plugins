import TicTacToe from './TicTacToe.js';

const games = {};

export function newGame(network, localPlayer, remotePlayer) {
    games[remotePlayer] = new TicTacToe(network, localPlayer, remotePlayer);
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
    msg.tags['+kiwiirc.com/ttt'] = JSON.stringify(data);
    network.ircClient.raw(msg);
}

export function terminateGame(game) {
    if (!game) {
        return;
    }
    let network = game.getNetwork();
    // eslint-disable-next-line no-undef
    let buffer = kiwi.state.getBufferByName(network.id, game.getRemotePlayer());

    if (network && game.getShowInvite()) {
        sendData(network, game.getRemotePlayer(), { cmd: 'invite_declined' });
    } else if (!game.getGameOver()) {
        game.setGameOver(true);
        if (network) {
            sendData(network, game.getRemotePlayer(), { cmd: 'terminate' });
        }
        if (buffer) {
            // eslint-disable-next-line no-undef
            kiwi.state.addMessage(buffer, {
                nick: '*',
                message: 'You ended the game of Tic-Tac-Toe!',
                type: 'message',
            });
        }
    }
    removeGame(game.getRemotePlayer());
}

export function incrementUnread(buffer) {
    // eslint-disable-next-line no-undef
    let activeBuffer = kiwi.state.getActiveBuffer();
    if (activeBuffer && activeBuffer !== buffer) {
        buffer.incrementFlag('unread');
    }
}

export function inviteToTictactoe(network, targetNick, errorBuffer) {
    const nick = (targetNick || '').trim();
    if (!nick) {
        if (errorBuffer) {
            // eslint-disable-next-line no-undef
            kiwi.state.addMessage(errorBuffer, {
                nick: '*', message: 'Usage: /tictactoe <nick>', type: 'error',
            });
        }
        return false;
    }
    if (nick === network.nick) {
        if (errorBuffer) {
            // eslint-disable-next-line no-undef
            kiwi.state.addMessage(errorBuffer, {
                nick: '*', message: 'You cannot invite yourself to play Tic-Tac-Toe.', type: 'error',
            });
        }
        return false;
    }

    // eslint-disable-next-line no-undef
    const buffer = kiwi.state.getOrAddBufferByName(network.id, nick);

    if (!getGame(nick)) {
        newGame(network, network.nick, nick);
    }
    const game = getGame(nick);

    if ((game.getShowGame() && !game.getGameOver()) || game.getInviteSent()) {
        if (errorBuffer) {
            // eslint-disable-next-line no-undef
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
            // eslint-disable-next-line no-undef
            kiwi.state.addMessage(buffer, {
                nick: '*',
                message: 'The invite to ' + nick + ' timed out — maybe they don\'t have the Tic-Tac-Toe plugin?',
                type: 'message',
            });
        }, 4000));
    }
    sendData(network, nick, { cmd: 'invite' });
    // eslint-disable-next-line no-undef
    kiwi.state.addMessage(buffer, {
        nick: '*', message: nick + ' has been invited to play Tic-Tac-Toe!', type: 'message',
    });
    return true;
}
