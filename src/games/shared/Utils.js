// kiwi injecté comme global via webpack ProvidePlugin (src/kiwi-runtime.js)

export function incrementUnread(buffer) {
    const activeBuffer = kiwi.state.getActiveBuffer();
    if (activeBuffer && activeBuffer !== buffer) {
        buffer.incrementFlag('unread');
    }
}

export function sendData(network, target, data, tag) {
    const msg = new network.ircClient.Message('TAGMSG', target);
    msg.prefix = network.nick;
    msg.tags[tag] = JSON.stringify(data);
    network.ircClient.raw(msg);
}
