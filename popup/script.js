import "../utils/Storage.js";
import defaults from "../constants/defaults.js";
import LocalDatabase from "../utils/LocalDatabase.js";

globalThis.localDatabase = new LocalDatabase('userscripts');
localDatabase.addEventListener('open', function() {
	const scriptStore = this.stores.get('scripts');
	scriptStore.addEventListener('cache', async ({ detail: cache }) => {
		const tabId = await chrome.tabs.query({ active: true, currentWindow: true })
			.then(([tab]) => tab?.id);
		const tabInfo = await chrome.storage.session.get()
			.then(entries => entries[tabId] || null);
		const activeScripts = document.querySelector('#active-scripts');
		const disabledScripts = document.querySelector('.disabled-scripts > .scripts');
		const scripts = document.querySelector('#scripts');
		const entries = Array.from(cache.values());
		for (const entry of entries.sort((a, b) => a.priority - b.priority)) {
			const tab = scripts.appendChild(document.createElement('label'));
			tab.classList.add('script', 'ripple');
			tabInfo && tabInfo.activeScriptIds.includes(entry.id) && tab.classList.add('active');
			tab.dataset.id = entry.id;
			const duplicateName = entries.find(e => e !== entry && e.name === entry.name);
			if (duplicateName) {
				tab.dataset.author = entry.author;
				tab.classList.add('has-duplicate-name');
			}

			const checkbox = tab.appendChild(document.createElement('input'));
			checkbox.setAttribute('type', 'checkbox');
			checkbox.checked = entry.enabled; // ≡ - for sorting/ordering
			checkbox.addEventListener('change', event => scriptStore.update(entry.id, { enabled: event.target.checked }));
			tab.append(entry.name);

			const actionRow = tab.appendChild(document.createElement('div'));
			actionRow.classList.add('action-row');
			const edit = actionRow.appendChild(document.createElement('button'));
			edit.style.setProperty('aspect-ratio', 1);
			edit.innerText = '✎';
			edit.addEventListener('click', () => {
				window.open(chrome.runtime.getURL('dashboard/index.html?edit=' + entry.id))
			});

			tab.classList.contains('active') && activeScripts.appendChild(tab);

			if (chrome.storage.proxy.local.settings.hideDisabledScripts) {
				!entry.enabled && disabledScripts.appendChild(tab)
			}
		}
	})
});

const state = document.querySelector('#state');
state.addEventListener('click', function() {
	if (this.classList.contains('update-available')) {
		return chrome.runtime.reload();
	}

	chrome.storage.proxy.local.set('enabled', !chrome.storage.proxy.local.get('enabled'))
}, { passive: true });

chrome.storage.local.onChanged.addListener(({ enabled }) => {
	enabled && setState(enabled.newValue)
});

chrome.storage.local.get(({ badges, enabled }) => {
	for (const element of document.querySelectorAll('.notification')) {
		if (badges === false) {
			element.classList.remove('notification');
			continue;
		}

		element.addEventListener('click', event => {
			chrome.storage.local.set({ badges: false }).then(() => {
				event.target.classList.remove('notification')
			})
		}, { passive: true });
	}

	setState(enabled)
});

chrome.storage.session.get(({ updateAvailable = false }) => {
	updateAvailable && state.classList.add('update-available') // chrome.action.setBadgeText({ text: '' });
});

const resetSettings = document.querySelector('#reset-settings');
resetSettings.addEventListener('click', () => {
	confirm(`Are you sure you'd like to reset all your settings?`) && chrome.storage.local.set({ settings: defaults }).then(() => {
		alert("Your settings have successfully been reset.")
	})
}, { passive: true });

const update = document.querySelector('#update');
update.addEventListener('click', async () => {
	if (update.dataset.updateAvailable) {
		chrome.runtime.reload();
		return;
	}
	update.classList.add('loading'),
	await chrome.runtime.requestUpdateCheck().then(res => {
		res.status === 'update_available' && (update.classList.add('safe'),
		update.innerText = 'Update',
		update.dataset.updateAvailable = true)
	});
	update.classList.remove('loading')
}, { passive: true });

const addScript = document.querySelector('#create');
addScript.addEventListener('click', () => {
	// chrome.runtime.openOptionsPage('?create')
	window.open(chrome.runtime.getURL('dashboard/index.html?create'))
}, { passive: true });

function setState(enabled) {
	state.classList[enabled ? 'add' : 'remove']('enabled');
	return enabled
}