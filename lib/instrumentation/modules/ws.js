'use strict'

var semver = require('semver')

var shimmer = require('../shimmer')

module.exports = function (ws, agent, version) {
  if (!semver.satisfies(version, '>=1 <6')) {
    agent.logger.debug('ws version %s not supported - aborting...', version)
    return ws
  }

  agent.logger.debug('shimming ws.prototype.send function')
  shimmer.wrap(ws.prototype, 'send', wrapSend)

  return ws

  function wrapSend (orig) {
    return function wrappedSend () {
      var span = agent.buildSpan()
      var id = span && span.transaction.id

      agent.logger.debug('intercepted call to ws.prototype.send %o', { id: id })

      if (!span) return orig.apply(this, arguments)

      var args = [].slice.call(arguments)
      var cb = args[args.length - 1]
      if (typeof cb === 'function') {
        args[args.length - 1] = done
      } else {
        cb = null
        args.push(done)
      }

      span.start('Send WebSocket Message', 'websocket.send')

      return orig.apply(this, args)

      function done () {
        span.end()
        if (cb) cb.apply(this, arguments)
      }
    }
  }
}
