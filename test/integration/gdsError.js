const Firebird = require("../../lib");
const { GDSCode } = require("../../lib/gdscodes");
const Config = require("../config");
const assert = require("assert");

describe("GDSCode in errors", function () {
  const config = Config.uniqueDb();
  let db;

  before(function (done) {
    Firebird.attachOrCreate(config, function (err, _db) {
      if (err) throw err;
      db = _db;
      // Create table and insert record id=1
      db.query(
        "RECREATE TABLE test_gdscode (ID INT NOT NULL CONSTRAINT PK_NAME PRIMARY KEY, NAME VARCHAR(50))",
        [],
        function (err) {
          if (err) throw err;
          db.query(
            "insert into test_gdscode(id, name) values (?, ?)",
            [1, "xpto"],
            function (error) {
              if (error) throw error;
              done();
            }
          );
        }
      );
    });
  });

  after(function () {
    if (db) db.drop();
  });

  it("should return gdscode", function (done) {
    db.query(
      "insert into test_gdscode(id, name) values (?, ?)",
      [1, "xpto"],
      function (err) {
        assert.ok(err, "Must be an error!");
        assert.strictEqual(
          err.gdscode,
          335544665,
          "The numeric code for UNIQUE_KEY_VIOLATION is returned"
        );
        done();
      }
    );
  });
  it("should have constants to check gdscode and gdsparams", function (done) {
    db.query(
      "insert into test_gdscode(id, name) values (?, ?)",
      [1, "xpto"],
      function (err) {
        assert.ok(err, "Must be an error!");
        assert.strictEqual(
          err.gdscode,
          GDSCode.UNIQUE_KEY_VIOLATION,
          "PK violated"
        );
        assert.strictEqual(
          err.gdsparams[0],
          "PK_NAME",
          "The PK constraint name"
        );
        assert.strictEqual(err.gdsparams[1], "TEST_GDSCODE", "The table name");
        done();
      }
    );
  });
});
