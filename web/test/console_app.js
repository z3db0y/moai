class ConsoleApp extends require('events').EventEmitter {

	constructor(prefix) {
		super();
		let oWrite = process.stdout.write;

		process.stdin.on('data', (data) => {
			data = data.toString().trim();
			oWrite.call(process.stdout, prefix);
			this.emit('data', data);
		});

		process.stdout.write = new Proxy(oWrite, {
			apply: function (target, thisArg, args) {
				oWrite.call(process.stdout, '\b'.repeat(256));
				oWrite.apply(process.stdout, args);
				oWrite.call(process.stdout, prefix);
			}
		});
		oWrite.call(process.stdout, prefix);

		let oLog = console.log;
		function timestamp() {
			let d = new Date();
			return d.getHours().toString().padStart(2, '0') + ':' +
				d.getMinutes().toString().padStart(2, '0') + ':' +
				d.getSeconds().toString().padStart(2, '0');
		}
	}
}

module.exports = ConsoleApp;