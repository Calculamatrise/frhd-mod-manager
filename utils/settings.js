import defaults from "../constants/defaults.js";

chrome.storage.local.onChanged.addListener(({ settings }) => settings && restoreSettings(settings.newValue));
chrome.storage.local.get(({ settings }) => restoreSettings(settings));

for (const item in defaults) {
	let element = document.getElementById(item);
	switch (item) {
	default:
		element && element.type === 'checkbox' && element.addEventListener('input', ({ target }) => {
			chrome.storage.proxy.local.settings.set(target.id, target.checked)
		}, { passive: true })
	}
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