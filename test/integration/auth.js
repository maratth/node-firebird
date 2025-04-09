const Firebird = require("../../lib");
const Config = require("../config");
const assert = require("assert");

describe("Auth plugin connection", function () {
  let config;

  before(function () {
    config = Config.uniqueDb();
  });

  after(function (done) {
    Firebird.drop(config, done);
  });

  // Must be test with firebird 2.5 or higher with Legacy_Auth enabled on server
  it("should attach with legacy plugin", function (done) {
    Firebird.attachOrCreate(
      Config.extends(config, { pluginName: Firebird.AUTH_PLUGIN_LEGACY }),
      function (err, db) {
        assert.ok(
          !err,
          "Maybe firebird 3.0 Legacy_Auth plugin not enabled, message : " +
            (err ? err.message : "")
        );

        db.detach(done);
      }
    );
  });

  // On firebird 2.5 or higher with only Legacy_Auth enabled on server for fallback to Srp on Legacy or Srp connect
  it("should attach on firebird 3.0 and fallback to Legacy or Srp", function (done) {
    Firebird.attachOrCreate(config, function (err, db) {
      assert.ok(!err, err);

      db.detach(done);
    });
  });

  // Must be test with firebird 2.5 or higher with only Legacy_Auth enabled on server
  it("should attach with srp plugin but support only Legacy", function (done) {
    Firebird.attachOrCreate(
      Config.extends(config, {
        pluginName: Firebird.AUTH_PLUGIN_SRP,
      }),
      function (err, db) {
        assert.ok(err, "Maybe Srp enable");
        assert.ok(
          err.message ===
            "Server don't accept plugin : Srp, but support : Legacy_Auth"
        );

        // db.detach();
        done();
      }
    );
  });

  describe("FB3 - Srp", function () {
    // Must be test with firebird 3.0 or higher with Srp enable on server
    it("should attach with srp plugin", function (done) {
      Firebird.attachOrCreate(
        Config.extends(config, { pluginName: Firebird.AUTH_PLUGIN_SRP }),
        function (err, db) {
          assert.ok(!err, err);

          db.detach(done);
        }
      );
    });

    // FB 3.0 : Should be tested with Srp256 enabled on server configuration
    /*it('should attach with srp 256 plugin', function (done) {
              Firebird.attachOrCreate(Config.extends(config, { pluginName: Firebird.AUTH_PLUGIN_SRP256 }), function (err, db) {
                  assert.ok(!err, err);
  
                  db.detach(done);
              });
          });*/
  });
});
