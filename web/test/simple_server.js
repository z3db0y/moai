const Server = require('../Server');
const ConsoleApp = require('./console_app');
let server = new Server();
server.listen({ port: 8080 });

function uuidv4() {
    let values = '0123456789abcdef';
    let uuid = 'xxxxxxxx-xxxx-4xxx-1xxx-xxxxxxxxxxxx';
    uuid = uuid.replaceAll('x', () => values.charAt(Math.floor(Math.random() * values.length)));
    return uuid;
}

console.log('Server listening.');
console.log('Type \'help\' for help.');
server.on('client', client => {
    client.uuid = uuidv4();
    client.sendPacket('Your UUID is ' + client.uuid);
    console.log('Client connected:', client.uuid);
    client.on('disconnect', (ev) => console.log('Client disconnected:', ev));
    client.on('packet', (data) => console.log('Message from client:', data));
});

let app = new ConsoleApp('> ');
app.on('data', (data) => {
    let cmd = data.split(' ')[0].toLowerCase();
	let args = data.split(' ').slice(1);

	switch (cmd) {
		case 'help':
			console.log('Available commands:\n' +
				'• help\n' +
                '• list\n' +
				'• kick\n' +
				'• exit'
			);
			break;
        case 'list':
            console.log('Connected clients:\n' + server.clients.map(x => '• ' + x.uuid).join('\n'));
            break;
			case 'kick':
				if(args[0] && server.clients.find(x => x.uuid === args[0])) {
					server.clients.find(x => x.uuid === args[0]).disconnect(1001, 'Kicked by server');
					console.log('Kicked', args[0]);
				} else console.log('No such client.');
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