import EventEmitter from "../shared/EventEmitter.js";

export default class Store extends EventEmitter {
	#db = null;
	cache = new Map();
	name = null;
	constructor(name, db) {
		super();
		this.#db = db,
		this.name = name,
		this._cache(),
		Object.defineProperty(this, 'cache', { enumerable: false })
	}

	_cache() {
		return this._createTransaction(objectStore => {
			return new Promise((resolve, reject) => {
				const query = objectStore.getAll();
				query.addEventListener('error', reject),
				query.addEventListener('success', ({ target }) => {
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
					this.emit('delete', this.cache.get(key)),
					this.cache.delete(key),
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
		if (this.cache.has(key) && JSON.stringify(value) === JSON.stringify(this.cache.get(key))) return Promise.resolve(value);
		return this._createTransaction(objectStore => {
			return new Promise((resolve, reject) => {
				const query = objectStore.put(value);
				query.addEventListener('error', reject),
				query.addEventListener('success', () => {
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