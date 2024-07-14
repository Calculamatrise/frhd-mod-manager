import EventEmitter from "../shared/EventEmitter.js";
import Store from "./Store.js";

export default class LocalDatabase extends EventEmitter {
	_db = null;
	name = null;
	stores = new Map();
	version = 0;
	constructor(name, version) {
		super();
		let callback = arguments[arguments.length - 1];
		typeof callback != 'function' && (callback = null);
		typeof callback == 'function' && this.once('open', callback);
		this.#open(name, version);
		Object.defineProperty(this, '_db', { enumerable: false }),
		chrome.storage.session.onChanged.addListener(function(data) {
			let _dbKey = this.name + 'db_stale';
			if (!data[_dbKey] || typeof data[_dbKey].newValue != 'number') return;
			if (data[_dbKey].newValue === this._db.staleVersion) {
				delete this._db.staleVersion;
				console.log('yas')
				return;
			}
			this.emit('stale');
			for (const store of this.stores.values()) {
				store._cache()
			}
		})
	}

	#open(name, version, upgrade) {
		this.close();
		return new Promise(async (resolve, reject) => {
			let req = indexedDB.open(name, Math.max(version || 1, await this.constructor.version(name)));
			req.addEventListener('error', err => (this.emit('error', err), reject(err)));
			req.addEventListener('success', ({ target: { result: db }}) => {
				this._db = db,
				this._db.addEventListener('stale', event => {
					let _dbKey = this.name + 'db_stale';
					this._db.staleVersion = 1 + (chrome.storage.proxy.session[_dbKey] | 0);
					chrome.storage.session.set({ [_dbKey]: this._db.staleVersion }),
					chrome.storage.session.remove(_dbKey)
				}),
				this.name = name,
				this.version = this._db.version;
				for (const storeName of Array.from(this.stores.keys()).filter(storeName => !this._db.objectStoreNames.contains(storeName))) {
					this.stores.delete(storeName),
					this.emit('storeDelete', storeName);
				}
				for (const storeName of Array.from(this._db.objectStoreNames).filter(storeName => !this.stores.has(storeName))) {
					const store = new Store(storeName, this._db);
					this.stores.set(storeName, store),
					this.emit('storeCreate', store);
				}
				resolve(db),
				this.emit('open')
			});
			req.addEventListener('upgradeneeded', ({ target: { result: db }}) => {
				this._db = db,
				this._db.addEventListener('error', err => this.emit('error', err)),
				this.#createObjectStore('bin'),
				this.#createObjectStore('drafts'),
				this.#createObjectStore('scripts', { keyPath: 'id' }),
				typeof upgrade == 'function' && upgrade(db),
				this.emit('upgrade')
			});
			req.addEventListener('versionchange', ({ newVersion }) => this.version !== newVersion && this.update(newVersion))
		})
	}

	#createObjectStore(storeName, options) {
		return !this._db.objectStoreNames.contains(storeName) && this._db.createObjectStore(storeName, options)
	}

	createStore(key, options = {}) {
		return new Promise(async (resolve, reject) => {
			if (this._db.objectStoreNames.contains(key)) {
				return resolve(this.stores.get(key));
			}
			await this.#open(this.name, this.version + 1, () => {
				this.#createObjectStore(key, options)
			}).catch(reject);
			resolve(this.stores.get(key))
		})
	}

	delete() {
		return new Promise((resolve, reject) => {
			let req = indexedDB.deleteDatabase(this.name);
			req.addEventListener('blocked', this.close.bind(this)),
			req.addEventListener('error', reject),
			req.addEventListener('success', resolve)
		})
	}

	deleteStore(key) {
		return new Promise(async (resolve, reject) => {
			if (!this._db.objectStoreNames.contains(key)) {
				return resolve(false);
			}
			await this.#open(this.name, this.version + 1, db => {
				db.objectStoreNames.contains(key) && db.deleteObjectStore(key)
			}).catch(reject);
			resolve(true)
		})
	}

	close() {
		this._db && (this._db.addEventListener('close', code => {
			this._db = null,
			this.emit('close', code),
			this.off()
		}, { once: true }),
		this._db.close())
	}

	refresh() {
		return this.update(this.version)
	}

	async update(version) {
		await this.#open(this.name, version || this.version)
	}

	static async getInfo(name) {
		return indexedDB.databases().then(databases => {
			return databases.find(db => db.name === name) || null
		})
	}

	static open(name, version) {
		return new Promise((res, rej) => {
			const database = new this(name, version);
			var resolve = () => {
				database.off('error', reject);
				return res(database)
			  }
			  , reject = err => {
				database.off('open', resolve);
				return rej(err)
			  }
			database.once('open', resolve),
			database.once('error', reject)
		})
	}

	static async version(name) {
		return indexedDB.databases().then(arr => {
			let db = arr.find(db => db.name === name);
			return db ? db.version : null
		})
	}
}