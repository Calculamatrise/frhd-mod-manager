export default class Store extends EventTarget {
	#db = null;
	cache = new Map();
	name = null;
	constructor(name, db, preprocess, postprocess) {
		super();
		this.#db = db;
		Object.defineProperties(this, {
			_postprocessDefaults: { value: postprocess || null, writable: true },
			_preprocessDefaults: { value: preprocess || null, writable: true },
			cache: { enumerable: false }
		});
		this.name = name;
		this._cache()
	}

	_cache() {
		return this._createTransaction(objectStore => {
			return new Promise((resolve, reject) => {
				const query = objectStore.getAll();
				query.addEventListener('error', reject);
				query.addEventListener('success', ({ target }) => {
					for (const entryId of Array.from(this.cache.keys()).filter(entryId => -1 === target.result.findIndex(entry => entry.id === entryId))) {
						let oldValue = this.cache.get(entryId);
						this.cache.delete(entryId);
						this.dispatchEvent(new CustomEvent('delete', { detail: oldValue }));
					}
					if (target.result.length > 0) {
						for (const entry of target.result) {
							this.cache.set(entry.id, entry);
						}
					}
					this.dispatchEvent(new CustomEvent('cache', { detail: this.cache }));
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
			transaction.addEventListener('abort', reject);
			transaction.addEventListener('complete', () => resolve(response));
			transaction.addEventListener('error', reject)
		})
	}

	append(data) {
		return this.set(data.id ?? crypto.randomUUID(), data)
	}

	clear() {
		return this._createTransaction(objectStore => {
			return new Promise((resolve, reject) => {
				const query = objectStore.clear();
				query.addEventListener('error', reject);
				query.addEventListener('success', () => {
					this.dispatchEvent(new CustomEvent('clear'));
					this.cache.clear();
					resolve()
				})
			})
		})
	}

	async delete(key) {
		if (!this.cache.has(key)) return false;
		return this._createTransaction(objectStore => {
			return new Promise((resolve, reject) => {
				const query = objectStore.delete(key);
				query.addEventListener('error', reject);
				query.addEventListener('success', () => {
					const oldValue = this.cache.get(key);
					this.cache.delete(key);
					this.dispatchEvent(new CustomEvent('delete', { value: oldValue }));
					this.#db.dispatchEvent(new Event('stale'));
					resolve(true)
				})
			})
		})
	}

	async get(key) {
		if (this.cache.has(key)) return this.cache.get(key);
		return this._createTransaction(objectStore => {
			return new Promise((resolve, reject) => {
				const query = objectStore.get(key);
				query.addEventListener('error', reject);
				query.addEventListener('success', ({ target }) => {
					const value = target.result || null;
					null !== value && this.cache.set(key, value);
					resolve(value)
				})
			})
		})
	}

	async set(key, value) {
		typeof this._preprocessDefaults == 'function' && (value = this._preprocessDefaults(value));
		if (this.cache.has(key) && JSON.stringify(value) === JSON.stringify(this.cache.get(key))) return Promise.resolve(value);
		typeof this._postprocessDefaults == 'function' && (value = this._postprocessDefaults(value));
		const now = Date.now();
		value = Object.assign({ createdTimestamp: now }, value, { updatedTimestamp: now });
		return this._createTransaction(objectStore => {
			return new Promise((resolve, reject) => {
				const query = objectStore.put(value);
				query.addEventListener('error', reject);
				query.addEventListener('success', () => {
					null !== value && (this.dispatchEvent(new CustomEvent('update', { detail: [this.cache.get(key) || (this.dispatchEvent(new CustomEvent('create', { detail: value })),
					null), value] })),
					this.cache.set(key, value));
					this.#db.dispatchEvent(new Event('stale'));
					resolve(value)
				})
			})
		})
	}

	async update(key, value) {
		return this.set(key, Object.assign({}, await this.get(key), value))
	}
}