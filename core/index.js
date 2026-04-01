module.exports = {
  deployment: require("./deployment"),
  runtime: {
    events: require("./runtime/events"),
    registry: require("./runtime/registry"),
    session: require("./runtime/session"),
  },
}
