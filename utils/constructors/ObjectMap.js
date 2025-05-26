export default class CuteMap {
	constructor(object = null) {
		if (typeof object != 'object')
			throw new TypeError("object not iterable");
		Object.assign(this, object)
	}
	delete(key) { return this.has(key) && delete this[key] }
	has(key) { return Object.hasOwn(this, key) }
	get(key) { return this[key] ?? null }
	set(key, value) {
		if (typeof key != 'string' && typeof key != 'number')
			throw new TypeError("Key must be of type string.");
		this[key] = value
	}
	update(key, value) {
		if (typeof this[key] == 'object' && this[key] !== null &&
			typeof value == 'object' && value !== null)
			value = Object.assign(this[key], value);
		return this.set(key, value)
	}
}