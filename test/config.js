const path = require('path');
const fs = require('fs');

const currentDate = new Date();
const testDir = path.resolve(__dirname);
const dbName = 'test-' + currentDate.getTime() + '.fdb';

const config = {
    database: path.join(process.env.FIREBIRD_DATA || testDir, dbName),
    host: '127.0.0.1',
    port: 3050,
    user: 'SYSDBA',
    password: 'masterkey',
    role: null,
    pageSize: 4096,
    timeout: 3000,
    lowercase_keys: true,
    retryConnectionInterval: 100,
};

// Determine if in local environment
config.localEnvironment = localEnvironement();

exports.default = config;
exports.currentDate = currentDate;
exports.testDir = testDir;

exports.extends = function(base, args) {
    return Object.assign({}, base, args);
};

/**
 * Check if node-firebird tests run in local environment.
 */
function localEnvironement() {
    return (config.host === '127.0.0.1' || config.host === 'localhost') && !fs.existsSync('/.dockerenv');
}

