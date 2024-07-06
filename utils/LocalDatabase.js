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
		let req = indexedDB.open(name, version ?? 1);
		req.addEventListener('error', err => this.emit('error', err));
		req.addEventListener('success', ({ target }) => {
			this._db = target.result,
			this.name = name,
			this.version = this._db.version;
			for (const storeName of this._db.objectStoreNames) {
				this.stores.set(storeName, new Store(storeName, this._db));
			}
			this.emit('open')
		});
		req.addEventListener('upgradeneeded', ({ target }) => {
			this._db = target.result,
			this._db.addEventListener('error', err => this.emit('error', err)),
			this._db.createObjectStore('drafts'),
			this._db.createObjectStore('scripts', { keyPath: 'id' }),
			this.emit('upgrade')
		});
		Object.defineProperty(this, '_db', { enumerable: false })
	}

	createStore(key, options = {}) {
		return this._db.createObjectStore(key, Object.assign({ keyPath: 'id' }, options))
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
		return this.stores.has(key) && (this._db.deleteObjectStore(key),
		this.stores.delete(key))
	}

	close() {
		this._db.addEventListener('close', code => {
			this._db = null,
			this.emit('close', code),
			this.off()
		}, { once: true }),
		this._db.close()
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
}