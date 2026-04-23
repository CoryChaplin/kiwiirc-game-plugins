import ConnectFour from './ConnectFour.js';
import { incrementUnread as _incrementUnread, sendData as _sendData } from '../../shared/Utils.js';
import { t } from '../../shared/locales.js';

const TAG = '+kiwiirc.com/c4';

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
    _sendData(network, target, data, TAG);
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
                message: t('c4_you_ended'),
                type: 'message',
            });
        }
    }
    removeGame(game.getRemotePlayer());
}

export function incrementUnread(buffer) {
    _incrementUnread(buffer);
}
