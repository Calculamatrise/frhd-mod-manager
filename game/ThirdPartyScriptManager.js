class ThirdPartyScriptManager extends EventTarget {
	#loaded = !1;
	#cache = new Map();
	#parent = null;
	constructor(parent) {
		super();
		// Property name options: externalScripts, mods,
		// thirdPartyScripts, scriptManager, modManager
		Object.defineProperty(parent, 'mods', { value: this, writable: true });
		parent.on('stateChange', state => {
			if (state.preloading === !1 && this.#loaded === !1) {
				this.#loaded = (this.dispatchEvent(new CustomEvent('ready', { detail: parent.game })), !0);
				this.#eventsCreated || this.#createEvents();
			}
			this.#loaded && this.dispatchEvent(new CustomEvent('stateChange', { detail: state }))
		});
		this.#parent = parent;
		self.hasOwnProperty('navigation') && navigation.addEventListener('navigate', () => this.#loaded = !1, { passive: true })
	}

	#eventsCreated = false;
	#createEvents() {
		this.#eventsCreated = true;
		const target = this;
		const currentScene = this.#parent.game.currentScene;
		this._modProto(currentScene, proto => {
			const _draw = proto.draw;
			proto.draw = function() {
				const defaultPrevented = !target.dispatchEvent(new CustomEvent('beforeDraw', {
					cancelable: true,
					detail: this
				}));
				if (defaultPrevented) return;
				_draw.apply(this, arguments);
				target.dispatchEvent(new CustomEvent('draw', { detail: this }))
			};
			const _update = proto.update;
			proto.update = function() {
				_update.apply(this, arguments);
				target.dispatchEvent(new CustomEvent('tick', { detail: this }))
			}
		});

		const playerManager = currentScene.playerManager;
		const firstPlayer = playerManager.firstPlayer;
		this._modProto(firstPlayer, proto => {
			const _createBaseVehicle = proto.createBaseVehicle;
			proto.createBaseVehicle = function() {
				const defaultPrevented = !target.dispatchEvent(new CustomEvent('playerUpdate', {
					cancelable: true,
					detail: {
						args: arguments,
						eventType: 'createBaseVehicle',
						player: this
					}
				}));
				if (defaultPrevented) return;
				_createBaseVehicle.apply(this, arguments)
			};
			const _createCheckpoint = proto.createCheckpoint;
			proto.createCheckpoint = function() {
				const defaultPrevented = !target.dispatchEvent(new CustomEvent('checkpointCreate', {
					cancelable: true,
					detail: {
						args: arguments,
						player: this
					}
				}));
				if (defaultPrevented) return;
				_createCheckpoint.apply(this, arguments)
			};
			const _createTempVehicle = proto.createTempVehicle;
			proto.createTempVehicle = function() {
				const defaultPrevented = !target.dispatchEvent(new CustomEvent('playerUpdate', {
					cancelable: true,
					detail: {
						args: arguments,
						eventType: 'createTempVehicle',
						player: this
					}
				}));
				if (defaultPrevented) return;
				_createTempVehicle.apply(this, arguments)
			};
			const _draw = proto.draw;
			proto.draw = function() {
				const defaultPrevented = !target.dispatchEvent(new CustomEvent('playerDraw', {
					cancelable: true,
					detail: {
						args: arguments,
						player: this
					}
				}));
				if (defaultPrevented) return;
				_draw.apply(this, arguments)
			};
			const _reset = proto.reset;
			proto.reset = function() {
				const defaultPrevented = !target.dispatchEvent(new CustomEvent('playerUpdate', {
					cancelable: true,
					detail: {
						args: arguments,
						eventType: 'reset',
						player: this
					}
				}));
				if (defaultPrevented) return;
				_reset.apply(this, arguments)
			};
			const _restartScene = proto.restartScene;
			proto.restartScene = function() {
				const defaultPrevented = !target.dispatchEvent(new CustomEvent('playerUpdate', {
					cancelable: true,
					detail: {
						args: arguments,
						eventType: 'restartScene',
						player: this
					}
				}));
				if (defaultPrevented) return;
				_restartScene.apply(this, arguments)
			};
			const _setBaseVehicle = proto.setBaseVehicle;
			proto.setBaseVehicle = function() {
				const defaultPrevented = !target.dispatchEvent(new CustomEvent('playerUpdate', {
					cancelable: true,
					detail: {
						args: arguments,
						eventType: 'setBaseVehicle',
						player: this
					}
				}));
				if (defaultPrevented) return;
				_setBaseVehicle.apply(this, arguments)
			};
			const _update = proto.update;
			proto.update = function() {
				const defaultPrevented = !target.dispatchEvent(new CustomEvent('playerUpdate', {
					cancelable: true,
					detail: {
						args: arguments,
						player: this
					}
				}));
				if (defaultPrevented) return;
				_update.apply(this, arguments)
			}
		})
	}

	_modProto(target, callback) {
		const proto = Object.getPrototypeOf(target);
		callback(proto);
		return Object.setPrototypeOf(target, proto)
	}

	hook(instance, { name, overwrite } = {}) {
		name ??= instance.name ?? instance._name;
		if (overwrite || !this.#cache.has(name)) {
			this.#cache.set(name, instance);
			if (!this.hasOwnProperty(name)) {
				Object.defineProperty(this, name, {
					configurable: true,
					value: instance
				});
			}
		}
		return this.#cache.get(name)
	}

	includes(name) {
		return this.#cache.has(name)
	}
}

Object.defineProperty(self, 'ThirdPartyScriptManager', {
	value: ThirdPartyScriptManager,
	writable: true
});

let GameManager = self.GameManager;
const start = Date.now();
while (!GameManager) {
	GameManager = self.GameManager;
	if (Date.now() - start > 5e3)
		console.warn('GameManager load timed out.');
		break;
}

GameManager && (self.ModManager || Object.defineProperty(self, 'ModManager', {
	value: new ThirdPartyScriptManager(GameManager),
	writable: true
}));