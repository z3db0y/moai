const http = require('http');
const https = require('https');
const { EventEmitter } = require('events');
const { parse } = require('url');
const crypto = require('crypto');
const Serializer = require('./Serializer');

const wsMagicString = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const defaultOpts = {
	server: null,
	sslCert: null,
	sslKey: null,
	path: '/',
	port: 0
};

class ServerClient extends EventEmitter {
	#socket;
	#lastFrame;
	#closePacket;
	#pingSent;
	ping = 0;

	constructor(socket) {
		super();
		this.#socket = socket;
		socket.on('data', data => {
			this.#parseFrame(data);
		});
		socket.on('close', () => {
			let code = 1006;
			let reason = '';
			if (this.#closePacket && this.#closePacket.PAYLOAD.byteLength > 1) {
				let view = this.#closePacket.MASKED ? this.#closePacket.PAYLOAD_UNMASKED : this.#closePacket.PAYLOAD;

				code = (view[0] << 8) + view[1];
				if (view.byteLength > 2) reason = new TextDecoder().decode(view.slice(2));
			}
			this.emit('disconnect', { code, reason });
		});
		setInterval(() => {
			this.#pingSent = performance.now();
			socket.write(this.#createFrame({ OPCODE: 0x9 }));
		}, 5000);
	}

	#createFrame(opts) {
		if (typeof opts !== 'object') throw new Error('Invalid options provided');
		opts = Object.assign({
			FIN: 0x1,
			RSV: [0x0, 0x0, 0x0],
			OPCODE: 0x1,
			MASKED: 0x0,
			LEN: 0x0,
			MASK: [0x0, 0x0, 0x0, 0x0],
			PAYLOAD: new Uint8Array(0)
		}, opts);

		let bufferLength = opts.LEN + 2;
		if (opts.MASKED) bufferLength += 4;

		if (opts.LEN > 9223372036854776000) throw new Error('Payload size exceeds maximum');
		else if (opts.LEN > 65535) bufferLength += 8;
		else if (opts.LEN > 125) bufferLength += 2;

		let maskOctet;
		let view = new Uint8Array(bufferLength);
		view[0] = opts.OPCODE + (opts.FIN << 7) + (opts.RSV[0] << 6) + (opts.RSV[1] << 5) + (opts.RSV[2] << 4);
		switch (bufferLength) {
			case (opts.LEN + 2):
			case (opts.LEN + 6):
				maskOctet = 2;
				view[1] = (opts.MASKED << 7) + opts.LEN;
				break;
			case (opts.LEN + 4):
			case (opts.LEN + 8):
				maskOctet = 4;
				view[1] = (opts.MASKED << 7) + 126;
				view[2] = opts.LEN >> 7;
				view[3] = opts.LEN & 0xFF;
				break;
			case (opts.LEN + 10):
			case (opts.LEN + 14):
				maskOctet = 10;
				view[1] = (opts.MASKED << 7) + 127;
				view[2] = opts.LEN >> 49 & 0xFF;
				view[3] = opts.LEN >> 42 & 0xFF;
				view[4] = opts.LEN >> 35 & 0xFF;
				view[5] = opts.LEN >> 28 & 0xFF;
				view[6] = opts.LEN >> 21 & 0xFF;
				view[7] = opts.LEN >> 14 & 0xFF;
				view[8] = opts.LEN >> 7 & 0xFF;
				view[9] = opts.LEN & 0xFF;
				break;
		}

		let dataOctet = maskOctet;
		if (opts.PAYLOAD.byteLength) {
			if (opts.MASKED) {
				for (var i = 0; i < 4; i++) {
					view[maskOctet + i] = opts.MASK[i];
				}
				dataOctet += 4;

				opts.PAYLOAD_MASKED = new Uint8Array(opts.PAYLOAD.byteLength);
				for (var i = 0; i < opts.PAYLOAD.byteLength; i++) {
					opts.PAYLOAD_MASKED[i] = opts.PAYLOAD[i] ^ opts.MASK[i % 4];
				}
				view.set(opts.PAYLOAD_MASKED, dataOctet);
			} else view.set(opts.PAYLOAD, dataOctet);
		}
		return view;
	}

	#parseFrame(buffer) {
		let view = new Uint8Array(buffer);
		let dataLen = view[1] & 0b1111111;
		let maskOctet = 2;
		if (dataLen == 126) {
			dataLen = view[3] + (view[2] << 7);
			maskOctet = 4;
		}
		if (dataLen == 127) {
			dataLen = view[9] + (view[8] << 7) + (view[7] << 14) + (view[6] << 21) + (view[5] << 28) + (view[4] << 35) + (view[3] << 42) + (view[2] << 49);
			maskOctet = 10;
		}
		let frame = {
			FIN: view[0] >> 7,
			RSV: [
				view[0] >> 6 & 0x1,
				view[0] >> 5 & 0x1,
				view[0] >> 4 & 0x1
			],
			OPCODE: view[0] & 0b1111,
			MASKED: view[1] >> 7,
			LEN: dataLen,
			MASK: (view[1] >> 7) ? [view[maskOctet], view[maskOctet + 1], view[maskOctet + 2], view[maskOctet + 3]] : null,
			PAYLOAD: (view[1] >> 7) ? view.slice(maskOctet + 4) : view.slice(maskOctet)
		};
		if (frame.MASKED) {
			frame.PAYLOAD_UNMASKED = new Uint8Array(frame.PAYLOAD.byteLength);
			for (var i = 0; i < frame.PAYLOAD.byteLength; i++) {
				frame.PAYLOAD_UNMASKED[i] = frame.PAYLOAD[i] ^ frame.MASK[i % 4];
			}
		} else frame.PAYLOAD_UNMASKED = frame.PAYLOAD;
		if (!frame.FIN) {
			// Concatenate data
			if (this.#lastFrame) {
				var concatView = new Uint8Array(this.#lastFrame.PAYLOAD_UNMASKED.byteLength + frame.PAYLOAD_UNMASKED.byteLength);
				concatView.set(this.#lastFrame.PAYLOAD_UNMASKED, 0);
				concatView.set(frame.PAYLOAD_UNMASKED, this.#lastFrame.PAYLOAD_UNMASKED.byteLength);
				this.#lastFrame.PAYLOAD_UNMASKED = concatView;
			}
		} else {
			if (this.#lastFrame) {
				var concatView = new Uint8Array(this.#lastFrame.PAYLOAD_UNMASKED.byteLength + frame.PAYLOAD_UNMASKED.byteLength); concatView.set(this.#lastFrame.PAYLOAD_UNMASKED, 0); concatView.set(frame.PAYLOAD_UNMASKED, this.#lastFrame.PAYLOAD_UNMASKED.byteLength);

				var lastOpCode = this.#lastFrame.OPCODE;
				this.#lastFrame = undefined;
				switch (lastOpCode) {
					case 0x1:
						this.emit('packet', new TextDecoder().decode(concatView));
						break;
					case 0x2:
						this.emit('packet', Serializer.decode(concatView));
						break;
				}
			} else {
				switch (frame.OPCODE) {
					case 0x1:
						this.emit('packet', new TextDecoder().decode(frame.PAYLOAD_UNMASKED));
						break;
					case 0x2:
						this.emit('packet', Serializer.decode(frame.PAYLOAD_UNMASKED.buffer));
						break;
					case 0x8:
						if (this.#closePacket) this.#socket.end();
						else {
							this.#closePacket = frame;
							this.#socket.end(this.#createFrame({
								OPCODE: 0x8,
								PAYLOAD: frame.PAYLOAD_UNMASKED,
								LEN: frame.PAYLOAD.byteLength
							}));
						}
						break;
					case 0x9:
						this.#socket.write(this.#createFrame({ OPCODE: 0xA }));
						break;
					case 0xA:
						this.ping = (performance.now() - this.#pingSent) / 2;
						break;
				}
			}
		}
	}

	connected() { return this.#socket.readyState === 'open' }

	sendPacket(data) {
		if (!this.connected()) return;

		let encoded = Serializer.encode(data);
		this.#socket.write(this.#createFrame({
			OPCODE: 0x2,
			PAYLOAD: new Uint8Array(encoded),
			LEN: encoded.byteLength
		}));
	}

	disconnect(code, reason) {
		code = code || 1000;
		reason = reason || '';

		let reasonEncoded = new TextEncoder().encode(reason);
		let payload = new Uint8Array(2 + reasonEncoded.byteLength);
		payload[0] = code >> 8;
		payload[1] = code & 0xFF;
		if (reason.length > 0) payload.set(reasonEncoded, 2);
		let view = this.#createFrame({
			OPCODE: 0x8,
			PAYLOAD: payload,
			LEN: payload.byteLength
		});
		this.#closePacket = this.#parseFrame(view.buffer);
	}
}

class Server extends EventEmitter {
	#httpServer;
	#opts;
	clients = [];

	#initListener() {
		this.#httpServer.on('upgrade', (req, socket) => {
			socket.on('error', () => {});
			
			if (this.#opts.path !== parse(req.url).pathname || req.headers['upgrade'].toLowerCase() !== 'websocket') return req.destroy();

			let accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + wsMagicString).digest('base64');

			socket.write('HTTP/1.1 101 WebSocket handshake\r\n' +
				'Connection: Upgrade\r\n' +
				'Upgrade: WebSocket\r\n' +
				'Sec-WebSocket-Accept: ' +
				accept + '\r\n' +
				'\r\n');
			let client = new ServerClient(socket);
			this.clients.push(client);
			socket.onclose = () => this.clients.splice(this.clients.indexOf(client), 1);
			this.emit('client', client);
		});
	}

	listen(opts) {
		if (typeof opts !== 'object') opts = {};
		opts = Object.assign(defaultOpts, opts);

		if (opts.server) this.#httpServer = opts.server;
		else {
			if (opts.sslKey && opts.sslCert) {
				this.#httpServer = https.createServer({
					key: opts.sslKey,
					cert: opts.sslCert
				});
				if (!opts.port) opts.port = 443;
			} else {
				this.#httpServer = http.createServer();
				if (!opts.port) opts.port = 80;
			}
		}
		if (!this.#httpServer.listening) this.#httpServer.listen(opts.port || 80);
		this.#opts = opts;
		this.#initListener();
	}

	close() {
		this.clients.forEach(client => {
			client.disconnect(1002);
		});
		this.#httpServer.close();
	}

}

module.exports = Server;
