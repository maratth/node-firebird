var Long = require('long');

class Reader {

    constructor(buffer) {
        this.buffer = buffer;
        this.pos = 0
    }

    align(n) {
        return (n + 3) & ~3;
    }

}

class Writer extends Reader {

    constructor(size) {
        super(Buffer.alloc(size || 32));
    }

    ensure(len) {
        var newlen = this.buffer.length;

        while (newlen < this.pos + len)
            newlen *= 2

        if (this.buffer.length >= newlen)
            return;

        var b = Buffer.alloc(newlen);
        this.buffer.copy(b);
        delete(this.buffer);
        this.buffer = b;
    }

}

/***************************************
 *
 *   BLR Writer
 *
 ***************************************/

const
    MAX_STRING_SIZE = 255;

class BlrWriter extends Writer {

    constructor(size) {
        super(size);
    }

    addByte(b) {
        this.ensure(1);
        this.buffer.writeUInt8(b, this.pos);
        this.pos++;
    }

    addShort(b) {
        this.ensure(1);
        this.buffer.writeInt8(b, this.pos);
        this.pos++;
    }

    addSmall(b) {
        this.ensure(2);
        this.buffer.writeInt16LE(b, this.pos);
        this.pos += 2;
    }

    addWord(b) {
        this.ensure(2);
        this.buffer.writeUInt16LE(b, this.pos);
        this.pos += 2;
    }

    addInt32(b) {
        this.ensure(4);
        this.buffer.writeUInt32LE(b, this.pos);
        this.pos += 4;
    }

    addByteInt32(c, b) {
        this.addByte(c);
        this.ensure(4);
        this.buffer.writeUInt32LE(b, this.pos);
        this.pos += 4;
    }

    addNumeric(c, v) {
        if (v < 256){
            this.ensure(3);
            this.buffer.writeUInt8(c, this.pos);
            this.pos++;
            this.buffer.writeUInt8(1, this.pos);
            this.pos++;
            this.buffer.writeUInt8(v, this.pos);
            this.pos++;
            return;
        }

        this.ensure(6);
        this.buffer.writeUInt8(c, this.pos);
        this.pos++;
        this.buffer.writeUInt8(4, this.pos);
        this.pos++;
        this.buffer.writeInt32BE(v, this.pos);
        this.pos += 4;
    }

    addBytes(b) {

        this.ensure(b.length);
        for (var i = 0, length = b.length; i < length; i++) {
            this.buffer.writeUInt8(b[i], this.pos);
            this.pos++;
        }
    }

    addString(c, s, encoding) {
        this.addByte(c);

        var len = Buffer.byteLength(s, encoding);
        if (len > MAX_STRING_SIZE)
            throw new Error('blr string is too big');

        this.ensure(len + 1);
        this.buffer.writeUInt8(len, this.pos);
        this.pos++;
        this.buffer.write(s, this.pos, len, encoding);
        this.pos += len;
    }

    addBuffer(b) {
        this.addSmall(b.length);
        this.ensure(b.length);
        b.copy(this.buffer, this.pos);
        this.pos += b.length;
    }

    addString2(c, s, encoding) {
        this.addByte(c);

        var len = Buffer.byteLength(s, encoding);
        if (len > MAX_STRING_SIZE* MAX_STRING_SIZE)
            throw new Error('blr string is too big');

        this.ensure(len + 2);
        this.buffer.writeUInt16LE(len, this.pos);
        this.pos += 2;
        this.buffer.write(s, this.pos, len, encoding);
        this.pos += len;
    }

    addMultiblockPart(c, s, encoding) {
        var buff = Buffer.from(s, encoding);
        var remaining = buff.length;
        var step = 0;

        while (remaining > 0) {
            var toWrite = Math.min(remaining, 254);

            this.addByte(c);
            this.addByte(toWrite + 1);
            this.addByte(step);

            this.ensure(toWrite);
            buff.copy(this.buffer, this.pos, step * 254, (step * 254) + toWrite);

            step++;
            remaining -= toWrite;
            this.pos += toWrite;
        }
    }
    
}

/***************************************
 *
 *   BLR Reader
 *
 ***************************************/

class BlrReader extends Reader {

    constructor(buffer) {
        super(buffer);
    }

    readByteCode(){
        return this.buffer.readUInt8(this.pos++);
    }

    readInt32() {
        var value = this.buffer.readUInt32LE(this.pos);
        this.pos += 4;
        return value;
    }

    readInt(){
        var len = this.buffer.readUInt16LE(this.pos);
        this.pos += 2;
        var value;
        switch (len) {
            case 1:
                value = this.buffer.readInt8(this.pos);
                break;
            case 2:
                value = this.buffer.readInt16LE(this.pos);
                break;
            case 4:
                value = this.buffer.readInt32LE(this.pos)
        }
        this.pos += len;
        return value;
    }

    readString(encoding){
        var len = this.buffer.readUInt16LE(this.pos);
        var str;

        this.pos += 2;
        if (len <= 0)
            return '';

        str = this.buffer.toString(encoding, this.pos, this.pos + len);
        this.pos += len;
        return str;
    }

    readSegment() {
        var ret, tmp;
        var len = this.buffer.readUInt16LE(this.pos);

        this.pos += 2;

        while (len > 0) {

            if (ret) {
                tmp = ret;
                ret = Buffer.alloc(tmp.length + len);
                tmp.copy(ret);
                this.buffer.copy(ret, tmp.length, this.pos, this.pos + len);
            } else {
                ret = Buffer.alloc(len);
                this.buffer.copy(ret, 0, this.pos, this.pos + len);
            }

            this.pos += len;

            if (this.pos === this.buffer.length)
                break;

            len = this.buffer.readUInt16LE(this.pos);
            this.pos += 2;
        }

        return ret ? ret : Buffer.alloc(0);
    }

}

/***************************************
 *
 *   XDR Writer
 *
 ***************************************/

class XdrWriter extends Writer {
    
    constructor(size) {
        super(size);
    }

    addInt(value) {
        this.ensure(4);
        this.buffer.writeInt32BE(value, this.pos);
        this.pos += 4;
    }

    addInt64(value) {
        this.ensure(8);
        var l = Long.fromNumber(value);
        this.buffer.writeInt32BE(l.high, this.pos);
        this.pos += 4;
        this.buffer.writeInt32BE(l.low, this.pos);
        this.pos += 4;
    }

    addInt128(value) {
        this.ensure(16);

        const bigValue = BigInt(value);

        const high = bigValue >> BigInt(64);
        const low = bigValue & BigInt("0xFFFFFFFFFFFFFFFF");

        this.buffer.writeBigUInt64BE(high, this.pos);
        this.pos += 8;
        this.buffer.writeBigUInt64BE(low, this.pos);
        this.pos += 8;
    }

    addUInt(value) {
        this.ensure(4);
        this.buffer.writeUInt32BE(value, this.pos);
        this.pos += 4;
    }

    addString(s, encoding) {
        var len = Buffer.byteLength(s, encoding);
        var alen = this.align(len);
        this.ensure(alen + 4);
        this.buffer.writeInt32BE(len, this.pos);
        this.pos += 4;
        this.buffer.write(s, this.pos, len, encoding);
        this.pos += alen;
    }

    addText(s, encoding) {
        var len = Buffer.byteLength(s, encoding);
        var alen = this.align(len);
        this.ensure(alen);
        this.buffer.write(s, this.pos, len, encoding);
        this.pos += alen;
    }

    addBlr(blr) {
        var alen = this.align(blr.pos);
        this.ensure(alen + 4);
        this.buffer.writeInt32BE(blr.pos, this.pos);
        this.pos += 4;
        blr.buffer.copy(this.buffer, this.pos);
        this.pos += alen;
    }

    getData() {
        return this.buffer.slice(0, this.pos);
    }

    addDouble(value) {
        this.ensure(8);
        this.buffer.writeDoubleBE(value, this.pos);
        this.pos += 8;
    }

    addQuad(quad) {
        this.ensure(8);
        var b = this.buffer;
        b.writeInt32BE(quad.high, this.pos);
        this.pos += 4;
        b.writeInt32BE(quad.low, this.pos);
        this.pos += 4;
    }

    addBuffer(buffer) {
        this.ensure(buffer.length);
        buffer.copy(this.buffer, this.pos, 0, buffer.length);
        this.pos += buffer.length;
    }

    addAlignment(len) {
        var alen = (4 - len) & 3;

        this.ensure(alen);
        this.buffer.write('ffffff', this.pos, alen, 'hex');
        this.pos += alen;
    }
    
}

/***************************************
 *
 *   XDR Reader
 *
 ***************************************/

class XdrReader extends Reader {
    
    constructor(buffer) {
        super(buffer);
    }

    readInt() {
        var r = this.buffer.readInt32BE(this.pos);
        this.pos += 4;
        return r;
    }

    readUInt() {
        var r = this.buffer.readUInt32BE(this.pos);
        this.pos += 4;
        return r;
    }

    readInt64() {
        var high = this.buffer.readInt32BE(this.pos);
        this.pos += 4;
        var low = this.buffer.readInt32BE(this.pos);
        this.pos += 4;
        return new Long(low, high).toNumber();
    }

    readInt128() {
        var high = this.buffer.readBigUInt64BE(this.pos)
        this.pos += 8

        var low = this.buffer.readBigUInt64BE(this.pos)
        this.pos += 8

        return (BigInt(high) << BigInt(64)) + BigInt(low)
    }

    readShort() {
        var r = this.buffer.readInt16BE(this.pos);
        this.pos += 2;
        return r;
    }

    readQuad() {
        var b = this.buffer;
        var high = b.readInt32BE(this.pos);
        this.pos += 4;
        var low = b.readInt32BE(this.pos);
        this.pos += 4;
        return {low: low, high: high}
    }

    readFloat() {
        var r = this.buffer.readFloatBE(this.pos);
        this.pos += 4;
        return r;
    }

    readDouble() {
        var r = this.buffer.readDoubleBE(this.pos);
        this.pos += 8;
        return r;
    }

    readArray() {
        var len = this.readInt();
        if (!len)
            return;
        var r = this.buffer.slice(this.pos, this.pos + len);
        this.pos += this.align(len);
        return r;
    }

    readBuffer(len, toAlign = true) {
        if (!arguments.length) {
            len = this.readInt();
        }

        if (len !== null && len !== undefined) {

            if (len <= 0){
                return Buffer.alloc(0);
            }

            var r = this.buffer.slice(this.pos, this.pos + len);
            this.pos += toAlign ? this.align(len) : len;
            return r;
        }
    }

    readString(encoding) {
        var len = this.readInt();
        return this.readText(len, encoding);
    }

    readText(len, encoding) {
        if (len <= 0)
            return '';

        var r = this.buffer.toString(encoding, this.pos, this.pos + len);
        this.pos += this.align(len);
        return r;
    }
    
}

/***************************************
 *
 *   BitSet
 *
 ***************************************/
var WORD_LOG = 5;
var BUFFER_BITS = 8;
var BIT_ON = 1;
var BIT_OFF = 0;

class BitSet {
    
    constructor(buffer) {
        this.data = [];

        if (buffer) {
            this.scale(buffer.length * BUFFER_BITS);

            for (var i = 0; i < buffer.length; i++) {
                var n = buffer[i];

                for (var j = 0; j < BUFFER_BITS; j++) {
                    var k = i * BUFFER_BITS + j;
                    this.data[k >>> WORD_LOG] |= (n >> j & BIT_ON) << k;
                }
            }
        }
    }

    scale(index) {
        var l = index >>> WORD_LOG;

        for (var i = this.data.length; l >= i; l--) {
            this.data.push(BIT_OFF);
        }
    }

    set(index, value) {
        let pos = index >>> 3;

        for (let i = this.data.length; pos >= i; pos--) {
            this.data.push(BIT_OFF);
        }

        pos = index >>> 3;

        if (value === undefined || value) {
            this.data[pos] |= (1 << (index % BUFFER_BITS));
        } else {
            this.data[pos] &= ~(1 << (index % BUFFER_BITS));
        }
    }

    get(index) {
        var n = index >>> WORD_LOG;

        if (n >= this.data.length) {
            return BIT_OFF;
        }

        return (this.data[n] >>> index) & BIT_ON;
    }

    toBuffer() {
        return Buffer.from(this.data);
    }
    
}

module.exports = {
    BitSet,
    BlrReader,
    BlrWriter,
    XdrReader,
    XdrWriter,
};
