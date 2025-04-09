const Firebird = require("../../../lib");
const Config = require("../../config");
const assert = require("assert");

describe("Select - complex", function () {
  const config = Config.uniqueDb();
  let db, transaction;

  before(function (done) {
    Firebird.attachOrCreate(config, function (err, _db) {
      if (err) throw err;

      db = _db;
      db.query("CREATE TABLE TEST(ID INT)", (err) => {
        if (err) throw err;

        done();
      });
    });
  });

  after(function () {
    if (db) db.drop();
  });

  beforeEach(function (done) {
    db.transaction((err, tr) => {
      if (err) throw err;

      transaction = tr;

      const queries = [];
      for (let i = 0; i < 5; i++) {
        queries.push(
          new Promise((resolve, reject) => {
            transaction.query("INSERT INTO TEST(ID) VALUES (?)", [i], (err) => {
              if (err) reject("err");
              else resolve();
            });
          })
        );
      }

      Promise.all(queries)
        .then(() => done())
        .catch((err) => console.error(err));
    });
  });

  afterEach(function (done) {
    transaction.rollback((err) => {
      if (err) throw err;

      done();
    });
  });

  it("should select scalar values", function (done) {
    transaction.query(
      "SELECT CAST(123 AS NUMERIC(10,2)) As a, MAX(2) AS b, COUNT(*) AS c FROM RDB$DATABASE",
      function (err, rows) {
        assert.ok(!err, err);
        var row = rows[0];
        assert.equal(row.a, 123, "CAST returned an unexpected value.");
        assert.equal(row.b, 2, "MAX returned an unexpected value.");
        assert.notEqual(row.c, 0, "COUNT returned an unexpected value.");
        done();
      }
    );
  });

  it("should select rows as arrays", function (done) {
    transaction.execute(
      "SELECT COUNT(*), SUM(ID) FROM test",
      function (err, rows) {
        assert.ok(!err, err);
        var row = rows[0];

        assert.ok(Array.isArray(row));
        assert.equal(row[0], 5);
        assert.equal(row[1], 10);
        done();
      }
    );
  });

  it("should select rows as objects", function (done) {
    transaction.query(
      "SELECT COUNT(*), SUM(ID) FROM test",
      function (err, rows) {
        assert.ok(!err, err);
        var row = rows[0];
        assert.equal(row.count, 5);
        assert.equal(row.sum, 10);
        done();
      }
    );
  });

  it("should select rows sequentially as arrays", function (done) {
    var sum = 0;
    transaction.sequentially(
      "SELECT Id FROM test",
      function (row) {
        sum += row[0];
      },
      function () {
        assert.equal(sum, 10);
        done();
      },
      true
    );
  });

  it("should select rows sequentially as objects", function (done) {
    var sum = 0;
    transaction.sequentially(
      "SELECT Id FROM test",
      function (row) {
        sum += row.id;
      },
      function () {
        assert.equal(sum, 10);
        done();
      }
    );
  });
});
