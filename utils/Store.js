import EventEmitter from "../shared/EventEmitter.js";

export default class Store extends EventEmitter {
	#db = null;
	cache = new Map();
	name = null;
	constructor(name, db, preprocess, postprocess) {
		super();
		this.#db = db,
		this.name = name,
		this._cache(),
		Object.defineProperty(this, 'cache', { enumerable: false }),
		Object.defineProperty(this, '_preprocessDefaults', { value: preprocess || null, writable: true }),
		Object.defineProperty(this, '_postprocessDefaults', { value: postprocess || null, writable: true })
	}

	_cache() {
		return this._createTransaction(objectStore => {
			return new Promise((resolve, reject) => {
				const query = objectStore.getAll();
				query.addEventListener('error', reject),
				query.addEventListener('success', ({ target }) => {
					for (const entryId of Array.from(this.cache.keys()).filter(entryId => -1 === target.result.findIndex(entry => entry.id === entryId))) {
						let oldValue = this.cache.get(entryId);
						this.cache.delete(entryId),
						this.emit('delete', oldValue);
					}
					if (target.result.length > 0) {
						for (const entry of target.result) {
							this.cache.set(entry.id, entry);
						}
					}
					this.emit('cached', this.cache),
					resolve(target.result)
				})
			})
		})
	}

	_createTransaction(callback) {
		return new Promise(async (resolve, reject) => {
			const transaction = this.#db.transaction(this.name, 'readwrite');
			const objectStore = transaction.objectStore(this.name);
			const response = await callback(objectStore);
			transaction.addEventListener('abort', reject),
			transaction.addEventListener('complete', () => resolve(response)),
			transaction.addEventListener('error', reject)
		})
	}

	clear() {
		return this._createTransaction(objectStore => {
			return new Promise((resolve, reject) => {
				const query = objectStore.clear();
				query.addEventListener('error', reject),
				query.addEventListener('success', () => {
					this.emit('cleared'),
					resolve(this.cache.clear())
				})
			})
		})
	}

	delete(key) {
		if (!this.cache.has(key)) return Promise.resolve(false);
		return this._createTransaction(objectStore => {
			return new Promise((resolve, reject) => {
				const query = objectStore.delete(key);
				query.addEventListener('error', reject),
				query.addEventListener('success', () => {
					this.#db.dispatchEvent(new Event('stale'));
					let oldValue = this.cache.get(key);
					this.cache.delete(key),
					this.emit('delete', oldValue),
					resolve(true)
				})
			})
		})
	}

	get(key) {
		if (this.cache.has(key)) return Promise.resolve(this.cache.get(key));
		return this._createTransaction(objectStore => {
			return new Promise((resolve, reject) => {
				const query = objectStore.get(key);
				query.addEventListener('error', reject),
				query.addEventListener('success', ({ target }) => {
					const value = target.result || null;
					null !== value && this.cache.set(key, value),
					resolve(value)
				})
			})
		})
	}

	set(key, value) {
		typeof this._preprocessDefaults == 'function' && (value = this._preprocessDefaults(value));
		if (this.cache.has(key) && JSON.stringify(value) === JSON.stringify(this.cache.get(key))) return Promise.resolve(value);
		typeof this._postprocessDefaults == 'function' && (value = this._postprocessDefaults(value));
		return this._createTransaction(objectStore => {
			return new Promise((resolve, reject) => {
				const query = objectStore.put(value);
				query.addEventListener('error', reject),
				query.addEventListener('success', () => {
					this.#db.dispatchEvent(new Event('stale')),
					null !== value && (this.emit('update', this.cache.get(key) || (this.emit('create', value),
					null), value),
					this.cache.set(key, value)),
					resolve(value)
				})
			})
		})
	}

	async update(key, value) {
		return this.set(key, Object.assign({}, await this.get(key), value))
	}
}