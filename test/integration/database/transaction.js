const Firebird = require("../../../lib");
const Config = require("../../config");
const assert = require("assert");

describe("Transaction", function () {
  const config = Config.uniqueDb();
  let db;

  before(function (done) {
    Firebird.attachOrCreate(config, function (err, _db) {
      if (err) throw err;
      db = _db;

      db.query("CREATE TABLE test2 (ID INT, NAME VARCHAR(50))", function (err) {
        assert.ok(!err, err);
        done();
      });
    });
  });

  after(function () {
    if (db) db.drop();
  });

  it("should rollback", function (done) {
    db.transaction(function (err, transaction) {
      assert(!err, err);
      transaction.query(
        "INSERT INTO test2 (ID, NAME) VALUES(?, ?)",
        [1, "Transaction 1"],
        function (err) {
          assert.ok(!err, err);
          transaction.query(
            "INSERT INTO test2 (ID, NAME) VALUES(?, ?)",
            [2, "Transaction 2"],
            function (err) {
              assert.ok(!err, err);
              transaction.query(
                "INSERT INTO test_fail (ID, NAME) VALUES(?, ?)",
                [3, "Transaction 3"],
                function (err) {
                  assert.ok(err);
                  transaction.rollback(function (err) {
                    assert.ok(!err, err);
                    verify(done, 0);
                  });
                }
              );
            }
          );
        }
      );
    });
  });

  it("should commit", function (done) {
    db.transaction(function (err, transaction) {
      assert(!err, err);
      transaction.query(
        "INSERT INTO test2 (ID, NAME) VALUES(?, ?)",
        [4, "Transaction 1"],
        function (err) {
          assert.ok(!err, err);
          transaction.query(
            "INSERT INTO test2 (ID, NAME) VALUES(?, ?)",
            [5, "Transaction 2"],
            function (err) {
              assert.ok(!err, err);
              transaction.query(
                "INSERT INTO test2 (ID, NAME) VALUES(?, ?)",
                [6, "Transaction 3"],
                function (err) {
                  assert.ok(!err, err);
                  transaction.commit(function (err) {
                    assert.ok(!err, err);
                    verify(done, 3);
                  });
                }
              );
            }
          );
        }
      );
    });
  });

  function verify(callback, count) {
    db.query("SELECT COUNT(*) FROM test2", function (err, rows) {
      assert.ok(!err, err);
      var row = rows[0];
      assert.equal(row.count, count);
      callback();
    });
  }
});
