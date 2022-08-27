let WebSocket;
let Serializer;

if (typeof window !== 'undefined') {
    // Browser imports
    WebSocket = window.WebSocket;
    if (!window.Serializer) throw new Error('Serializer not detected.');
    Serializer = window.Serializer;
} else {
    // Node.JS imports
    WebSocket = require('ws').WebSocket;
    Serializer = require('./Serializer');
}

class EventEmitter {
    #listeners = [];

    emit(name, ...args) {
        for (var i in this.#listeners) {
            var l = this.#listeners[i];
            if (l.name === name) {
                l.callback.apply(null, args);
                if (l.once) this.#listeners.splice(i, 1);
            }
        }
        if (typeof this['on' + name] === 'function') this['on' + name].apply(null, args);
    }

    addEventListener(name, callback) {
        if (typeof callback === 'function') this.#listeners.push({ name, callback });
    }

    on(name, callback) {
        if (typeof callback === 'function') this.#listeners.push({ name, callback });
    }

    once(name, callback) {
        if (typeof callback === 'function') this.#listeners.push({ name, callback });
    }

    removeEventListener(name, callback) {
        let i = this.#listeners.indexOf(x => x.name === name && x.callback === callback);
        if (i) this.#listeners.splice(i, 1);
    }

    off(name, callback) {
        let i = this.#listeners.indexOf(x => x.name === name && x.callback === callback);
        if (i) this.#listeners.splice(i, 1);
    }
}

class Client extends EventEmitter {
    #reconnect() {
        if (!this.socket) throw new Error("Reconnect failure - Uninitialized socket.");

        this.connect(new URL(this.socket.url));
    }

    connect(server, callback) {
        if (!(server instanceof URL)) throw new Error('Parameter "server" must be a URL.');

        this.socket = new WebSocket(server.toString());
        this.socket.onerror = () => {
            if (typeof callback === 'function') callback.call(null, false);
        };
        this.socket.onopen = () => {
            if (typeof callback === 'function') callback.call(null, true);
        };
        this.socket.binaryType = 'arraybuffer';

        this.socket.onclose = ({ code, reason }) => {
            switch (code) {
                case 1006:
                    this.#reconnect();
                    break;
                default:
                    this.emit('disconnect', { code, reason });
                    this.socket = undefined;
                    break;
            }
        };
        this.socket.onmessage = ({ data }) => {
            this.emit('packet', Serializer.decode(data));
        };
    }

    connected() {
        return (!!this.socket && this.socket.readyState === 1);
    }

    sendPacket(data) {
        if (!this.connected()) throw new Error('Cannot send packet - Not connected.');

        let serialized = Serializer.encode(data);
        this.socket.send(serialized);
    }

    disconnect() {
        if(!this.connected()) throw new Error('Client not connected.');
        this.socket.close();
    }
}

if (typeof window !== 'undefined') window.Client = Client;
else module.exports = Client;
