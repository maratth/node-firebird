var Arc4 = require('../lib/arc4');
var assert = require('assert');

describe('Arc4', function() {
    const KEY = Buffer.from('a key', 'utf8');
    const PLAIN_TEXT = Buffer.from('plain text', 'utf8');
    const CRYPT_TEXT = Buffer.from('4b4bdc6502b308174882', 'hex');

    it('should encode', function(done) {
        var encoder = new Arc4(KEY);

        assert.ok(encoder.crypt(PLAIN_TEXT).equals(CRYPT_TEXT));
        done();
    });

    it('should decode', function(done) {
        var decoder = new Arc4(KEY);

        assert.ok(decoder.decrypt(CRYPT_TEXT).equals(PLAIN_TEXT))
        done();
    });

    it('should manual test', function (done) {
        var arc4 = new Arc4('611de047e2b6a10744aa16cb60f1fa3e828ca5cf');

        const t = arc4.decrypt(Buffer.from('6400d9cd', 'hex'));
        console.log(t.toString('hex'));
        assert.ok(t.toString('hex') === '00000009')
        done();
    });
});
