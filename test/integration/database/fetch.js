const Firebird = require("../../../lib");
const Config = require("../../config");
const assert = require("assert");

describe("Fetch", () => {
  const config = Config.uniqueDb();
  let db;

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

  it("should fetch contains errors", (done) => {
    db.query(
      `
                create or alter procedure TEST_FETCH_FAIL
                returns (RET integer)
                as
                begin
                  RET = 10;
                  suspend;
                
                  RET = 10 / 2;
                  suspend;
                
                  RET = 0 / 0;
                  suspend;
                end
            `,
      (err, data) => {
        assert.ok(!err, err);

        db.query("select RET from TEST_FETCH_FAIL", (err, d) => {
          assert.ok(err, err);
          assert.ok(
            err.message.match(
              /arithmetic exception, numeric overflow, or string truncation, Integer divide by zero./gi
            )
          );

          done();
        });
      }
    );
  });
});
