import defaults from "./constants/defaults.js";
import LocalDatabase from "./utils/LocalDatabase.js";
import USER_SCRIPT_TEMPLATE from "./constants/userscripttemplate.js";

const contentScripts = [{
	excludeMatches: [
		"*://*/*\?ajax*",
		"*://*/*&ajax*",
		"*://*.com/*api/*"
	],
	id: "game",
	js: ["game/ThirdPartyManager.js"],
	matches: [
		"*://frhd.kanoapps.com/*",
		"*://www.freeriderhd.com/*"
	],
	runAt: "document_end",
	world: "MAIN"
}];

chrome.runtime.onStartup.addListener(function() {
	self.dispatchEvent(new ExtendableEvent('activate'))
});

chrome.runtime.onUpdateAvailable.addListener(function() {
	chrome.storage.session.set({ updateAvailable: true }).then(() => {
		chrome.action.setBadgeText({ text: '1' })
	})
});

chrome.storage.local.onChanged.addListener(function({ enabled }) {
	enabled && setState({ enabled: enabled.newValue })
});

self.addEventListener('activate', function() {
	chrome.storage.local.get(({ enabled }) => {
		enabled || setState({ enabled })
	})
});

self.addEventListener('install', async function() {
	const scripts = await chrome.scripting.getRegisteredContentScripts();
	scripts.length == 0 && chrome.scripting.registerContentScripts(contentScripts);
	chrome.storage.local.get(({ enabled = true, settings }) => {
		chrome.storage.local.set({
			enabled,
			badges: true,
			settings: Object.assign(defaults, settings)
		})
	}),
	chrome.userScripts.configureWorld({ csp: 'MAIN' })
}, { once: true });

async function setState({ enabled = true }) {
	const path = size => `/icons/${enabled ? '' : 'disabled/'}icon_${size}.png`;
	chrome.action.setIcon({
		path: {
			16: path(16),
			48: path(48),
			128: path(128)
		}
	});
	enabled ? (chrome.scripting.getRegisteredContentScripts().then(scripts => scripts.length > 0 || chrome.scripting.registerContentScripts(contentScripts)),
	registerUserScripts()) : (chrome.scripting.unregisterContentScripts(),
	chrome.userScripts.unregister())
}

function registerUserScripts() {
	LocalDatabase.open('userscripts').then(database => {
		const scriptStore = database.stores.get('scripts');
		scriptStore.on('cached', entries => {
			for (const entry of Array.from(entries.values())/* .filter(({ enabled }) => enabled) */) {
				chrome.userScripts.register([Object.assign({}, USER_SCRIPT_TEMPLATE, {
					id: entry.id,
					js: [{ code: entry.content }]
				})])
			}
		})
	})
}