class Serializer {
    static DATA_TYPES = {
        NULL: 0x0,
        TRUE: 0x1,
        FALSE: 0x2,
        STRING: 0x3,
        NUMBER: 0x4,
        ARRAY: 0x5,
        OBJECT: 0x6
    }

    static encode(data) {
        let dataType = 0x0;
        switch (typeof data) {
            case 'number':
                //if(Number.isSafeInteger(data)) dataType = Serializer.DATA_TYPES.INT;
                //else dataType = Serializer.DATA_TYPES.DOUBLE;
                dataType = Serializer.DATA_TYPES.NUMBER;
                break;
            case 'string':
                dataType = 0x3;
                break;
            case 'boolean':
                if (data) dataType = Serializer.DATA_TYPES.TRUE;
                else dataType = Serializer.DATA_TYPES.FALSE;
                break;
            case 'object':
                if (Array.isArray(data)) dataType = Serializer.DATA_TYPES.ARRAY;
                else if (data) dataType = Serializer.DATA_TYPES.OBJECT;
                break;
            case 'function':
                throw new Error('Unable to serialize function.');
                break;
            case 'bigint':
                throw new Error('BigINTegers are not supported yet');
                break;
        }

        switch (dataType) {
            case 0x0:
                return new ArrayBuffer(1);
            case 0x1:
            case 0x2:
                var buf = new ArrayBuffer(1);
                new Uint8Array(buf)[0] = dataType;
                return buf;
            case 0x3:
                var stringEncoded = new TextEncoder().encode(data);
                var buf = new ArrayBuffer(stringEncoded.byteLength + 2);
                var view = new Uint8Array(buf);
                view[0] = 0x3;
                view.set(new Uint8Array(stringEncoded), 1);
                view[view.byteLength - 1] = 0x3;
                return buf;
            case 0x4:
                var buf = new ArrayBuffer(9);
                var view = new Uint8Array(buf);
                view[0] = 0x4;
                var buf2 = new Float64Array([data]).buffer;
                view.set(new Uint8Array(buf2), 1);
                return buf;
            case 0x5:
                var buf = new ArrayBuffer(1);
                new Uint8Array(buf)[0] = 0x5;
                for (var el of data) {
                    var enc = Serializer.encode(el);
                    var newBuf = new ArrayBuffer(buf.byteLength + enc.byteLength);

                    var view = new Uint8Array(newBuf);

                    view.set(new Uint8Array(buf), 0);
                    view.set(new Uint8Array(enc), buf.byteLength);
                    buf = newBuf;
                }
                var finalBuf = new ArrayBuffer(buf.byteLength + 1);
                var view = new Uint8Array(finalBuf);
                view.set(new Uint8Array(buf), 0);
                view[buf.byteLength] = 0x5;
                return finalBuf;
            case 0x6:
                var buf = new ArrayBuffer(1);
                new Uint8Array(buf)[0] = 0x6;
                for (var k in data) {
                    var ke = Serializer.encode(k);
                    var ve = Serializer.encode(data[k]);

                    var newBuf = new ArrayBuffer(buf.byteLength + ke.byteLength + ve.byteLength);
                    var view = new Uint8Array(newBuf);
                    view.set(new Uint8Array(buf), 0);
                    view.set(new Uint8Array(ke), buf.byteLength);
                    view.set(new Uint8Array(ve), buf.byteLength + ke.byteLength);
                    buf = newBuf;
                }
                var finalBuf = new ArrayBuffer(buf.byteLength + 1);
                var view = new Uint8Array(finalBuf);
                view.set(new Uint8Array(buf), 0);
                view[buf.byteLength] = 0x6;
                return finalBuf;
        }
    }

    static decode(data) {
        if (!(data instanceof ArrayBuffer)) throw new Error('data must be an instance of ArrayBuffer');
        let view = new Uint8Array(data);

        function findLen(v) {
            switch (v[0]) {
                case 0x0:
                case 0x1:
                case 0x2:
                    return 1;
                case 0x4: return 9;
                case 0x3:
                case 0x5:
                case 0x6:
                    return 2 + v.slice(1).indexOf(v[0]);
            }
        }

        switch (view[0]) {
            case 0x0: return null;
            case 0x1: return true;
            case 0x2: return false;
            case 0x3: return new TextDecoder().decode(data.slice(1, -1));
            case 0x4: return new Float64Array(data.slice(1))[0];
            case 0x5:
                // TODO: implement array decoding.
                view = view.slice(1, -1);
                var decoded = [];
                while (view.byteLength > 0) {
                    var len = findLen(view);
                    var el = view.slice(0, len).buffer;
                    view = view.slice(len);

                    decoded.push(Serializer.decode(el));
                }
                return decoded;
            case 0x6:
                // TODO: implement object decoding.
                view = view.slice(1, -1);
                var decoded = {};
                var pendingKey;
                while (view.byteLength > 0) {
                    var len = findLen(view); var el = view.slice(0, len).buffer; view = view.slice(len);

                    if (pendingKey) {
                        decoded[pendingKey] = Serializer.decode(el);
                        pendingKey = null;
                    } else {
                        pendingKey = Serializer.decode(el);
                    }
                }
                return decoded;
        }
    }
}

if (typeof window !== 'undefined') window.Serializer = Serializer;
else module.exports = Serializer;
