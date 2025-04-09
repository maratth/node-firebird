const assert = require("assert");

const nodeVersion = process.versions.node.split(".").map(Number)[0];
const openedSockets = [];

let dc;
if (nodeVersion >= 14) {
  dc = require("diagnostics_channel");
}

beforeEach(function () {
  if (dc) {
    const testName = this.currentTest.title;

    function onMessage({ socket }) {
      console.log("newSocket");
      const newLength = openedSockets.push({ testName, socket });

      socket.on("close", () => {
        console.log("socketClose");
        delete openedSockets[newLength - 1];
        dc.unsubscribe("net.client.socket", onMessage);
      });
    }

    dc.subscribe("net.client.socket", onMessage);
  }
});

after(function () {
  const alwaysOpened = openedSockets.filter((s) => s);
  const socketNames = alwaysOpened.map((socket) => socket.testName);
  const socketCount = alwaysOpened.length;

  if (socketCount > 0) {
    alwaysOpened.forEach(({ socket }) => socket.destroy());
    assert.fail(
      "Remaining opened socket : " + socketCount + " in tests : " + socketNames
    );
  }
});

require("./unit");
require("./integration");
