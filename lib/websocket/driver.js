// Protocol references:
// 
// * http://tools.ietf.org/html/draft-hixie-thewebsocketprotocol-75
// * http://tools.ietf.org/html/draft-hixie-thewebsocketprotocol-76
// * http://tools.ietf.org/html/draft-ietf-hybi-thewebsocketprotocol-17

var Draft75 = require('./driver/draft75'),
    Draft76 = require('./driver/draft76'),
    Hybi    = require('./driver/hybi'),
    Client  = require('./driver/client');

var Driver = {
  isSecureRequest: function(request) {
    if (request.connection && request.connection.authorized !== undefined) return true;
    if (request.socket && request.socket.secure) return true;

    var headers = request.headers;
    if (!headers) return false;
    if (headers['https'] === 'on') return true;
    if (headers['x-forwarded-ssl'] === 'on') return true;
    if (headers['x-forwarded-scheme'] === 'https') return true;
    if (headers['x-forwarded-proto'] === 'https') return true;

    return false;
  },

  determineUrl: function(request) {
    var scheme = this.isSecureRequest(request) ? 'wss:' : 'ws:';
    return scheme + '//' + request.headers.host + request.url;
  },

  client: function(url, options) {
    options = options || {};
    if (options.masking === undefined) options.masking = true;
    return new Client(url, options);
  },

  http: function(request, options) {
    options = options || {};
    if (options.requireMasking === undefined) options.requireMasking = true;

    var headers = request.headers,
        url     = this.determineUrl(request);

    if (headers['sec-websocket-version'])
      return new Hybi(request, url, options);
    else if (headers['sec-websocket-key1'])
      return new Draft76(request, url, options);
    else
      return new Draft75(request, url, options);
  },

  isWebSocket: function(request) {
    if (request.method !== 'GET') return false;

    var connection = request.headers.connection || '',
        upgrade    = request.headers.upgrade || '';

    return request.method === 'GET' &&
           connection.toLowerCase().split(/\s*,\s*/).indexOf('upgrade') >= 0 &&
           upgrade.toLowerCase() === 'websocket';
  }
};

module.exports = Driver;
