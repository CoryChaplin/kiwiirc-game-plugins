import * as Utils from './libs/Utils.js';
import GameButton from './components/GameButton.vue';
import GameComponent from './components/GameComponent.vue';

/**
 * Initialise le plugin Pictionary dans le contexte Kiwi fourni.
 *
 * @param {object} kiwi   - L'instance Kiwi IRC passée par le plugin parent.
 * @param {object} config - Configuration du jeu.
 * @param {boolean} [config.button=true]  - Afficher le bouton dans le header.
 * @param {boolean} [config.command=true]  - Enregistrer la commande /pictionary <nick>.
 */
export function init(kiwi, config) {
    const cfg = { button: true, command: true, ...config };
    let mediaViewerOpen = false;

    if (cfg.button) {
        kiwi.addUi('header_query', GameButton);
    }

    if (cfg.command) {
        kiwi.on('input.command.pictionary', (eventObj, command, params, context) => {
            eventObj.handled = true;
            const { network, buffer } = context;
            if (!network || !buffer) return;
            Utils.inviteToPictionary(network, params, buffer);
        });
    }

    kiwi.on('irc.raw.TAGMSG', (command, event, network) => {
        if (
            event.params[0] !== network.nick ||
            event.nick === network.nick ||
            !event.tags['+kiwiirc.com/pictionary'] ||
            event.tags['+kiwiirc.com/pictionary'].charAt(0) !== '{'
        ) {
            return;
        }

        let data;
        try {
            data = JSON.parse(event.tags['+kiwiirc.com/pictionary']);
        } catch (e) {
            return;
        }

        const buffer = kiwi.state.getOrAddBufferByName(network.id, event.nick);
        let game = Utils.getGame(event.nick);

        switch (data.cmd) {
        case 'invite': {
            if (!game) {
                Utils.newGame(network, network.nick, event.nick);
            }
            game = Utils.getGame(event.nick);
            game.setShowInvite(true);
            kiwi.emit('plugin-pictionary.update-button');
            kiwi.state.addMessage(buffer, {
                nick: '*',
                message: 'Tu es invité·e à jouer au Pictionary !',
                type: 'message',
            });
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
            kiwi.state.addMessage(buffer, {
                nick: '*',
                message: event.nick + ' a accepté — c\u2019est parti pour le Pictionary !',
                type: 'message',
            });
            game.startGame(data.drawer);
            game.setInviteSent(false);
            if (!mediaViewerOpen && kiwi.state.getActiveBuffer().name === game.getRemotePlayer()) {
                kiwi.emit('mediaviewer.show', { component: GameComponent });
            }
            break;
        }
        case 'invite_declined': {
            kiwi.state.addMessage(buffer, {
                nick: '*',
                message: event.nick + ' a refus\u00e9 l\u2019invitation au Pictionary.',
                type: 'message',
            });
            game.setInviteSent(false);
            break;
        }
        case 'stroke': {
            if (game && event.nick === game.getDrawer() && data.points && data.points.length) {
                game.addPaintOp({
                    type: 'stroke',
                    points: data.points,
                    color: data.color || '#1a1a1a',
                    width: typeof data.width === 'number' ? data.width : 3,
                });
                kiwi.emit('plugin-pictionary.redraw-canvas');
            }
            break;
        }
        case 'fill': {
            if (
                game &&
                event.nick === game.getDrawer() &&
                typeof data.nx === 'number' &&
                typeof data.ny === 'number' &&
                typeof data.color === 'string'
            ) {
                game.addPaintOp({
                    type: 'fill',
                    nx: Math.max(0, Math.min(1000, Math.round(data.nx))),
                    ny: Math.max(0, Math.min(1000, Math.round(data.ny))),
                    color: data.color,
                });
                kiwi.emit('plugin-pictionary.redraw-canvas');
            }
            break;
        }
        case 'clear': {
            if (game && event.nick === game.getDrawer()) {
                game.clearPaintOps();
                kiwi.emit('plugin-pictionary.redraw-canvas');
            }
            break;
        }
        case 'undo': {
            if (game && event.nick === game.getDrawer() && !game.getGameOver()) {
                game.popLastPaintOp();
                kiwi.emit('plugin-pictionary.redraw-canvas');
            }
            break;
        }
        case 'guess': {
            if (
                game &&
                game.isDrawer() &&
                event.nick === game.getRemotePlayer() &&
                typeof data.text === 'string' &&
                !game.getGameOver()
            ) {
                const ok = game.checkGuess(data.text);
                Utils.sendData(network, event.nick, {
                    cmd: 'guess_result',
                    correct: ok,
                    word: ok ? game.getWord() : undefined,
                });
                if (ok) {
                    const msg = event.nick + ' a trouv\u00e9 : \u00ab\u00a0' + game.getWord() + '\u00a0\u00bb\u00a0!';
                    game.setGameOver(msg);
                    kiwi.state.addMessage(buffer, { nick: '*', message: msg, type: 'message' });
                }
            }
            break;
        }
        case 'guess_result': {
            if (game && game.isGuesser() && event.nick === game.getDrawer()) {
                game.setLastGuessWrong(!data.correct);
                if (data.correct) {
                    if (data.word) {
                        game.setWordFromReveal(data.word);
                    }
                    game.setGameOver('Bravo\u00a0! Le mot \u00e9tait\u00a0: \u00ab\u00a0' + (data.word || '') + '\u00a0\u00bb.');
                }
            }
            break;
        }
        case 'error': {
            if (game) {
                game.setGameOver(data.message || 'Erreur.');
            }
            break;
        }
        case 'terminate': {
            game.setGameOver('Partie termin\u00e9e par ' + event.nick + '.');
            kiwi.state.addMessage(buffer, {
                nick: '*',
                message: event.nick + ' a mis fin au Pictionary.',
                type: 'message',
            });
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
            const game = Utils.getGame(buffer.name);
            if (game) {
                Utils.terminateGame(game);
            }
        }
        mediaViewerOpen = false;
    });

    kiwi.on('irc.nick', (event, network) => {
        if (event.nick === network.nick) {
            Object.keys(Utils.getGames()).forEach((key) => {
                const g = Utils.getGame(key);
                if (g) {
                    if (g.getDrawer() === event.nick) g.setDrawer(event.new_nick);
                    g.setLocalPlayer(event.new_nick);
                }
            });
            return;
        }
        const g = Utils.getGame(event.nick);
        if (g) {
            if (g.getDrawer() === event.nick) g.setDrawer(event.new_nick);
            g.setRemotePlayer(event.new_nick);
            Utils.setGame(event.new_nick, g);
            Utils.setGame(event.nick, null);
        }
    });

    kiwi.on('irc.quit', (event, network) => {
        if (event.nick === network.nick) {
            Object.keys(Utils.getGames()).forEach((key) => {
                const g = Utils.getGame(key);
                if (g && g.getInviteSent()) {
                    Utils.setGame(g.getRemotePlayer(), null);
                }
            });
            kiwi.emit('plugin-pictionary.update-button');
            return;
        }
        const g = Utils.getGame(event.nick);
        if (g && g.getInviteSent()) {
            Utils.setGame(g.getRemotePlayer(), null);
            kiwi.emit('plugin-pictionary.update-button');
        }
    });

    kiwi.state.$watch('ui.active_buffer', () => {
        const buffer = kiwi.state.getActiveBuffer();
        const game = Utils.getGame(buffer.name);
        if (game && (game.getShowGame() || game.getShowInvite()) && !mediaViewerOpen) {
            kiwi.emit('mediaviewer.show', { component: GameComponent });
        } else if (!game && mediaViewerOpen) {
            kiwi.emit('mediaviewer.hide');
        }
    });
}
