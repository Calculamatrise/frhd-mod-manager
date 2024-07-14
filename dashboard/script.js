import "../../utils/Storage.js";
import LocalDatabase from "../utils/LocalDatabase.js";
import USER_SCRIPT_TEMPLATE from "../constants/userscripttemplate.js";
import "./utils/CodeEditor.js";

const searchParams = new URLSearchParams(location.search);

let scriptStore = null;

globalThis.localDatabase = new LocalDatabase('userscripts');
localDatabase.on('open', () => {
	scriptStore = localDatabase.stores.get('scripts');
	scriptStore._preprocessDefaults = function(data) {
		return Object.assign({}, {
			content: '',
			createdTimestamp: Date.now(),
			enabled: true,
			id: crypto.randomUUID(),
			name: 'New user script'
		}, data)
	}
	scriptStore._postprocessDefaults = function(data) {
		return Object.assign({}, data, { updatedTimestamp: Date.now() })
	}
	searchParams.has('create') && create.click();
	scriptStore.on('cached', entries => {
		for (const entry of Array.from(entries.values()).sort((a, b) => a.priority - b.priority)) {
			let tab = getScriptLabel(entry.id, Object.assign({}, entry, { createIfNotExists: true }));
			searchParams.has('edit') && entry.id === searchParams.get('edit') && tab.click()
		}
	}),
	scriptStore.on('create', entry => {
		chrome.userScripts.register([Object.assign({}, USER_SCRIPT_TEMPLATE, {
			id: entry.id,
			js: [{ code: entry.content }]
		})]);
		getScriptLabel(entry.id, Object.assign({}, entry, { createIfNotExists: true, open: true }))
	}),
	scriptStore.on('delete', async entry => {
		removeScriptLabel(entry.id),
		entry.enabled && chrome.userScripts.unregister({ ids: [entry.id] })
	}),
	scriptStore.on('update', (oldEntry, entry) => {
		null !== oldEntry && entry.enabled && chrome.userScripts.update([Object.assign({}, USER_SCRIPT_TEMPLATE, {
			id: entry.id,
			js: [{ code: entry.content }]
		})]);
		null !== oldEntry && updateScriptLabel(entry.id, entry)
		// update priorty listing
		sortScriptLabels();
		console.log('priority changed')
	})
});

const create = document.querySelector('#create');
const editor = document.querySelector('.code-editor');
const firstLine = editor.firstElementChild;
const scripts = document.querySelector('.scripts > tbody');
create.addEventListener('click', () => {
	createScriptForm({
		data: {
			id: crypto.randomUUID(),
			name: searchParams.get('create')?.trim(),
			priority: 1 + scriptStore.cache.size
		},
		partial: true,
		submitText: 'Create',
		title: 'Create new script',
		submit: async data => {
			// getScriptLabel(data.name, { createIfNotExists: true, id: data.id, open: true }),
			data = await scriptStore.update(data.id, data);
			console.log(data)
			editor.replaceChildren(firstLine),
			editor.style.removeProperty('display');
			return Promise.resolve('create')
		}
	}).showModal()
}, { passive: true });
// searchParams.has('create') && create.click();

editor.addEventListener('input', event => event.target.contains(firstLine) || event.target.prepend(firstLine))
editor.addEventListener('keydown', function(event) {
	switch(event.key.toLowerCase()) {
	case 's':
		if (!event.ctrlKey) break;
		event.preventDefault();
		let currentScript = document.querySelector(':has(> input[name="script"]:checked)');
		currentScript && updateScript(currentScript.dataset.id)
	}
});

function createForm({ close, dialog = true, open, referenceId, submit, submitText, title } = {}) {
	let form = document.body.appendChild(createElement((dialog ? 'dialog' : 'div') + '.form'));
	dialog && typeof close == 'function' && form.addEventListener('close', close);
	let ttl = form.appendChild(document.createElement('h3'));
	ttl.innerText = title;
	form.appendChild(document.createElement('hr'));
	let subForm = form.appendChild(document.createElement('form'));
	subForm.classList.add('action-row');
	let sub = subForm.appendChild(document.createElement('button'));
	sub.addEventListener('click', async event => {
		event.preventDefault();
		event.target.classList.add('loading');
		typeof submit == 'function' && await submit(Object.assign(Object.fromEntries(Array.from(form.querySelectorAll('[data-key]')).map(node => [node.dataset.key, node.value || node.innerText])), referenceId && { id: referenceId })).then(res => {
			typeof res == 'string' && form.close(res)
		});
		event.target.classList.remove('loading')
	});
	sub.innerText = submitText || 'Save Changes';
	let cancel = subForm.appendChild(document.createElement('button'));
	cancel.setAttribute('formmethod', 'dialog');
	cancel.setAttribute('value', 'cancel');
	cancel.innerText = 'Cancel';
	dialog && open && form.showModal();
	return form
}

function createScriptForm({ data, partial } = {}) {
	let dialog = createForm(Object.assign({
		referenceId: data.id
	}, arguments[0]));
	dialog.firstElementChild.after(...[createElement('label', {
		innerText: 'Name',
		children: [createElement('input', {
			dataset: { key: 'name' },
			placeholder: 'Name',
			style: { display: 'block' },
			type: 'text',
			value: data.name || 'New user script'
		})]
	}), createElement('label', {
		innerText: 'Author',
		children: [createElement('input', {
			dataset: { key: 'author' },
			placeholder: 'You',
			readOnly: true,
			style: { display: 'block' },
			type: 'text',
			value: data.author || ''
		})]
	}), !partial && createElement('label', {
		innerText: 'Contributing Authors',
		children: [createElement('input', {
			dataset: { key: 'author' },
			placeholder: 'Authors',
			style: { display: 'block' },
			type: 'text'
		})]
	}), createElement('label', {
		innerText: 'Run at',
		children: [createElement('select', {
			children: [createElement('option', {
				innerText: 'Canvas load',
				value: 'canvas-load'
			}), createElement('option', {
				innerText: 'Document load',
				value: 'dom-load'
			}), createElement('option', {
				innerText: 'Game load',
				value: 'game-load'
			}), createElement('option', {
				innerText: 'Initial Keypress',
				value: 'initial-keypress'
			})],
			dataset: { key: 'runAt' },
			style: { display: 'block' },
			value: data.runAt || 'game-load'
		})]
	}), createElement('label', {
		innerText: 'Version',
		children: [createElement('input', {
			dataset: { key: 'version' },
			placeholder: 'Version',
			style: { display: 'block' },
			type: 'text',
			value: data.version || '0.0.1'
		})]
	})].filter(element => element instanceof HTMLElement));
	return dialog
}

function getScriptLabel(id, { createdTimestamp, createIfNotExists, name, open, priority, updatedTimestamp } = {}) {
	return scripts.querySelector('label.script[data-id="' + id + '"]') || createIfNotExists && scripts.appendChild(createElement('label.script', {
		dataset: { id, priority },
		children: [createElement('td.metadata', {
			dataset: { key: 'name' },
			innerText: name
		}), createElement('td.metadata', {
			dataset: { key: 'createdAt' },
			innerText: updatedTimestamp && new Date(updatedTimestamp).toISOString().slice(0, 10)
		}), createElement('td.metadata', {
			dataset: { key: 'createdAt' },
			innerText: createdTimestamp && new Date(createdTimestamp).toISOString().slice(0, 10)
		}), createElement('td.action-row', {
			children: [createElement('input', {
				checked: Boolean(open),
				name: 'script',
				style: { display: 'none' },
				type: 'radio',
				onchange: event => openScript(event.target.closest('.script').dataset.id)
			}), createElement('button', {
				innerText: '≡'
			}), createElement('button', {
				innerText: '✎', // ⛭
				onclick: () => {
					let dialog = createScriptForm({
						data: { id, name },
						title: 'Edit Script Properties',
						submit: data => {
							console.log(data)
							return scriptStore.update(data.id, {
								name: data.name.trim(),
								updatedAt: Date.now()
							})
						}
					});
					dialog.showModal();
					console.log(dialog)
				}
			}), createElement('button.danger', {
				innerText: '🗑', // x
				onclick() {
					confirm('Are you sure you want to delete this script?') && (scriptStore.delete(id),
					this.closest('.script').remove())
				}
			})]
		})],
		onlostpointercapture() {
			this.style.removeProperty('z-index');
			const sorted = Array.from(this.parentElement.children).sort((a, b) => a.getBoundingClientRect().y - b.getBoundingClientRect().y);
			this.style.removeProperty('translate');
			for (let priority in sorted) {
				priority = parseInt(priority);
				let label = sorted[priority];
				let cachedValue = scriptStore.cache.get(label.dataset.id);
				if (cachedValue && cachedValue == priority) continue;
				scriptStore.update(label.dataset.id, { priority })
			}
			// this.parentElement.replaceChildren(...sorted);
		},
		onpointerdown: event => event.target.setPointerCapture(event.pointerId),
		onpointermove({ buttons, movementY }) {
			if ((buttons & 1) !== 1) return;
			const { bottom: bottomBoundary, top: topBoundary } = this.parentElement.getBoundingClientRect();
			const { bottom, top } = this.getBoundingClientRect();
			if ((top + movementY <= topBoundary) || (bottom + movementY >= bottomBoundary)) return;
			this.style.setProperty('translate', '0 ' + (parseInt(this.style.getPropertyValue('translate').replace(/.+\s/, '').padStart(1, '0')) + movementY) + 'px')
		},
		onpointerup: event => event.target.releasePointerCapture(event.pointerId)
	})) || null
}

function updateScriptLabel(id, options) {
	let label = getScriptLabel(id, Object.assign({}, options, { createIfNotExists: true }));
	label.dataset.priority !== options.priority && (label.dataset.priority = options.priority);
	let metadata = Array.from(label.querySelectorAll('.metadata'));
	for (let element of metadata.filter(element => options.hasOwnProperty(element.dataset.key))) {
		element.innerText = options[element.dataset.key];
	}
	return label
}

function sortScriptLabels() {
	const sorted = Array.from(scripts.children).sort((a, b) => a.dataset.priority - b.dataset.priority);
	scripts.replaceChildren(...sorted);
}

function removeScriptLabel(id) {
	let label = getScriptLabel(id);
	let exists = null !== label;
	exists && label.remove();
	return exists
}

function createElement(type, options = {}) {
	const callback = arguments[arguments.length - 1];
	const element = document.createElement(type.replace(/[\.#].+/g, ''));
	const matchId = type.match(/(?<=#)([^\.]+((?<=\\)\.)?)+/);
	null !== matchId && (element.setAttribute('id', matchId[0].replace(/\\/g, '')),
	type = type.replace('#' + matchId[0], ''));
	const classList = type.match(/(?<=\.)([^\.#]+((?<=\\)\.)?)+/g);
	null !== classList && element.classList.add(...classList.map(name => name.replace(/\\/g, '')));
	if ('innerText' in options) {
		element.innerText = options.innerText;
		delete options.innerText;
	}

	for (const attribute in options) {
		if (typeof options[attribute] == 'object') {
			if (options[attribute] instanceof Array) {
				if (/^children$/i.test(attribute)) {
					element.append(...options[attribute].filter(element => element instanceof HTMLElement));
				} else if (/^classlist$/i.test(attribute)) {
					element.classList.add(...options[attribute]);
				} else if (/^on/i.test(attribute)) {
					for (const listener of options[attribute])
						element.addEventListener(attribute.slice(2), listener, { passive: !/\.preventDefault\(\)/g.test(listener.toString()) });
				}
			} else if (/^(dataset|style)$/i.test(attribute))
				Object.assign(element[attribute.toLowerCase()], options[attribute]);
			delete options[attribute]
		}
	}

	Object.assign(element, options);
	return typeof callback == 'function' && callback(element), element
}

let lastOpenScriptId = null;
async function openScript(id) {
	lastOpenScriptId && await updateScript(lastOpenScriptId);
	let script = scriptStore.cache.get(id);
	script && (editor.setContent(script.content),
	editor.style.removeProperty('display'),
	lastOpenScriptId = script.id)
}

async function updateScript(id) {
	let scriptExists = scriptStore.cache.has(id);
	if (!scriptExists) return;
	let content = editor.toString();
	console.log(scriptExists)
	return scriptStore.update(id, { content })
}