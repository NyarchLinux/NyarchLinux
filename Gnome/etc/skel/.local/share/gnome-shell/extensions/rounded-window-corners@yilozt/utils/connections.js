const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// ---------------------------------------------------------------- [end import]

/**
 * This class is used to manager signal and handles of a object
 */
var Connections = class Connections {
  constructor () {
    // -------------------------------------------------------- [public methods]

    /**
     * Map object to store signal sources and their handlers
     * @type {Map<GObject.Object, { [signal_name: string]: number }>}
     */
    this.connections = new Map ()
  }
  connect (source, ...[signal, cb]) {
    // Source has been added into manager
    {
      const handlers = this.connections.get (source)
      if (handlers !== undefined) {
        if (handlers[signal] !== undefined) {
          handlers[signal].push (source.connect (signal, cb))
          return
        } else {
          handlers[signal] = [source.connect (signal, cb)]
          return
        }
      }
    }

    // Source is first time register signal
    const handlers = {}
    handlers[signal] = [source.connect (signal, cb)]
    this.connections.set (source, handlers)
  }
  /** Disconnect signal for source */
  disconnect (source, signal) {
    const handlers = this.connections.get (source)
    if (handlers !== undefined) {
      const handler = handlers[signal]
      if (handler !== undefined) {
        handler.forEach ((id) => source.disconnect (id))
        delete handlers[signal]
        if (Object.keys (handler).length == 0) {
          this.connections.delete (source)
        }
        return
      }
    }
  }

  disconnect_all (source) {
    // If provide source,  disconnect all signal of it
    if (source !== undefined) {
      const handlers = this.connections.get (source)
      if (handlers !== undefined) {
        Object.keys (handlers).forEach ((signal) => {
          handlers[signal].forEach ((id) => source.disconnect (id))
          delete handlers[signal]
        })
        this.connections.delete (source)
      }
      return
    }

    // otherwise clear signal for all objects.
    this.connections.forEach ((handlers, source) => {
      Object.keys (handlers).forEach ((signal) => {
        handlers[signal].forEach ((id) => source.disconnect (id))
        delete handlers[signal]
      })
    })
    this.connections.clear ()
  }
}

/** A singleton of connections */
let _connections = null

var connections = {
  get: () => {
    if (_connections === null) {
      _connections = new Connections ()
    }
    return _connections
  },
  del: () => {
    _connections = null
  },
}
