const Events = {
	ButtonDown: 'game:buttonDown',
	ButtonUp: 'game:buttonUp',
	CheckpointCreate: 'game:checkpointCreate',
	Draw: 'game:draw',
	GameReady: 'game:ready',
	GameStateChange: 'game:stateChange',
	ModHook: 'mod:hook',
	PlayerUpdate: 'game:playerUpdate',
	// RaceStart: 'game:initialKeypress',
	Tick: 'game:tick'
};

class ThirdPartyScriptManager extends EventTarget {
	static Events = Events;

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
				parent.game.ctx ||= parent.game.canvas.getContext('2d');
				this.#loaded = (this.dispatchEvent(new CustomEvent(Events.GameReady, { detail: parent.game })), !0);
				this.#eventsCreated || this.#createEvents();
			}
			this.#loaded && this.dispatchEvent(new CustomEvent(Events.GameStateChange, { detail: state }))
		});
		this.#parent = parent;
		self.hasOwnProperty('navigation') && navigation.addEventListener('navigate', () => this.#loaded = !1, { passive: true })
	}

	#eventsCreated = false;
	#createEvents() {
		this.#eventsCreated = true;
		const target = this;
		const currentScene = this.#parent.game.currentScene;
		this._modProto(currentScene, (proto, superProto) => {
			proto.draw = function() {
				// Needs to b after clearRect
				// const defaultPrevented = !target.dispatchEvent(new CustomEvent(Events.BeforeDraw, {
				// 	cancelable: true,
				// 	detail: this
				// }));
				// if (defaultPrevented) return;
				superProto.draw.apply(this, arguments);
				target.dispatchEvent(new CustomEvent(Events.Draw, { detail: this.game.ctx }))
			};
			proto.update = function() {
				superProto.update.apply(this, arguments);
				target.dispatchEvent(new CustomEvent(Events.Tick, { detail: this }))
			}
		});

		const playerManager = currentScene.playerManager;
		const firstPlayer = playerManager.firstPlayer;
		this._modProto(firstPlayer, (proto, superProto) => {
			proto.createBaseVehicle = function() {
				const defaultPrevented = !target.dispatchEvent(new CustomEvent(Events.PlayerUpdate, {
					cancelable: true,
					detail: {
						args: arguments,
						eventType: 'createBaseVehicle',
						player: this
					}
				}));
				if (defaultPrevented) return;
				superProto.createBaseVehicle.apply(this, arguments)
			};
			proto.createCheckpoint = function() {
				const defaultPrevented = !target.dispatchEvent(new CustomEvent(Events.CheckpointCreate, {
					cancelable: true,
					detail: {
						args: arguments,
						player: this
					}
				}));
				if (defaultPrevented) return;
				superProto.createCheckpoint.apply(this, arguments)
			};
			proto.createTempVehicle = function() {
				const defaultPrevented = !target.dispatchEvent(new CustomEvent(Events.PlayerUpdate, {
					cancelable: true,
					detail: {
						args: arguments,
						eventType: 'createTempVehicle',
						player: this
					}
				}));
				if (defaultPrevented) return;
				superProto.createTempVehicle.apply(this, arguments)
			};
			proto.draw = function() {
				const defaultPrevented = !target.dispatchEvent(new CustomEvent(Events.PlayerDraw, {
					cancelable: true,
					detail: {
						args: arguments,
						player: this
					}
				}));
				if (defaultPrevented) return;
				superProto.draw.apply(this, arguments)
			};
			proto.reset = function() {
				const defaultPrevented = !target.dispatchEvent(new CustomEvent(Events.PlayerUpdate, {
					cancelable: true,
					detail: {
						args: arguments,
						eventType: 'reset',
						player: this
					}
				}));
				if (defaultPrevented) return;
				superProto.reset.apply(this, arguments)
			};
			proto.restartScene = function() {
				const defaultPrevented = !target.dispatchEvent(new CustomEvent(Events.PlayerUpdate, {
					cancelable: true,
					detail: {
						args: arguments,
						eventType: 'restartScene',
						player: this
					}
				}));
				if (defaultPrevented) return;
				superProto.restartScene.apply(this, arguments)
			};
			proto.setBaseVehicle = function() {
				const defaultPrevented = !target.dispatchEvent(new CustomEvent(Events.PlayerUpdate, {
					cancelable: true,
					detail: {
						args: arguments,
						eventType: 'setBaseVehicle',
						player: this
					}
				}));
				if (defaultPrevented) return;
				superProto.setBaseVehicle.apply(this, arguments)
			};
			proto.update = function() {
				const defaultPrevented = !target.dispatchEvent(new CustomEvent(Events.PlayerUpdate, {
					cancelable: true,
					detail: {
						args: arguments,
						player: this
					}
				}));
				if (defaultPrevented) return;
				superProto.update.apply(this, arguments)
			}
		});

		const gamepad = firstPlayer._gamepad;
		this._modProto(gamepad, (proto, superProto) => {
			proto.setButtonDown = function(key) {
				if (this.downButtons[key] === false) {
					const defaultPrevented = !target.dispatchEvent(new CustomEvent(Events.ButtonDown, {
						cancelable: true,
						detail: { key, player: this }
					}));
					if (defaultPrevented) return;
				}
				superProto.setButtonDown.apply(this, arguments)
			};
			proto.setButtonUp = function(key) {
				if (this.downButtons[key] === true) {
					const defaultPrevented = !target.dispatchEvent(new CustomEvent(Events.ButtonUp, {
						cancelable: true,
						detail: { key, player: this }
					}));
					if (defaultPrevented) return;
				}
				superProto.setButtonUp.apply(this, arguments)
			}
		})
	}

	get game() { return this.#parent.game }

	_modProto(target, callback) {
		if (typeof callback != 'function')
			throw new TypeError('Second positional argument: callback must be of type: function');
		const proto = Object.getPrototypeOf(target)
			, superProto = Object.defineProperties({}, Object.getOwnPropertyDescriptors(proto));
		callback(proto, superProto);
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
				this.dispatchEvent(new CustomEvent(Events.ModHook, { detail: name }));
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

self.ModManager || Object.defineProperty(self, 'ModManager', {
	value: new ThirdPartyScriptManager(GameManager),
	writable: true
});