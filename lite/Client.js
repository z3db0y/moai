const { EventEmitter } = require('stream');
const { parse } = require('url');
const Serializer = require('./Serializer');
const net = require('net');

class Client extends EventEmitter {
    connect(u, callback) {
        let url = {
            hostname: u.split(':')[0],
            port: u.split(':')[1]
        }

        this.socket = new net.Socket();
        this.socket.once('error', () => {
            if(typeof callback === 'function') callback.call(null, false);

        });
        this.socket.on('connect', () => {
            if(typeof callback === 'function') callback.call(null, true);
        });
        this.socket.on('close', () => {
            this.emit('disconnect');
        });
        this.socket.on('data', data => {
            data = new Uint8Array(data).buffer;
            this.emit('packet', Serializer.decode(data));
        });
        this.socket.connect({ host: url.hostname, port: url.port || 80 });
    }

    connected() {
        return this.socket && this.socket.readyState === 'open';
    }

    sendPacket(data) {
        if(!this.connected()) throw new Error('Cannot send packet - Not connected.');

        this.socket.write(new Uint8Array(Serializer.encode(data)));
    }

    disconnect() {
        if(!this.connected()) throw new Error('Client not connected.');
        this.socket.destroy();
    }
}

module.exports = Client;