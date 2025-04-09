const Firebird = require("../../lib");
const Config = require("../config");
const assert = require("assert");

describe("Pooling", function () {
  const config = Config.uniqueDb();
  let poolSize = 2;
  let pool;

  before(function (done) {
    // create database if not exists (case of run only this test sequence)
    Firebird.attachOrCreate(config, (err, db) => {
      assert.ok(!err, err);

      db.detach((err) => {
        assert.ok(!err, err);

        pool = Firebird.pool(poolSize, config);
        done();
      });
    });
  });

  after(function (done) {
    pool.destroy(function (err) {
      assert.ok(!err, err);
      done();
    });
  });

  it("should wait when all connections are in use", function (done) {
    for (var i = 0; i < poolSize; i++) {
      pool.get(function (err, db) {
        assert.ok(!err, err);

        setImmediate(function () {
          db.detach();
        });
      });
    }

    pool.get(function (err, db) {
      assert(!err, err);

      db.query("SELECT * FROM RDB$DATABASE", function (err, rows) {
        assert(!err, err);
        assert.equal(rows.length, 1);
        db.detach(function () {
          assert.equal(pool.dbinuse, 0);
          done();
        });
      });
    });

    assert.equal(pool.pending.length, 1);
  });
});
