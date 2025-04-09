const Firebird = require("../../../lib");
const Config = require("../../config");
const assert = require("assert");

describe("Select", function () {
  const config = Config.uniqueDb();
  var db;

  before(function (done) {
    Firebird.attachOrCreate(config, function (err, _db) {
      if (err) throw err;
      db = _db;
      done();
    });
  });

  after(function () {
    if (db) db.drop();
  });

  it("should simple select", function (done) {
    db.query("SELECT * FROM RDB$DATABASE", function (err, row) {
      assert.ok(!err, err);
      assert.ok(row);
      assert.equal(row.length, 1);
      assert.equal(row[0]["rdb$description"], null); // Check null value for FB3 BitSet

      done();
    });
  });

  it("should select with param", function (done) {
    db.query(
      "SELECT * FROM RDB$ROLES WHERE RDB$OWNER_NAME = ?",
      [config.user],
      function (err, d) {
        assert.ok(!err, err);
        assert.ok(d);

        done();
      }
    );
  });

  it("should select multiple rows", function (done) {
    db.query(
      "SELECT FIRST 100 RDB$FIELD_NAME FROM RDB$FIELDS",
      function (err, d) {
        assert.ok(!err, err);

        done();
      }
    );
  });

  it("should create table", function (done) {
    db.query("CREATE TABLE T (ID INT)", function (err, d) {
      assert.ok(!err, err);

      done();
    });
  });
});
