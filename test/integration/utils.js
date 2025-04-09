/**
 * Invoke callback if given with stream read result or return a promise who resolve the stream result.
 *
 * @param stream The readable stream.
 * @param cb Optional callback function.
 * @returns {Promise<unknown>} The promise if callback is not given.
 */
function readStream(stream) {
  let result = "";

  stream.on("data", (chunk) => (result += chunk.toString() + "\n"));
  stream.on("end", () => cb(result));
}

module.exports = {
  readStream,
};
