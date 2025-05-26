import defaults from "./constants/defaults.js";
import LocalDatabase from "./utils/constructors/LocalDatabase.js";

const hostnames = [
	'freeriderhd.com',
	'frhd.kanoapps.com',
	'www.freeriderhd.com'
];

const contentScripts = [{
	excludeMatches: [
		"*://*/*\?ajax*",
		"*://*/*&ajax*",
		"*://*.com/*api/*"
	],
	id: "script-manager",
	js: ["content/ThirdPartyScriptManager.js"],
	matches: hostnames.map(host => `*://${host}/*`),
	runAt: "document_end",
	world: "MAIN"
}];

chrome.runtime.onStartup.addListener(async function() {
	self.dispatchEvent(new ExtendableEvent('activate'))
});

chrome.runtime.onUpdateAvailable.addListener(function() {
	chrome.storage.session.set({ updateAvailable: true }).then(() => {
		chrome.action.setBadgeText({ text: '1' })
		// chrome.action.setBadgeBackgroundColor({ color: '#FF0000' })
	})
});

chrome.storage.local.onChanged.addListener(function({ enabled }) {
	enabled && setState({ enabled: enabled.newValue })
});

self.addEventListener('activate', function() {
	chrome.storage.local.get(async ({ enabled }) => {
		typeof enabled != 'undefined' && setState({ enabled })
	})
});

self.addEventListener('install', async function() {
	chrome.storage.local.get(({ enabled = true, settings }) => {
		chrome.storage.local.set({
			enabled,
			badges: true,
			settings: Object.assign(defaults, settings)
		})
	})
}, { once: true });

async function setState({ enabled = true }) {
	const path = size => `/icons/${enabled ? '' : 'disabled/'}icon_${size}.png`;
	if (enabled) {
		const scripts = await chrome.scripting.getRegisteredContentScripts();
		const toRegister = contentScripts.filter(({ id: query }) => -1 === scripts.findIndex(({ id }) => id === query));
		toRegister.length > 0 && await chrome.scripting.registerContentScripts(toRegister);
		// chrome.webNavigation.onCommitted.addListener(onCommitted, {
		// 	url: hostnames.map(hostEquals => ({
		// 		hostEquals,
		// 		schemes: ['http', 'https']
		// 	}))
		// });
		await chrome.action.setBadgeBackgroundColor({ color: '#8AB4F8' });
	} else {
		// chrome.webNavigation.onCommitted.removeListener(onCommitted);
		await chrome.scripting.unregisterContentScripts();
		await chrome.action.setBadgeBackgroundColor({ color: '#808080' });
	}

	return chrome.action.setIcon({
		path: {
			16: path(16),
			48: path(48),
			128: path(128)
		}
	})
}

chrome.webNavigation.onCommitted.addListener(onCommitted, {
	url: hostnames.map(hostEquals => ({
		hostEquals,
		schemes: ['http', 'https']
	}))
});

async function onCommitted({ tabId, url }) {
	if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:') || url === 'data:') return;

	const parsedUrl = new URL(url);
	if (!hostnames.includes(parsedUrl.hostname)) return;

	await onRemoved(tabId);
	if (!await new Promise(res => chrome.storage.local.get(({ enabled }) => res(enabled)))) {
		return chrome.action.setBadgeText({ text: '' });
	}

	const scripts = await getUserScripts({ enabled: true });
	for (const userScript of scripts) {
		await chrome.scripting.executeScript({
			target: { tabId },
			func: injectUserScript,
			args: [userScript],
			world: 'MAIN'
		});
	}

	await chrome.storage.session.set({ [tabId]: {
		activeScripts: scripts.length,
		activeScriptIds: scripts.map(({ id }) => id)
	}});
	await chrome.action.setBadgeText({ text: String(scripts.length) })
}

chrome.tabs.onActivated.addListener(function({ tabId }) {
	chrome.storage.session.get(tabs => {
		const tab = tabs[tabId];
		chrome.action.setBadgeText({ text: String(tab?.activeScripts || '') })
	})
});

chrome.tabs.onRemoved.removeListener(onRemoved);

function onRemoved(tabId) {
	return chrome.storage.session.remove(String(tabId))
}

async function injectUserScript(userScript) {
	const run = scope => {
		self = userScript;
		const script = document.createElement('script');
		script.textContent = scope ? `(function(){${userScript.content}}).call(globalThis.${scope} || self)` : userScript.content;
		document.documentElement.appendChild(script);
		script.remove()
	};

	try {
		switch (userScript.runAt) {
		case 'canvas-load':
			const waitForElement = (selector, callback) => {
				return new Promise((res, rej) => {
					const observer = new MutationObserver(() => {
						const element = document.querySelector(selector);
						if (!element) return;
						clearTimeout(timeout);
						observer.disconnect();
						typeof callback == 'function' && callback(element);
						res(element)
					});

					observer.observe(document, {
						childList: true,
						subtree: true
					});

					const timeout = setTimeout(() => {
						observer.disconnect();
						rej(new RangeError(`Query Search Timeout: Element '${selector}' not found within 10 seconds`))
					}, 10e3)
				})
			};
			await waitForElement('#game-container > canvas');
			run('document.querySelector(\'#game-container > canvas\')');
			break;
		case 'dom-load':
			Application.events.subscribe('mainview.loaded', () => run('document'));
			window.addEventListener('load', () => run('document'), { once: true });
			break;
		case 'game-load':
			ModManager.addEventListener(ThirdPartyScriptManager.Events.GameReady, () => run('GameManager'));
			break;
		case 'initial-keypress':
			ModManager.addEventListener(ThirdPartyScriptManager.Events.GameReady, function() {
				const firstPlayer = GameManager.game.currentScene.playerManager.firstPlayer
					, gamepad = firstPlayer._gamepad
					, onButtonDown = gamepad.onButtonDown;
				gamepad.onButtonDown = function() {
					gamepad.onButtonDown = onButtonDown;
					run('GameManager');
					return onButtonDown.apply(this, arguments)
				}
			});
			break;
		default:
			run()
		}
	} catch (err) {
		console.warn('%cFree Rider Mod Manager', 'background: hsl(207, 40%, 40%);border-radius: 5px;color: white;font-size: .9em;font-weight: bold;padding: .15em .5em;', err)
	}
}

function getUserScripts(options) {
	return new Promise((res, rej) => {
		LocalDatabase.open('userscripts').then(database => {
			const scriptStore = database.stores.get('scripts');
			scriptStore.addEventListener('cache', ({ detail: cache }) => {
				let userScripts = Array.from(cache.values()).sort((a, b) => a.priority - b.priority);
				for (const key in options) {
					userScripts = userScripts.filter(userScript => userScript[key] === options[key]);
				}
				res(userScripts)
			}, { once: true })
		});
		setTimeout(() => rej(new RangeError('Database read operation timed out')), 3e3)
	})
}

import "./utils/external.js";