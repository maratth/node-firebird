const Firebird = require("../../lib");
const Config = require("../config");
const assert = require("assert");

describe("Connection", function () {
  let config;

  beforeEach(function () {
    config = Config.uniqueDb();
  });

  describe("AttachOrCreate", function () {
    afterEach(function (done) {
      Firebird.drop(config, () => done()); // Ignore errors
    });

    it("should attach or create database", function (done) {
      Firebird.attachOrCreate(config, function (err, db) {
        assert.ok(!err, err);
        db.detach(done);
      });
    });
  });

  describe("Attach", function () {
    beforeEach(function (done) {
      Firebird.create(config, (err) => {
        if (err) throw err;
        done();
      });
    });

    afterEach(function (done) {
      Firebird.drop(config, () => done()); // Ignore errors
    });

    it("should reconnect when socket is closed", function (done) {
      Firebird.attach(config, function (err, db) {
        assert.ok(!err, err);

        db.connection._socket.destroy();

        db.on("reconnect", function () {
          db.detach(done);
        });
      });
    });
  });

  describe("Create", function () {
    afterEach(function (done) {
      Firebird.drop(config, () => done()); // Ignore errors
    });

    it("should create", function (done) {
      Firebird.create(config, function (err, db) {
        assert.ok(!err, err);

        db.detach(done);
      });
    });
  });

  describe("Drop", function () {
    beforeEach(function (done) {
      Firebird.create(config, (err, db) => {
        assert.ok(!err, err);

        db.detach(done);
      });
    });

    it("should drop", function (done) {
      Firebird.drop(config, function (err) {
        assert.ok(!err, err);

        done();
      });
    });
  });
});
