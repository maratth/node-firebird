/**
 * Unit tests for the Firebird Batch API (protocol 16+)
 * Tests: constants, buildBPB, encodeBatchField, _executeBatchFallback,
 *        Connection/Transaction/Database.executeBatch
 */

const Const = require('../lib/wire/const');
const { XdrWriter, XdrReader } = require('../lib/wire/serialize');
const Connection = require('../lib/wire/connection');
const Transaction = require('../lib/wire/transaction');
const Database = require('../lib/wire/database');

const { buildBPB, encodeBatchField } = Connection;

// Encode a single field and return an XdrReader positioned at the start
function encodeField(value, meta) {
    const msg = new XdrWriter(256);
    encodeBatchField(msg, value, meta);
    return new XdrReader(msg.getData());
}

// Wrap a callback-based call in a Promise
function callbackToPromise(fn) {
    return new Promise((resolve, reject) => {
        fn((err, ...args) => err ? reject(err) : resolve(args.length <= 1 ? args[0] : args));
    });
}

// ─────────────────────────────────────────────────────────────────────────────
describe('Batch API – constants', function () {
    it('should define batch op codes with correct values', function () {
        expect(Const.op_batch_create).toBe(112);
        expect(Const.op_batch_msg).toBe(113);
        expect(Const.op_batch_exec).toBe(114);
        expect(Const.op_batch_rls).toBe(115);
        expect(Const.op_batch_cs_response).toBe(120);
    });

    it('should define BATCH_TAG_* constants', function () {
        expect(Const.BATCH_TAG_MULTIERROR).toBe(1);
        expect(Const.BATCH_TAG_RECORD_COUNTS).toBe(2);
        expect(Const.BATCH_TAG_BUFFER_BYTES_SIZE).toBe(3);
        expect(Const.BATCH_TAG_BLOBS_NONE).toBe(4);
        expect(Const.BATCH_TAG_BLOB_ID).toBe(5);
        expect(Const.BATCH_TAG_DETAILED_ERRORS).toBe(6);
        expect(Const.BATCH_TAG_INLINE_BLOBS).toBe(7);
    });

    it('should define BATCH_EXECUTE_FAILED and BATCH_EXECUTE_UNKNOWN', function () {
        expect(Const.BATCH_EXECUTE_FAILED).toBe(-1);
        expect(Const.BATCH_EXECUTE_UNKNOWN).toBe(-2);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// BPB layout (22 bytes):
//   [0]        version = 0x01
//   [1..7]     TAG_MULTIERROR   : tag(1) + len(2 LE) + value(4 LE)
//   [8..14]    TAG_RECORD_COUNTS: tag(1) + len(2 LE) + value(4 LE)
//   [15..21]   TAG_BUFFER_BYTES_SIZE: tag(1) + len(2 LE) + value(4 LE)
describe('buildBPB', function () {
    it('should return a Buffer of 22 bytes', function () {
        const bpb = buildBPB({});
        expect(Buffer.isBuffer(bpb)).toBe(true);
        expect(bpb.length).toBe(22);
    });

    it('should start with version byte 0x01', function () {
        expect(buildBPB({})[0]).toBe(0x01);
    });

    it('should encode TAG_MULTIERROR tag at offset 1', function () {
        expect(buildBPB({})[1]).toBe(Const.BATCH_TAG_MULTIERROR);
    });

    it('should encode multierror=1 by default', function () {
        const bpb = buildBPB({});
        // value is 4 bytes LE starting at offset 4
        expect(bpb.readUInt32LE(4)).toBe(1);
    });

    it('should encode multierror=0 when multierror:false', function () {
        expect(buildBPB({ multierror: false }).readUInt32LE(4)).toBe(0);
    });

    it('should encode multierror=1 when multierror:true', function () {
        expect(buildBPB({ multierror: true }).readUInt32LE(4)).toBe(1);
    });

    it('should encode TAG_RECORD_COUNTS=1 (always enabled)', function () {
        const bpb = buildBPB({});
        expect(bpb[8]).toBe(Const.BATCH_TAG_RECORD_COUNTS);
        // value 4 bytes LE at offset 11
        expect(bpb.readUInt32LE(11)).toBe(1);
    });

    it('should encode TAG_BUFFER_BYTES_SIZE tag at offset 15', function () {
        expect(buildBPB({})[15]).toBe(Const.BATCH_TAG_BUFFER_BYTES_SIZE);
    });

    it('should encode TAG_BUFFER_BYTES_SIZE default 16 MB', function () {
        // value 4 bytes LE at offset 18
        expect(buildBPB({}).readUInt32LE(18)).toBe(16 * 1024 * 1024);
    });

    it('should encode custom bufferSize in little-endian', function () {
        expect(buildBPB({ bufferSize: 4096 }).readUInt32LE(18)).toBe(4096);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('encodeBatchField', function () {
    describe('SQL_SHORT / SQL_LONG', function () {
        it('should encode an integer value with null=0', function () {
            const r = encodeField(42, { type: Const.SQL_SHORT });
            expect(r.readInt()).toBe(42);
            expect(r.readInt()).toBe(0);
        });

        it('should encode null with null indicator=1', function () {
            const r = encodeField(null, { type: Const.SQL_LONG });
            expect(r.readInt()).toBe(0);
            expect(r.readInt()).toBe(1);
        });

        it('should truncate float to integer', function () {
            const r = encodeField(3.9, { type: Const.SQL_SHORT });
            expect(r.readInt()).toBe(3);
        });
    });

    describe('SQL_FLOAT', function () {
        it('should encode a float value with null=0', function () {
            const r = encodeField(1.5, { type: Const.SQL_FLOAT });
            expect(r.readFloat()).toBeCloseTo(1.5, 5);
            expect(r.readInt()).toBe(0);
        });

        it('should encode null with null indicator=1', function () {
            const r = encodeField(null, { type: Const.SQL_FLOAT });
            r.readFloat();
            expect(r.readInt()).toBe(1);
        });
    });

    describe('SQL_DOUBLE', function () {
        it('should encode a double with null=0', function () {
            const r = encodeField(3.14159265358979, { type: Const.SQL_DOUBLE });
            expect(r.readDouble()).toBeCloseTo(3.14159265358979, 14);
            expect(r.readInt()).toBe(0);
        });

        it('should encode null with null indicator=1', function () {
            const r = encodeField(null, { type: Const.SQL_DOUBLE });
            r.readDouble();
            expect(r.readInt()).toBe(1);
        });
    });

    describe('SQL_INT64', function () {
        it('should encode a 64-bit integer', function () {
            const r = encodeField(1234567890, { type: Const.SQL_INT64 });
            expect(r.readInt64()).toBe(1234567890);
            expect(r.readInt()).toBe(0);
        });

        it('should encode null', function () {
            const r = encodeField(null, { type: Const.SQL_INT64 });
            r.readInt64();
            expect(r.readInt()).toBe(1);
        });
    });

    describe('SQL_BOOLEAN', function () {
        it('should encode true as 1', function () {
            const r = encodeField(true, { type: Const.SQL_BOOLEAN });
            expect(r.readInt()).toBe(1);
            expect(r.readInt()).toBe(0);
        });

        it('should encode false as 0', function () {
            const r = encodeField(false, { type: Const.SQL_BOOLEAN });
            expect(r.readInt()).toBe(0);
            expect(r.readInt()).toBe(0);
        });

        it('should encode null', function () {
            const r = encodeField(null, { type: Const.SQL_BOOLEAN });
            expect(r.readInt()).toBe(0);
            expect(r.readInt()).toBe(1);
        });
    });

    describe('SQL_BLOB / SQL_ARRAY / SQL_QUAD', function () {
        it('should encode a blob OID {high, low}', function () {
            const r = encodeField({ high: 1, low: 42 }, { type: Const.SQL_BLOB });
            expect(r.readInt()).toBe(1);
            expect(r.readInt()).toBe(42);
            expect(r.readInt()).toBe(0);
        });

        it('should encode null blob as zeros with null=1', function () {
            const r = encodeField(null, { type: Const.SQL_BLOB });
            expect(r.readInt()).toBe(0);
            expect(r.readInt()).toBe(0);
            expect(r.readInt()).toBe(1);
        });
    });

    describe('SQL_TEXT (CHAR – fixed length)', function () {
        it('should write padded buffer of declared length', function () {
            const maxLen = 8;
            const r = encodeField('Hi', { type: Const.SQL_TEXT, length: maxLen });
            const buf = r.readBuffer(maxLen); // reads maxLen bytes, aligns
            expect(buf.toString('utf8', 0, 2)).toBe('Hi');
            expect(buf[2]).toBe(0x20); // space padding
            expect(r.readInt()).toBe(0);
        });

        it('should truncate values exceeding declared length', function () {
            const maxLen = 4;
            const r = encodeField('Hello', { type: Const.SQL_TEXT, length: maxLen });
            const buf = r.readBuffer(maxLen);
            expect(buf.toString('utf8', 0, 4)).toBe('Hell');
        });

        it('should encode null as all-spaces buffer with null=1', function () {
            const maxLen = 4;
            const r = encodeField(null, { type: Const.SQL_TEXT, length: maxLen });
            const buf = r.readBuffer(maxLen);
            expect(buf.every(b => b === 0x20)).toBe(true);
            expect(r.readInt()).toBe(1);
        });
    });

    describe('SQL_VARYING (VARCHAR)', function () {
        it('should write 2-byte length prefix + data padded to declared length', function () {
            const maxLen = 10;
            const r = encodeField('Test', { type: Const.SQL_VARYING, length: maxLen });
            const buf = r.readBuffer(2 + maxLen);
            const actualLen = buf.readUInt16BE(0);
            expect(actualLen).toBe(4);
            expect(buf.toString('utf8', 2, 2 + actualLen)).toBe('Test');
            expect(r.readInt()).toBe(0);
        });

        it('should encode null as zero bytes with null=1', function () {
            const maxLen = 6;
            const r = encodeField(null, { type: Const.SQL_VARYING, length: maxLen });
            const buf = r.readBuffer(2 + maxLen);
            expect(buf.readUInt16BE(0)).toBe(0);
            expect(r.readInt()).toBe(1);
        });

        it('should truncate values exceeding declared length', function () {
            const maxLen = 3;
            const r = encodeField('Hello', { type: Const.SQL_VARYING, length: maxLen });
            const buf = r.readBuffer(2 + maxLen);
            expect(buf.readUInt16BE(0)).toBe(3);
        });
    });

    describe('SQL_TIMESTAMP', function () {
        it('should encode a Date value', function () {
            const d = new Date('2024-01-15T10:30:00.000Z');
            const r = encodeField(d, { type: Const.SQL_TIMESTAMP });
            const date = r.readInt();
            const time = r.readUInt();
            const nullInd = r.readInt();
            expect(date).toBeGreaterThan(0);
            expect(time).toBeGreaterThanOrEqual(0);
            expect(nullInd).toBe(0);
        });

        it('should encode null timestamp', function () {
            const r = encodeField(null, { type: Const.SQL_TIMESTAMP });
            r.readInt(); r.readUInt();
            expect(r.readInt()).toBe(1);
        });
    });

    describe('SQL_TYPE_DATE', function () {
        it('should encode date days', function () {
            const d = new Date('2000-01-01T00:00:00.000Z');
            const r = encodeField(d, { type: Const.SQL_TYPE_DATE });
            expect(r.readInt()).toBeGreaterThan(0);
            expect(r.readInt()).toBe(0);
        });

        it('should encode null date', function () {
            const r = encodeField(null, { type: Const.SQL_TYPE_DATE });
            r.readInt();
            expect(r.readInt()).toBe(1);
        });
    });

    describe('SQL_TYPE_TIME', function () {
        it('should encode time fractions', function () {
            const d = new Date('2000-01-01T12:00:00.000Z');
            const r = encodeField(d, { type: Const.SQL_TYPE_TIME });
            expect(r.readUInt()).toBeGreaterThanOrEqual(0);
            expect(r.readInt()).toBe(0);
        });

        it('should encode null time', function () {
            const r = encodeField(null, { type: Const.SQL_TYPE_TIME });
            r.readUInt();
            expect(r.readInt()).toBe(1);
        });
    });

    describe('unknown / default type', function () {
        it('should fall through to addInt for unrecognised type', function () {
            const r = encodeField(7, { type: 9999 });
            expect(r.readInt()).toBe(7);
            expect(r.readInt()).toBe(0);
        });

        it('should set null indicator for null value on unknown type', function () {
            const r = encodeField(null, { type: 9999 });
            r.readInt();
            expect(r.readInt()).toBe(1);
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Connection._executeBatchFallback', function () {
    function makeMockCnx(executeStmtFn) {
        return { executeStatement: executeStmtFn };
    }

    it('should return success result when all rows succeed', async function () {
        const cnx = makeMockCnx((txn, stmt, params, cb) => cb(null));
        const result = await callbackToPromise(cb =>
            Connection.prototype._executeBatchFallback.call(cnx, {}, {}, [[1], [2], [3]], cb)
        );
        expect(result.updated).toEqual([1, 1, 1]);
        expect(result.affectedRows).toBe(3);
        expect(result.errors).toHaveLength(0);
        expect(result.hasErrors).toBe(false);
    });

    it('should collect errors and continue when a row fails', async function () {
        let callIdx = 0;
        const cnx = makeMockCnx((txn, stmt, params, cb) => {
            cb(callIdx++ === 1 ? new Error('constraint violation') : null);
        });
        const result = await callbackToPromise(cb =>
            Connection.prototype._executeBatchFallback.call(cnx, {}, {}, [[1], [2], [3]], cb)
        );
        expect(result.updated[0]).toBe(1);
        expect(result.updated[1]).toBe(Const.BATCH_EXECUTE_FAILED);
        expect(result.updated[2]).toBe(1);
        expect(result.affectedRows).toBe(2);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].row).toBe(1);
        expect(result.errors[0].message).toBe('constraint violation');
        expect(result.hasErrors).toBe(true);
    });

    it('should report all rows as failed when all rows error', async function () {
        const cnx = makeMockCnx((txn, stmt, params, cb) => cb(new Error('fail')));
        const result = await callbackToPromise(cb =>
            Connection.prototype._executeBatchFallback.call(cnx, {}, {}, [[1], [2]], cb)
        );
        expect(result.updated).toEqual([Const.BATCH_EXECUTE_FAILED, Const.BATCH_EXECUTE_FAILED]);
        expect(result.affectedRows).toBe(0);
        expect(result.errors).toHaveLength(2);
        expect(result.hasErrors).toBe(true);
    });

    it('should return empty result for empty paramsArray', async function () {
        const cnx = makeMockCnx(() => { throw new Error('should not be called'); });
        const result = await callbackToPromise(cb =>
            Connection.prototype._executeBatchFallback.call(cnx, {}, {}, [], cb)
        );
        expect(result.updated).toEqual([]);
        expect(result.affectedRows).toBe(0);
    });

    it('should normalise non-array params correctly', async function () {
        const received = [];
        const cnx = makeMockCnx((txn, stmt, params, cb) => { received.push(params); cb(null); });
        // 42 → [42], null → [null], undefined → []
        await callbackToPromise(cb =>
            Connection.prototype._executeBatchFallback.call(cnx, {}, {}, [42, null, undefined], cb)
        );
        expect(received[0]).toEqual([42]);
        expect(received[1]).toEqual([null]);
        expect(received[2]).toEqual([]);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Connection.executeBatch', function () {
    it('should return empty result immediately for empty paramsArray', async function () {
        const cnx = {
            _isClosed: false,
            accept: { protocolVersion: Const.PROTOCOL_VERSION16 },
        };
        const result = await callbackToPromise(cb =>
            Connection.prototype.executeBatch.call(cnx, {}, {}, [], {}, cb)
        );
        expect(result.updated).toEqual([]);
        expect(result.affectedRows).toBe(0);
        expect(result.hasErrors).toBe(false);
    });

    it('should call throwClosed when connection is closed', async function () {
        const cnx = {
            _isClosed: true,
            throwClosed: function (cb) { cb(new Error('connection closed')); },
        };
        await expect(callbackToPromise(cb =>
            Connection.prototype.executeBatch.call(cnx, {}, {}, [[1]], {}, cb)
        )).rejects.toThrow(/closed/i);
    });

    it('should fall back to sequential execution for protocol < V16', async function () {
        let fallbackCalled = false;
        const cnx = {
            _isClosed: false,
            accept: { protocolVersion: Const.PROTOCOL_VERSION14 },
            _executeBatchFallback(txn, stmt, params, cb) {
                fallbackCalled = true;
                cb(null, { updated: [1], errors: [], affectedRows: 1, hasErrors: false });
            },
        };
        await callbackToPromise(cb =>
            Connection.prototype.executeBatch.call(
                cnx, {}, { input: [{ type: Const.SQL_LONG }] }, [[1]], {}, cb
            )
        );
        expect(fallbackCalled).toBe(true);
    });

    it('should return an error when statement has no input parameters', async function () {
        const cnx = {
            _isClosed: false,
            accept: { protocolVersion: Const.PROTOCOL_VERSION16 },
        };
        await expect(callbackToPromise(cb =>
            Connection.prototype.executeBatch.call(cnx, {}, { input: [] }, [[1]], {}, cb)
        )).rejects.toThrow(/no input/i);
    });

    it('should propagate BLOB preparation errors', async function () {
        const cnx = {
            _isClosed: false,
            accept: { protocolVersion: Const.PROTOCOL_VERSION16 },
            options: {},
            createBlob2(txn, cb) { cb(new Error('blob creation failed')); },
        };
        const stmt = { input: [{ type: Const.SQL_BLOB }] };
        await expect(callbackToPromise(cb =>
            Connection.prototype.executeBatch.call(cnx, {}, stmt, [[Buffer.from('data')]], {}, cb)
        )).rejects.toThrow('blob creation failed');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Transaction.executeBatch', function () {
    function makeMockCnx(executeBatchFn, releaseFn) {
        const mockStatement = {
            executeBatch: executeBatchFn || function (txn, params, cb) {
                cb(null, { updated: [1], errors: [], affectedRows: 1, hasErrors: false });
            },
            release: releaseFn || function () {},
        };
        return { getCachedQuery: () => mockStatement, db: null };
    }

    it('should call statement.executeBatch and invoke callback with result', async function () {
        const mockResult = { updated: [1, 1], errors: [], affectedRows: 2, hasErrors: false };
        const cnx = makeMockCnx((txn, params, cb) => cb(null, mockResult));
        const txn = new Transaction(cnx);

        const result = await callbackToPromise(cb =>
            txn.executeBatch('INSERT INTO t VALUES(?)', [[1], [2]], cb)
        );
        expect(result).toBe(mockResult);
    });

    it('should release the statement on success', async function () {
        let released = false;
        const cnx = makeMockCnx(
            (txn, params, cb) => cb(null, {}),
            () => { released = true; }
        );
        const txn = new Transaction(cnx);
        await callbackToPromise(cb => txn.executeBatch('INSERT INTO t VALUES(?)', [[1]], cb));
        expect(released).toBe(true);
    });

    it('should release the statement and propagate errors', async function () {
        let released = false;
        const cnx = makeMockCnx(
            (txn, params, cb) => cb(new Error('execution error')),
            () => { released = true; }
        );
        const txn = new Transaction(cnx);
        await expect(
            callbackToPromise(cb => txn.executeBatch('INSERT INTO t VALUES(?)', [[1]], cb))
        ).rejects.toThrow('execution error');
        expect(released).toBe(true);
    });

    it('should propagate newStatement errors', async function () {
        const cnx = {
            getCachedQuery: () => null,
            prepare: (txn, query, bool, cb) => cb(new Error('prepare failed')),
            db: null,
        };
        const txn = new Transaction(cnx);
        await expect(
            callbackToPromise(cb => txn.executeBatch('BAD SQL', [[1]], cb))
        ).rejects.toThrow('prepare failed');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Database.executeBatch', function () {
    function makeDb(txnBehavior) {
        const mockCnx = {
            startTransaction: (cb) => cb(null, txnBehavior),
            _pending: [],
            _detachAuto: false,
        };
        return new Database(mockCnx);
    }

    it('should commit on success and return result', async function () {
        const mockResult = { updated: [1], errors: [], affectedRows: 1, hasErrors: false };
        let committed = false;
        const txn = {
            executeBatch: (q, params, cb) => cb(null, mockResult),
            commit: (cb) => { committed = true; cb(null); },
            rollback: (cb) => cb(),
        };
        const result = await callbackToPromise(cb =>
            makeDb(txn).executeBatch('INSERT INTO t VALUES(?)', [[1]], cb)
        );
        expect(result).toBe(mockResult);
        expect(committed).toBe(true);
    });

    it('should rollback and propagate error when executeBatch fails', async function () {
        let rolledBack = false;
        const txn = {
            executeBatch: (q, params, cb) => cb(new Error('batch failed')),
            commit: (cb) => cb(),
            rollback: (cb) => { rolledBack = true; cb(); },
        };
        await expect(
            callbackToPromise(cb => makeDb(txn).executeBatch('INSERT INTO t VALUES(?)', [[1]], cb))
        ).rejects.toThrow('batch failed');
        expect(rolledBack).toBe(true);
    });

    it('should propagate startTransaction errors', async function () {
        const mockCnx = {
            startTransaction: (cb) => cb(new Error('no connection')),
            _pending: [],
        };
        const db = new Database(mockCnx);
        await expect(
            callbackToPromise(cb => db.executeBatch('INSERT INTO t VALUES(?)', [[1]], cb))
        ).rejects.toThrow('no connection');
    });

    it('should return the Database instance (fluent API)', function () {
        const txn = {
            executeBatch: (q, p, cb) => cb(null, {}),
            commit: (cb) => cb(null),
            rollback: (cb) => cb(),
        };
        const db = makeDb(txn);
        const ret = db.executeBatch('INSERT INTO t VALUES(?)', [[1]], function () {});
        expect(ret).toBe(db);
    });
});
