const Firebird = require("../../../lib");
const Config = require("../../config");
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const TEST_TABLE =
  "CREATE TABLE test (ID INT, PARENT BIGINT, NAME VARCHAR(50), FILE BLOB, CREATED TIMESTAMP)";
const blobPath = path.join(Config.testDir, "image.png");
const blobSize = fs.readFileSync(blobPath).length;

describe("Insert", function () {
  const config = Config.uniqueDb();
  let db;

  before(function (done) {
    Firebird.attachOrCreate(config, (err, _db) => {
      if (err) throw err;
      db = _db;

      db.query(TEST_TABLE, (err) => {
        if (err) throw err;
        done();
      });
    });
  });

  after(function () {
    if (db) db.drop();
  });

  it("should insert", function (done) {
    db.query(
      "INSERT INTO test (ID, NAME, CREATED, PARENT) VALUES(?, ?, ?, ?)",
      [1, "Firebird 1", "2014-12-12 13:59", 862304020112911],
      function (err) {
        assert.ok(!err, err);
        done();
      }
    );
  });

  it("should insert with returning", function (done) {
    db.query(
      "INSERT INTO test (ID, NAME, CREATED, PARENT) VALUES(?, ?, ?, ?) RETURNING ID",
      [2, "Firebird 2", Config.currentDate, 862304020112911],
      function (err, row) {
        assert.ok(!err, err);
        assert.equal(row["id"], 2);
        done();
      }
    );
  });

  it("should insert with blob from stream", function (done) {
    db.query(
      "INSERT INTO test (ID, NAME, FILE, CREATED) VALUES(?, ?, ?, ?) RETURNING ID",
      [3, "Firebird 3", fs.createReadStream(blobPath), "14.12.2014 12:12:12"],
      function (err, row) {
        assert.ok(!err, err);
        assert.equal(row["id"], 3);
        done();
      }
    );
  });

  it("should insert with blob from buffer", function (done) {
    db.query(
      "INSERT INTO test (ID, NAME, FILE, CREATED) VALUES(?, ?, ?, ?) RETURNING ID",
      [4, "Firebird 4", fs.readFileSync(blobPath), "14.12.2014T12:12:12"],
      function (err, row) {
        assert.ok(!err, err);
        assert.equal(row["id"], 4);
        done();
      }
    );
  });

  it("should insert with null", function (done) {
    db.query(
      "INSERT INTO test (ID, NAME, CREATED, PARENT) VALUES(?, ?, ?, ?)",
      [5, null, "2014-12-12 13:59", null],
      function (err) {
        assert.ok(!err, err);
        done();
      }
    );
  });

  describe("verify", function () {
    it("should select data from inserts", function (done) {
      db.query("SELECT * FROM test ORDER BY id", function (err, rows) {
        assert.ok(!err, err);

        var first = rows[0];
        var second = rows[1];
        var third = rows[2];
        var five = rows[4];

        assert.equal(first.created.getMonth(), 11);
        assert.equal(first.created.getDate(), 12);
        assert.equal(first.created.getFullYear(), 2014);
        assert.equal(first.created.getHours(), 13);
        assert.equal(first.created.getMinutes(), 59);

        assert.equal(second.created.getTime(), Config.currentDate.getTime());

        assert.notEqual(third, undefined);
        assert.equal(third.id, 3);
        assert.equal(third.name, "Firebird 3");
        assert.equal(typeof third.file, "function");
        assert.equal(third.created.getMonth(), 11);
        assert.equal(third.created.getDate(), 14);
        assert.equal(third.created.getFullYear(), 2014);
        assert.equal(third.created.getHours(), 12);
        assert.equal(third.created.getMinutes(), 12);

        assert.equal(five.name, null);
        assert.equal(five.parent, null);

        third.file(function (err, name, emitter) {
          assert.ok(!err, err);

          var count = 0;

          emitter.on("data", function (buffer) {
            count += buffer.length;
          });

          emitter.on("end", function () {
            assert.equal(count, blobSize);
            done();
          });
        });
      });
    });
  });
});
