const Firebird = require("../../../lib");
const Config = require("../../config");
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const TEST_TABLE =
  "CREATE TABLE test (ID INT, PARENT BIGINT, NAME VARCHAR(50), FILE BLOB, CREATED TIMESTAMP)";
const blobPath = path.join(Config.testDir, "image.png");
const blobSize = fs.readFileSync(blobPath).length;

describe("Update", function () {
  const config = Config.uniqueDb();

  before(function (done) {
    Firebird.attachOrCreate(config, (err, _db) => {
      if (err) throw err;
      db = _db;

      db.query(TEST_TABLE, (err) => {
        assert.ok(!err, err);
        done();
      });
    });
  });

  after(function () {
    if (db) db.drop();
  });

  it("should update with blob from stream", function (done) {
    db.query(
      "INSERT INTO test (ID, NAMe) VALUES (?, ?)",
      [1, "Test"],
      (err) => {
        assert.ok(!err, err);

        db.query(
          "UPDATE test SET NAME = ?, FILE = ? WHERE Id = 1",
          ["Firebird 1 (UPD)", fs.createReadStream(blobPath)],
          function (err) {
            assert.ok(!err, err);
            done();
          }
        );
      }
    );
  });

  it("should update with blob from buffer", function (done) {
    db.query(
      "INSERT INTO test (ID, NAMe) VALUES (?, ?)",
      [2, "Test"],
      (err) => {
        assert.ok(!err, err);

        db.query(
          "UPDATE test SET NAME = ?, FILE = ? WHERE Id = 2",
          ["Firebird 2 (UPD)", fs.readFileSync(blobPath)],
          function (err) {
            assert.ok(!err, err);
            done();
          }
        );
      }
    );
  });

  describe("verify", function () {
    it("should select data from update with blob from stream", function (done) {
      db.query("SELECT * FROM test WHERE ID = 1", function (err, rows) {
        assert.ok(!err, err);

        var row = rows[0];
        assert.notEqual(row, undefined);
        assert.equal(row.id, 1);
        assert.equal(row.name, "Firebird 1 (UPD)");
        assert.equal(typeof row.file, "function");

        row.file(function (err, name, emitter) {
          assert.ok(!err, err);

          var count = 0;

          emitter.on("data", function (buffer) {
            count += buffer.length;
          });

          emitter.on("end", function () {
            assert.equal(count, 5472);
            done();
          });
        });
      });
    });

    it("should select data from update with blob from buffer", function (done) {
      db.query("SELECT * FROM test WHERE ID = 2", function (err, rows) {
        assert.ok(!err, err);

        var row = rows[0];
        assert.notEqual(row, undefined);
        assert.equal(row.id, 2);
        assert.equal(row.name, "Firebird 2 (UPD)");
        assert.equal(typeof row.file, "function");

        row.file(function (err, name, emitter) {
          assert.ok(!err, err);

          var count = 0;

          emitter.on("data", function (buffer) {
            count += buffer.length;
          });

          emitter.on("end", function () {
            assert.equal(count, 5472);
            done();
          });
        });
      });
    });
  });
});
