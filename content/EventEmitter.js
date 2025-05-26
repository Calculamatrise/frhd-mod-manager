class EventEmitter {
	/** @private */
	_events = new Map();
	_temp = new WeakSet();

	/**
	 * Emit an event to trigger listeners
	 * @param {string} event 
	 * @param  {...any} [args] 
	 */
	emit(event, ...args) {
		const listeners = this._events.get(event) || new Set();
		if (typeof this['on' + event] == 'function')
			listeners.add(this['on' + event]);
		for (const listener of listeners) {
			listener.apply(this, args);
			this._temp.delete(listener) && listeners.delete(listener)
		}
	}

	/**
	 * Emits several events
	 * @param {Array<string>} events 
	 * @param {...any} [args] 
	 */
	emits(events, ...args) {
		if (!(events instanceof Array))
			throw new TypeError("Events must be of type: Array<string>");
		events.forEach(event => this.emit(event, ...args))
	}

	/**
	 * 
	 * @alias addListener
	 * @param {string} event 
	 * @param {function} listener 
	 * @param {object} [options] 
	 * @param {boolean} [options.once] 
	 * @returns {number}
	 */
	on(event, listener, options = {}) {
		if (typeof event != 'string')
			throw new TypeError("Event must be of type: string");
		else if (typeof listener != 'function')
			throw new TypeError("Listener must be of type: Function");
		else if (typeof options != 'object')
			throw new TypeError("Options must be of type: Object")
		else if (options.once)
			this._temp.add(listener);
		if (!this._events.has(event))
			this._events.set(event, new Set());
		const events = this._events.get(event);
		return events.add(listener),
			events.size
	}

	/**
	 * 
	 * @param {string} event 
	 * @param {Function} listener 
	 * @returns {Function}
	 */
	once(event, listener) {
		return this.on(event, listener, { once: true })
	}

	/**
	 * 
	 * @param {string} event 
	 * @returns {Set}
	 */
	listeners(event) {
		return this._events.get(event) || new Set()
	}

	/**
	 * 
	 * @param {string} event 
	 * @returns {number}
	 */
	listenerCount(event) {
		return this.listeners(event).size
	}

	/**
	 * 
	 * @param {string} [event] 
	 * @param {string} [listener] 
	 * @returns {boolean}
	 */
	off(event = null, listener = null) {
		if (typeof listener == 'function')
			return this.removeListener(event);
		return this.removeAllListeners(event)
	}

	/**
	 * 
	 * @param {string} event 
	 * @param {Function} listener 
	 * @returns {boolean}
	 */
	removeListener(event, listener) {
		if (typeof event != 'string')
			throw new TypeError("Event must be of type: string");
		const listeners = this._events.get(event);
		if (listeners !== void 0 && listeners.delete(listener))
			this._temp.delete(listener);
		return true
	}

	/**
	 * 
	 * @param {string} event 
	 * @returns {boolean}
	 */
	removeAllListeners(event) {
		if (typeof event == 'string')
			return this._events.delete(event);
		return this._events.clear()
	}
}

Object.defineProperty(EventEmitter.prototype, 'addListener', { value: EventEmitter.prototype.on, writable: true });
Object.defineProperty(self, 'EventEmitter', {
	value: EventEmitter,
	writable: true
});

const proto = Object.getPrototypeOf(Game);
for (const [prop, desc] of Object.entries(Object.getOwnPropertyDescriptors(EventEmitter.prototype))) {
	Object.defineProperty(Game.prototype, prop, desc);
}

Object.setPrototypeOf(Game, proto);