const net = require('net');
const { EventEmitter } = require('events');
const Serializer = require('./Serializer');

const defaultOpts = {
	port: 0
};

class ServerClient extends EventEmitter {
	#socket;

	constructor(socket) {
		super();
		this.#socket = socket;
		socket.on('data', data => {
			data = new Uint8Array(data).buffer;
			this.emit('packet', Serializer.decode(data));
		});
		socket.on('close', () => {
			this.emit('disconnect');
		});
	}

	sendPacket(data) {
		this.#socket.write(new Uint8Array(Serializer.encode(data)));
	}

	disconnect() {
		this.#socket.destroy();
	}
}

class Server extends EventEmitter {
	clients = [];
	#server;

	listen(opts) {
		opts = opts || {};
		opts = Object.assign(defaultOpts, opts);
		this.#server = net.createServer(socket => {
			let client = new ServerClient(socket);
			this.clients.push(client);
			this.emit('client', client);
			socket.on('error', () => {});
			socket.on('close', () => {
				this.clients.splice(this.clients.indexOf(client), 1);
			});
		});
		this.#server.listen(opts.port);
	}

	close() {
		this.#server.close();
	}
}

module.exports = Server;
