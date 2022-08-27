const ConsoleApp = require('./console_app');
let app = new ConsoleApp('> ');

console.log('Welcome to the console client!')
console.log('Type \'help\' for help.');

const Client = require('../Client');
let client = new Client();
client.on('packet', (data) => {
	console.log('Message from server:', data);
});
app.on('data', data => {
	let cmd = data.split(' ')[0].toLowerCase();
	let args = data.split(' ').slice(1);

	switch (cmd) {
		case 'help':
			console.log('Available commands:\n' +
				'• help\n' +
				'• connect\n' +
				'• disconnect\n' +
				'• send\n' +
				'• exit'
			);
			break;
		case 'connect':
			if (args[0]) {
				client.connect(args[0], (s) => s ? console.log('Connected to', args[0]) : console.log('Failed to connect to', args[0]));
			} else console.log('Please provide the server you wish to connect to.');
			break;
		case 'connected':
			console.log(client.connected());
			break;
		case 'send':
			try {
				client.sendPacket(args.join(' '));
			} catch(err) { console.log(err.message); }
			break;
		case 'disconnect':
			try {
				client.disconnect();
				console.log('Disconnected from server.');
			} catch(err) { console.log(err.message); }
			break;
		case 'exit':
			process.exit(0);
		case '':
			break;
		default:
			console.log('Unknown command. Type \'help\' for help.');
			break;
	}
});
