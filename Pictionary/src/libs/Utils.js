import Pictionary from './Pictionary.js';

const games = {};

export function newGame(network, localPlayer, remotePlayer) {
  games[remotePlayer] = new Pictionary(network, localPlayer, remotePlayer);
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
  const msg = new network.ircClient.Message('TAGMSG', target);
  msg.prefix = network.nick;
  msg.tags['+kiwiirc.com/pictionary'] = JSON.stringify(data);
  network.ircClient.raw(msg);
}

export function terminateGame(game) {
  if (!game) {
    return;
  }
  const network = game.getNetwork();
  const buffer = kiwi.state.getBufferByName(network.id, game.getRemotePlayer());

  if (network && game.getShowInvite()) {
    sendData(network, game.getRemotePlayer(), { cmd: 'invite_declined' });
  } else if (!game.getGameOver()) {
    game.setGameOver('Partie interrompue par toi.');
    if (network) {
      sendData(network, game.getRemotePlayer(), { cmd: 'terminate' });
    }
    if (buffer) {
      kiwi.state.addMessage(buffer, {
        nick: '*',
        message: 'Tu as quitté la partie de Pictionary.',
        type: 'message',
      });
    }
  }
  removeGame(game.getRemotePlayer());
}

export function incrementUnread(buffer) {
  const activeBuffer = kiwi.state.getActiveBuffer();
  if (activeBuffer && activeBuffer !== buffer) {
    buffer.incrementFlag('unread');
  }
}
export function inviteToPictionary(network, targetNick, errorBuffer) {
  const nick = (targetNick || '').trim();
  if (!nick) {
    if (errorBuffer) {
      kiwi.state.addMessage(errorBuffer, {
        nick: '*',
        message: 'Usage : /pictionary pseudo',
        type: 'error',
      });
    }
    return false;
  }
  if (nick === network.nick) {
    if (errorBuffer) {
      kiwi.state.addMessage(errorBuffer, {
        nick: '*',
        message: 'Tu ne peux pas t’inviter toi-même au Pictionary.',
        type: 'error',
      });
    }
    return false;
  }

  const buffer = kiwi.state.getOrAddBufferByName(network.id, nick);

  if (!getGame(buffer.name)) {
    newGame(network, network.nick, buffer.name);
  }
  const game = getGame(buffer.name);

  const gameActive = game.getShowGame() && !game.getGameOver();
  const inviteActive = game.getInviteSent() && game.getShowInvite();
  if (gameActive || inviteActive) {
    if (errorBuffer) {
      kiwi.state.addMessage(errorBuffer, {
        nick: '*',
        message: 'Une partie ou une invitation est déjà en cours avec ' + nick + '.',
        type: 'error',
      });
    }
    return false;
  }

  game.setInviteSent(true);
  if (!game.getInviteTimeout()) {
    game.setInviteTimeout(
      window.setTimeout(() => {
        game.setInviteTimeout(null);
        game.setInviteSent(false);
        kiwi.state.addMessage(buffer, {
          nick: '*',
          message:
            'L’invitation à ' +
            buffer.name +
            ' a expiré — peut-être n’a-t-il pas le plugin Pictionary ?',
          type: 'message',
        });
      }, 4000),
    );
  }
  sendData(network, buffer.name, { cmd: 'invite' });
  kiwi.state.addMessage(buffer, {
    nick: '*',
    message: buffer.name + ' a été invité·e au Pictionary.',
    type: 'message',
  });
  return true;
}
