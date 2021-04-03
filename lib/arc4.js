var crypto = require('crypto');

var Arc4 = function(key) {
    this.key = Buffer.from(key, 'hex');
};

Arc4.prototype.crypt = Arc4.prototype.decrypt = function(plain) {
    if (typeof plain === 'string') {
        console.log('string to buff', plain);
        plain = Buffer.from(plain, 'hex');
    }

    var cipher = crypto.createCipheriv('rc4', this.key, '');

    return cipher.update(plain);
};

module.exports = Arc4;
