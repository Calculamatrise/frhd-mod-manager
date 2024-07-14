import "../utils/Storage.js";
import defaults from "../constants/defaults.js";
import LocalDatabase from "../utils/LocalDatabase.js";

globalThis.localDatabase = new LocalDatabase('userscripts');
localDatabase.on('open', function() {
	const scriptStore = this.stores.get('scripts');
	scriptStore.on('cached', entries => {
		let scripts = document.querySelector('.scripts');
		for (const entry of Array.from(entries.values()).sort((a, b) => a.priority - b.priority)) {
			let tab = scripts.appendChild(document.createElement('label'));
			tab.classList.add('ripple');
			tab.dataset.id = entry.id;
			let checkbox = tab.appendChild(document.createElement('input'));
			checkbox.setAttribute('type', 'checkbox');
			checkbox.checked = entry.enabled; // ≡ - for sorting/ordering
			checkbox.addEventListener('change', event => scriptStore.update(entry.id, { enabled: event.target.checked }));
			tab.append(entry.name);
			let edit = tab.appendChild(document.createElement('button'));
			edit.style.setProperty('display', 'inline-block');
			edit.style.setProperty('float', 'right');
			edit.style.setProperty('padding', '0 2%');
			edit.innerText = '✎';
			edit.addEventListener('click', () => {
				window.open(chrome.runtime.getURL('dashboard/index.html?edit=' + entry.id))
			})
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

chrome.storage.local.onChanged.addListener(({ enabled, settings }) => {
	settings && restoreSettings(settings.newValue),
	enabled && setState(enabled.newValue)
});

chrome.storage.local.get(({ badges, enabled, settings }) => {
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

	restoreSettings(settings),
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
	// chrome.runtime.openOptionsPage()
	window.open(chrome.runtime.getURL('dashboard/index.html?create'))
}, { passive: true });

for (const item in defaults) {
	let element = document.getElementById(item);
	switch (item) {
	default:
		element && element.type === 'checkbox' && element.addEventListener('input', ({ target }) => {
			chrome.storage.proxy.local.settings.set(target.id, target.checked)
		}, { passive: true })
	}
}

document.documentElement.addEventListener('pointerdown', function (event) {
	this.style.setProperty('--offsetX', event.offsetX),
	this.style.setProperty('--offsetY', event.offsetY)
});

function setState(enabled) {
	state.classList[enabled ? 'add' : 'remove']('enabled');
	return enabled
}

function restoreSettings(data) {
	for (const item in data) {
		let element = document.getElementById(item);
		switch (item) {
		default:
			element && element.type === 'checkbox' && (element.checked = data[item])
		}
	}
}