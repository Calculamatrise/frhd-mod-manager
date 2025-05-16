import "../../utils/Storage.js";
import LocalDatabase from "../utils/LocalDatabase.js";
import "./elements/code-editor/CodeEditor.js";
import { formatUserScript, parseUserScript } from "./utils/metadata-block.js";
import "../shared/Zip.js";

const DOM = {
	Dialog: { script: document.querySelector('dialog#script') },
	Header: {
		saveChanges: document.querySelector('#save-changes'),
		search: document.querySelector('.search-bar')
	},
	Main: document.querySelector('body > main'),
	Nav: {
		createScript: document.querySelector('#create'),
		exportScripts: document.querySelector('#export'),
		importScript: document.querySelector('#import'),
		sidebarToggle: document.querySelector('#sidebar-toggle')
	},
	Template: {
		editorView: document.querySelector('template#editor'),
		scriptLabel: document.querySelector('template#label'),
		scriptTab: document.querySelector('template#tab')
	}
};

const Section = { scripts: DOM.Main.querySelector('section.scripts') };
const Main = { scriptTable: Section.scripts.querySelector('.script-table') };

const pushSearchState = callback => {
	let url = location.href.replace(location.search, '');
	const searchParams = new URLSearchParams(location.search);
	callback(searchParams);
	searchParams.size > 0 && (url += '?' + searchParams.toString());
	if (url === location.href) return;
	history.pushState(null, null, url)
};

const replaceSearchState = callback => {
	let url = location.href.replace(location.search, '');
	const searchParams = new URLSearchParams(location.search);
	// const initialSize = searchParams.size;
	callback(searchParams);
	searchParams.size > 0 && (url += '?' + searchParams.toString());
	if (url === location.href) return;
	// history[(initialSize >= searchParams ? 'replace' : 'push') + 'State'](null, null, url)
	history.replaceState(null, null, url)
};

const closeButton = DOM.Dialog.script.querySelector('[data-action="close"]');
closeButton.addEventListener('click', function() {
	DOM.Dialog.script.close()
}, { passive: true });

// SAVE FORM DATA IN SESSION
DOM.Dialog.script.addEventListener('close', async function() {
	const scriptId = this.dataset.id;
	scriptId ? (delete this.dataset.id,
	pushSearchState(searchParams => searchParams.delete('config'))) :
	replaceSearchState(searchParams => searchParams.delete('create'));
	DOM.Nav.createScript.disabled = false;
	if (this.returnValue !== 'submit') {
		this.returnValue = '';
		return;
	}

	let data = Object.fromEntries(new FormData(this.querySelector('form')).entries());
	if (scriptId) {
		// Update user script
		// data = await scriptStore.update(data.id, data);
		scriptStore.update(scriptId, {
			author: data.author,
			match: data.match,
			name: data.name.trim(),
			priority: data.priority,
			runAt: data.runAt,
			version: data.version
		});
	} else {
		// Create user script
		data = await scriptStore.append(data);
		const label = getScriptLabel(data, { createIfNotExists: true, open: true });
		label.click();
	}
});

const searchParams = new URLSearchParams(location.search);

let scriptStore = null;

globalThis.localDatabase = new LocalDatabase('userscripts');
localDatabase.addEventListener('open', () => {
	scriptStore = localDatabase.stores.get('scripts');
	scriptStore._preprocessDefaults = function(data) {
		return Object.assign({}, {
			content: '',
			createdTimestamp: Date.now(),
			enabled: true,
			id: crypto.randomUUID(),
			name: 'New user script'
		}, data)
	};
	scriptStore._postprocessDefaults = function(data) {
		return Object.assign({}, data, { updatedTimestamp: Date.now() })
	};
	searchParams.has('create') && DOM.Nav.createScript.click();
	scriptStore.addEventListener('cache', ({ detail: entries }) => {
		for (const entry of Array.from(entries.values()).sort((a, b) => a.priority - b.priority)) {
			const tab = getScriptLabel(entry, { createIfNotExists: true });
			searchParams.has('edit') && entry.id === searchParams.get('edit') && tab.click();
			searchParams.has('config') && entry.id === searchParams.get('config') && showScriptModal(entry)
		}
	});
	scriptStore.addEventListener('create', ({ detail: entry }) => {
		getScriptLabel(entry, { createIfNotExists: true, open: true })
	});
	scriptStore.addEventListener('delete', async ({ detail: entry }) => {
		entry && removeScriptLabel(entry.id)
	});
	scriptStore.addEventListener('update', ({ detail: [oldEntry, entry] }) => {
		null !== oldEntry && updateScriptLabel(entry)
		// update priorty listing
		sortScriptLabels()
	})
});

DOM.Nav.createScript.addEventListener('click', function() {
	this.disabled = true;
	replaceSearchState(searchParams => searchParams.set('create', true));
	DOM.Dialog.script.showModal()
}, { passive: true });

DOM.Header.saveChanges.addEventListener('click', updateCurrentScript, { passive: true });

DOM.Nav.importScript.addEventListener('click', async function() {
	this.disabled = true;
	this.classList.add('loading');
	const fileHandles = await showOpenFilePicker({
		excludeAcceptAllOption: true,
		multiple: true,
		// startIn: 'downloads',
		types: [{
			accept: {
				'application/zip': ['.zip'],
				'text/javascript': ['.user.js', '.user.mjs']
			},
			description: 'All User Scripts'
		}, {
			accept: { 'text/javascript': ['.user.js', '.user.mjs'] },
			description: 'User Script'
		}, {
			accept: { 'application/zip': ['.zip'] },
			description: 'Compressed User Scripts'
		}]
	}).catch(err => console.warn(err));
	if (fileHandles && fileHandles.length > 0) {
		const files = await Promise.all(fileHandles.map(fileHandle => fileHandle.getFile()));
		for (const file of files.filter(file => file.name.endsWith('.zip'))) {
			files.splice(files.indexOf(file), 1);
			const decompressed = await Zip.decompress(file);
			for (const file of Array.from(decompressed.values())) {
				files.push(file);
			}
		}

		for (const file of files) {
			const content = await file.text();
			const data = parseUserScript(content);
			data.runAt = data['run-at'];
			delete data['run-at'];
			data.createdTimestamp = file.lastModified;
			data.updatedTimestamp = file.lastModified;
			await scriptStore.append(data);
		}
	}

	this.classList.remove('loading');
	this.disabled = false
});

DOM.Nav.exportScripts.addEventListener('click', async function() {
	this.disabled = true;
	this.classList.add('loading');
	const scripts = Array.from(scriptStore.cache.values());
	const files = scripts.map(data => {
		const formatted = formatUserScript(data.content, {
			author: data.author,
			name: data.name,
			'run-at': data.runAt,
			match: data.match,
			version: data.version
		});
		const file = new File([formatted], data.name.toLowerCase().replace(/\W+/g, '-') + '.user.js');
		return file
	});
	const zip = await Zip.compress(files);
	const a = document.createElement('a');
	a.href = URL.createObjectURL(zip);
	a.download = 'userscripts.zip';
	a.click();

	this.classList.remove('loading');
	this.disabled = false
});

function showScriptModal(data) {
	pushSearchState(searchParams => searchParams.set('config', data.id));
	DOM.Dialog.script.dataset.id = data.id;
	for (const input of DOM.Dialog.script.querySelectorAll('[name]')) {
		const key = input.getAttribute('name');
		if (typeof data[key] == 'undefined') continue;
		input.value = data[key];
	}
	// fill info first
	DOM.Dialog.script.showModal()
}

function getScriptLabel(data, { createIfNotExists, open } = {}) {
	const existingScript = Main.scriptTable.querySelector('label.script-label[data-id="' + data.id + '"]');
	if (existingScript || !createIfNotExists) return existingScript;
	const clone = DOM.Template.scriptLabel.content.cloneNode(true);
	const label = clone.firstElementChild;
	label.dataset.id = data.id;
	label.dataset.priority = data.priority ?? 0;
	label.addEventListener('click', function({ target }) {
		if (target.closest('button') && !target.closest('button').isEqualNode(this)) return;
		else if (label.hasAttribute('for') && label.getAttribute('for').length > 1) return;
		const editorClone = DOM.Template.editorView.content.cloneNode(true);
		const editorView = editorClone.firstElementChild;
		const editor = editorClone.querySelector('code-editor');
		const input = editorClone.querySelector('input[type="radio"]');
		DOM.Template.editorView.before(editorClone);
		editor.autoComplete = chrome.storage.proxy.local.settings.autoComplete;
		editor.syntaxHighlights = chrome.storage.proxy.local.settings.highlightSyntax;
		editor.suggestions = chrome.storage.proxy.local.settings.showSuggestions;
		editor.setValue(data.content);
		editor.addEventListener('change', function() {
			const hasChanges = data.content !== this.getValue();
			editor.classList[hasChanges ? 'add' : 'remove']('unsaved');
			tab.classList[hasChanges ? 'add' : 'remove']('unsaved')
		});
		editor.addEventListener('save', async function() {
			await updateScript(data.id, this.getValue());
			editor.classList.remove('unsaved');
			tab.classList.remove('unsaved')
		});
		input.dataset.id = data.id;
		input.setAttribute('id', editor.editorId);
		input.addEventListener('change', onScriptsChanged);

		const tabClone = DOM.Template.scriptTab.content.cloneNode(true);
		const tab = tabClone.firstElementChild;
		const tabName = tab.querySelector('span');
		tabName.textContent = data.name;
		tab.setAttribute('for', editor.editorId);
		this.setAttribute('for', editor.editorId);
		const close = tabClone.querySelector('[data-action="close"]');
		close.addEventListener('click', function() {
			if (!confirm("Are you sure you want to close this editor? Unsaved changes will be lost forever!")) return;
			editorView.remove();
			tab.remove();
			label.removeAttribute('for');
			label.toggleAttribute('for', true);
			document.querySelector('#script-list-view').checked = true
		}, { passive: true });
		DOM.Template.scriptTab.before(tabClone);
		pushSearchState(searchParams => searchParams.set('edit', data.id))
	}, { passive: true });

	for (const column of clone.querySelectorAll('[data-name]')) {
		const key = column.dataset.name;
		switch (key) {
		case 'createdTimestamp':
		case 'updatedTimestamp':
			column.textContent = new Date(data[key]).toISOString().slice(0, 10);
			continue;
		}
		column.textContent = data[key];
	}
	// const moveButton = clone.querySelector('[data-action="reorder"]');
	// moveButton.addEventListener('lostpointercapture', function() {
	// 	label.style.removeProperty('z-index');
	// 	const sorted = Array.from(label.parentElement.children).sort((a, b) => a.getBoundingClientRect().y - b.getBoundingClientRect().y);
	// 	label.style.removeProperty('translate');
	// 	for (let priority in sorted) {
	// 		priority = parseInt(priority);
	// 		let label = sorted[priority];
	// 		let cachedValue = scriptStore.cache.get(label.dataset.id);
	// 		if (cachedValue && cachedValue == priority) continue;
	// 		scriptStore.update(label.dataset.id, { priority })
	// 	}
	// 	// this.parentElement.replaceChildren(...sorted);
	// }, { passive: true });
	// moveButton.addEventListener('pointerdown', ({ pointerId, target }) => target.setPointerCapture(pointerId), { passive: true });
	// moveButton.addEventListener('pointermove', function() {
	// 	if ((buttons & 1) !== 1) return;
	// 	const { bottom: bottomBoundary, top: topBoundary } = this.parentElement.getBoundingClientRect();
	// 	const { bottom, top } = this.getBoundingClientRect();
	// 	if ((top + movementY <= topBoundary) || (bottom + movementY >= bottomBoundary)) return;
	// 	this.style.setProperty('translate', '0 ' + (parseInt(this.style.getPropertyValue('translate').replace(/.+\s/, '').padStart(1, '0')) + movementY) + 'px')
	// }, { passive: true });
	// moveButton.addEventListener('pointerup', ({ pointerId, target }) => target.releasePointerCapture(pointerId), { passive: true });
	const downloadButton = clone.querySelector('[data-action="download"]');
	downloadButton.addEventListener('click', function() {
		const metadata = {
			author: data.author,
			name: data.name,
			'run-at': data.runAt,
			match: data.match,
			version: data.version
		};
		const formatted = formatUserScript(data.content, metadata);
		const file = new File([formatted], data.name.toLowerCase().replace(/\W+/g, '-') + '.user.js');
		const a = document.createElement('a');
		a.href = URL.createObjectURL(file);
		a.download = file.name;
		a.click()
	}, { passive: true });
	const editButton = clone.querySelector('[data-action="edit"]');
	editButton.addEventListener('click', function() {
		showScriptModal(data)
	}, { passive: true });
	const deleteButton = clone.querySelector('[data-action="delete"]');
	deleteButton.addEventListener('click', function() {
		confirm('Are you sure you want to delete this script?') && scriptStore.delete(data.id)
	}, { passive: true });
	Main.scriptTable.appendChild(clone);
	return label
}

function updateScriptLabel(options) {
	let label = getScriptLabel(options, { createIfNotExists: true });
	label.dataset.priority !== options.priority && (label.dataset.priority = options.priority);
	let metadata = Array.from(label.querySelectorAll('.metadata'));
	for (let element of metadata.filter(element => options.hasOwnProperty(element.dataset.key))) {
		element.innerText = options[element.dataset.key];
	}
	return label
}

function sortScriptLabels() {
	const sorted = Array.from(Main.scriptTable.children).sort((a, b) => a.dataset.priority - b.dataset.priority);
	Main.scriptTable.replaceChildren(...sorted)
}

function removeScriptLabel(id) {
	let label = getScriptLabel({ id });
	let exists = null !== label;
	exists && label.remove();
	return exists
}

async function updateScript(id, content) {
	const scriptExists = scriptStore.cache.has(id);
	if (!scriptExists) return;
	return scriptStore.update(id, { content })
}

async function updateCurrentScript() {
	DOM.Header.saveChanges.classList.add('loading');
	const workingScript = document.querySelector('.script:has(input[name="script"]:checked)');
	if (workingScript === null) {
		DOM.Header.saveChanges.classList.remove('loading');
		throw new Error("No script selected");
	}

	const editor = document.querySelector('input[type="radio"][name="scripts"]:checked + code-editor');
	if (!editor) return console.warn('Script not found:', editor);
	const res = await updateScript(workingScript.dataset.id, editor.getValue());
	DOM.Header.saveChanges.classList.remove('loading');
	return res
}

DOM.Header.search.addEventListener('input', function() {
	const entries = Array.from(Main.scriptTable.querySelectorAll('.script-label'));
	const nonEntries = Array.from(Main.scriptTable.children).filter(child => !entries.includes(child));
	for (const entry of entries) {
		entry.style.removeProperty('display');
	}

	entries.sort(({ textContent: a }, { textContent: b }) => {
		let lowerA = a.toLowerCase()
		  , lowerB = b.toLowerCase();
		return lowerA.localeCompare(lowerB)
	});

	Main.scriptTable.replaceChildren(...nonEntries, ...entries);

	const query = this.value.toLowerCase();
	if (query.length < 1) return;
	const matching = entries.filter(button => {
		let lower = button.textContent.toLowerCase()
		  , included = lower.includes(query);
		if (!included) {
			let lowerCharMap = charMap.call(lower)
			  , partial = true;
			for (const char of query) {
				let currentCharCount = charCount.call(query, char);
				if (!lower.includes(char) || currentCharCount > lowerCharMap[char]) {
					partial = false;
					break;
				}
			}
			included = partial;
		}
		return included
	});
	matching.sort(({ textContent: a }, { textContent: b }) => {
		let lowerA = a.toLowerCase()
		  , lowerB = b.toLowerCase();

		let startsA = lowerA.startsWith(query)
		  , startsB = lowerB.startsWith(query);
		if (startsA !== startsB)
			return startsA ? -1 : 1;

		let indexA = lowerA.indexOf(query)
		  , indexB = lowerB.indexOf(query);
		if (indexA !== indexB)
			return indexA - indexB;

		return lowerA.localeCompare(lowerB)
	});

	const hidden = entries.filter(entry => -1 === matching.indexOf(entry));
	for (const entry of hidden) {
		entry.style.setProperty('display', 'none');
	}

	Main.scriptTable.replaceChildren(...nonEntries, ...matching, ...hidden)
});

function charCount(char) {
	let match = this.match(new RegExp(char, 'g'));
	return match && match.length || 0
}

function charMap() {
	const map = {};
	for (const char of this) {
		map[char] = (map[char] || 0) + 1;
	}
	return map
}

for (const dialog in DOM.Dialog) {
	DOM.Dialog[dialog].addEventListener('click', clickToEscapeDialog);
}

function clickToEscapeDialog(event) {
	if (event.target.classList.contains('close-btn')) {
		return this.close('cancel');
	}

	const rect = this.getBoundingClientRect()
		, isInDialog = (rect.top <= event.clientY && event.clientY <= rect.top + rect.height &&
	rect.left <= event.clientX && event.clientX <= rect.left + rect.width);
	!isInDialog && this.close('cancel')
}


for (const input of document.querySelectorAll('[name="scripts"]')) {
	input.addEventListener('change', onScriptsChanged);
}

function onScriptsChanged() {
	if (!this.checked) return;
	const id = this.getAttribute('id');
	if (id === 'script-list-view') {
		return pushSearchState(searchParams => searchParams.delete('edit'));
	}

	pushSearchState(searchParams => searchParams.set('edit', this.getAttribute('id')))
}

window.addEventListener('popstate', function() {
	const searchParams = new URLSearchParams(location.search);
	if (searchParams.has('edit')) {
		const id = searchParams.get('edit');
		const input = document.querySelector(`input[data-id="${id}"]`); // document.getElementById(id);
		input && (input.checked = true);
	} else {
		const scriptListView = document.querySelector('#script-list-view');
		scriptListView && (scriptListView.checked = true);
	}

	if (searchParams.has('config')) {
		const id = searchParams.get('config');
		const label = document.querySelector(`label[data-id="${id}"]`);
		label?.click();
	} else {
		DOM.Dialog.script.close();
	}
});

chrome.storage.local.onChanged.addListener(function({ settings }) {
	if (!settings) return;
	const config = settings.newValue;
	for (const editor of document.querySelectorAll('code-editor')) {
		editor.autoComplete = config.autoComplete;
		editor.syntaxHighlights = config.highlightSyntax;
		editor.suggestions = config.showSuggestions;
	}
});