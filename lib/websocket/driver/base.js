var Emitter = require('events').EventEmitter,
    util    = require('util'),
    streams = require('../streams'),
    Headers = require('./headers');

var Base = function(request, url, options) {
  Emitter.call(this);

  this._request   = request;
  this._options   = options || {};
  this._maxLength = this._options.maxLength || this.MAX_LENGTH;
  this.__headers  = new Headers();
  this.__queue    = [];
  this.readyState = 0;
  this.url        = url;

  this.io = new streams.IO(this);
  this.messages = new streams.Messages(this);
  this._bindEventListeners();
};
util.inherits(Base, Emitter);

var instance = {
  // This is the maximum length of a Node buffer:
  // https://github.com/joyent/node/blob/master/src/smalloc.h#L40
  MAX_LENGTH: 0x3fffffff,

  STATES: ['connecting', 'open', 'closing', 'closed'],

  _bindEventListeners: function() {
    var self = this;

    // Protocol errors are informational and do not have to be handled
    this.messages.on('error', function() {});

    this.on('message', function(event) {
      var messages = self.messages;
      if (messages.readable) messages.emit('data', event.data);
    });

    this.on('error', function(error) {
      var messages = self.messages;
      if (messages.readable) messages.emit('error', error);
    });

    this.on('close', function() {
      var messages = self.messages;
      if (!messages.readable) return;
      messages.readable = messages.writable = false;
      messages.emit('end');
    });
  },

  getState: function() {
    return this.STATES[this.readyState] || null;
  },

  setHeader: function(name, value) {
    if (this.readyState > 0) return false;
    this.__headers.set(name, value);
    return true;
  },

  start: function() {
    if (this.readyState !== 0) return false;
    this._write(this._handshakeResponse());
    if (this._stage !== -1) this._open();
    return true;
  },

  text: function(message) {
    return this.frame(message);
  },

  binary: function(message) {
    return false;
  },

  ping: function() {
    return false;
  },

  close: function(reason, code) {
    if (this.readyState !== 1) return false;
    this.readyState = 3;
    this.emit('close', new Base.CloseEvent(null, null));
    return true;
  },

  _open: function() {
    this.readyState = 1;
    this.__queue.forEach(function(args) { this.frame.apply(this, args) }, this);
    this.__queue = [];
    this.emit('open', new Base.OpenEvent());
  },

  _queue: function(message) {
    this.__queue.push(message);
    return true;
  },

  _write: function(chunk) {
    var io = this.io;
    if (io.readable) io.emit('data', chunk);
  }
};

for (var key in instance)
  Base.prototype[key] = instance[key];


Base.ConnectEvent = function() {};

Base.OpenEvent = function() {};

Base.CloseEvent = function(code, reason) {
  this.code   = code;
  this.reason = reason;
};

Base.MessageEvent = function(data) {
  this.data = data;
};

module.exports = Base;

