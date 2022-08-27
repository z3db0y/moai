const Serializer = require('../Serializer');
const { pack, unpack } = require('msgpackr');
const sampleObject = [1, 2, 3, 4, {a:'b', '(_':'+'}];

const start = performance.now();
const result = Serializer.decode(Serializer.encode(sampleObject));
const time = (performance.now() - start);
const startN = performance.now();
const resultN = unpack(pack(sampleObject));
const timeN = (performance.now() - startN);
console.log('Process took', time, 'ms');
console.log('msgpackr equivalent took', timeN, 'ms');
console.log('Output:', result);
console.log('Msgpackr output:', resultN);