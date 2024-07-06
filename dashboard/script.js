import "../../utils/Storage.js";
import LocalDatabase from "../utils/LocalDatabase.js";
import USER_SCRIPT_TEMPLATE from "../constants/userscripttemplate.js";
import Caret from "./utils/Caret.js";
import SyntaxHighlighter from "./utils/SyntaxHighlighter.js";

const searchParams = new URLSearchParams(location.search);

let scriptStore = null;

globalThis.localDatabase = new LocalDatabase('userscripts');
localDatabase.on('open', () => {
	scriptStore = localDatabase.stores.get('scripts');
	scriptStore.on('cached', entries => {
		for (const entry of entries.values()) {
			let tab = createTab(entry.name, entry);
			searchParams.has('edit') && entry.id === searchParams.get('edit') && tab.click()
		}
	}),
	scriptStore.on('create', entry => {
		chrome.userScripts.register([Object.assign({}, USER_SCRIPT_TEMPLATE, {
			id: entry.id,
			js: [{ code: entry.content }]
		})])
	}),
	scriptStore.on('delete', entry => entry.enabled && chrome.userScripts.unregister([entry.id])),
	scriptStore.on('update', (oldEntry, entry) => {
		null !== oldEntry && chrome.userScripts.update([Object.assign({}, USER_SCRIPT_TEMPLATE, {
			id: entry.id,
			js: [{ code: entry.content }]
		})])
	})
});

const create = document.querySelector('#create');
const editor = document.querySelector('.code-editor');
const firstLine = editor.firstElementChild;
const tabs = document.querySelector('.tabs');
create.addEventListener('click', () => {
	createTab('New user script', { open: true }),
	editor.replaceChildren(firstLine),
	editor.style.removeProperty('display')
}, { passive: true });
searchParams.has('create') && create.click();

editor.addEventListener('focus', event => {
	if (event.parentElement !== editor) return;
	firstLine.focus()
	// let selection = document.getSelection();
	// console.log(event.target)
	// // selection.setPosition(event.target, 1)
	// console.log(event)
	// event.target.textContent.trim().length < 1 && Caret.setCurrentCursorPosition(0, firstLine)
});

editor.addEventListener('input', event => event.target.contains(firstLine) || event.target.prepend(firstLine))
editor.addEventListener('keydown', function(event) {
	switch(event.key.toLowerCase()) {
	case 's':
		if (!event.ctrlKey) break;
		event.preventDefault();
		let currentScript = document.querySelector(':has(> input[name="script"]:checked)');
		currentScript && scriptStore.update(currentScript.dataset.id, {
			content: editor.innerText
		})
	}
});

// if ('EditContext' in window) {
// 	const editContext = new EditContext();
// 	editor.editContext = editContext,
// 	editContext.addEventListener("textupdate", event => {
// 		editor.innerHTML = "";

// 		const text = editContext.text;
// 		const { selectionStart, selectionEnd } = event;

// 		// Render the text before the selection.
// 		const textBefore = document.createElement("span");
// 		textBefore.textContent = text.substring(0, selectionStart);
	
// 		// Render the selected text, or caret.
// 		const textSelected = document.createElement("span");
// 		textSelected.classList.add("selection");
// 		textSelected.textContent = text.substring(selectionStart, selectionEnd);
	
// 		// Render the text after the selection.
// 		const textAfter = document.createElement("span");
// 		textAfter.textContent = text.substring(selectionEnd);
	
// 		editor.appendChild(textBefore);
// 		editor.appendChild(textSelected);
// 		editor.appendChild(textAfter);
	
// 		console.log(`Text before selection: ${textBefore.textContent}`);
// 		console.log(`Selected text: ${textSelected.textContent}`);
// 		console.log(`Text after selection: ${textAfter.textContent}`);
// 	});
// }

tabs.addEventListener('click', async event => {
	if (event.target.tagName != 'LABEL') return;
	await updateCurrentScript();
	let script = scriptStore.cache.get(event.target.dataset.id);
	script && (editor.innerHTML = script.content.split('\n').map(line => '<div>' + line + '</div>').join('\n'),
	editor.style.removeProperty('display'))
}, { passive: true });

let observer = new MutationObserver(function(mutations, observer) {
	let selection = document.getSelection();
	for (const mutation of mutations) {
		switch(mutation.type) {
		case 'childList':
			// mutation.target.append(...mutation.removedNodes)
			for (const code of Array.from(mutation.removedNodes).filter(node => /^code$/i.test(node.tagName))) {
				mutation.target.append(code.textContent.slice(0, -1)),
				Caret.setCurrentCursorPosition(mutation.target.textContent.length, mutation.target)
			}
			break;
		default:
			let selection = document.getSelection();
			console.dir(mutation.target);
			console.log(selection)
			let originalPosition = Caret.getCurrentCursorPosition(selection.anchorNode);
			let anchorNode = selection.anchorNode;
			console.log(mutation.oldValue, mutation.target.textContent, mutation);
			const nodes = SyntaxHighlighter.parseLine(mutation.target.data);
			nodes.length > 1 && (mutation.target.replaceWith(...nodes),
			/* selection.setPosition(nodes.filter(t => typeof t != 'string').at(-1), 1) */
			/* selection.setPosition(nodes.filter(t => typeof t != 'string').at(-1), 1) */
			// Caret.setCurrentCursorPosition(originalPosition, editor)
			console.log(mutation.oldValue, mutation.target.textContent),
			// Caret.setCurrentCursorPosition(editor.textContent.length - 1, editor)
			selection.collapse(nodes.filter(t => typeof t != 'string').at(-1).parentElement, 2));
			// if (/function$/.test(mutation.target.data)) {
			// 	// var keywords = [ "public", "class", "function", "private", "static", "return", "void" ];
			// 	// for (var i = 0; i < keywords.length; i++)
			// 	// {
			// 	// 		var regex = new RegExp("([^A-z0-9])(" + keywords[i] + ")([^A-z0-9])(?![^<]*>|[^<>]*</)", "g");
			// 	// 		regex.test(mutation.target.data) && (mutation.target.data = mutation.target.data.replace(regex, "$1<code class='function'>$2</code>$3"));
			// 	// }
			// 	let selection = document.getSelection();
			// 	let code = document.createElement('code');
			// 	code.classList.add('success');
			// 	code.innerText = mutation.target.data;
			// 	mutation.target.replaceWith(code);
			// 	selection.setPosition(code, 1)
			// 	// selection.setPosition(code, 1)
			// } else if (/[\(\[\{]$/.test(mutation.target.data)) {
			// 	let selection = document.getSelection();
			// 	mutation.target.data += /\($/.test(mutation.target.data) ? ')' : /\[$/.test(mutation.target.data) ? ']' : '}';
			// 	selection.setPosition(mutation.target, 1)
			// }
		}
	}
});
observer.observe(editor, {
	characterData: true,
	characterDataOldValue: true,
	childList: true,
	subtree: true
});

function createTab(name, { id, open }) {
	let tab = tabs.appendChild(document.createElement('label'));
	tab.classList.add('tab');
	tab.dataset.id = id || crypto.randomUUID();
	tab.innerText = name;
	let radio = tab.appendChild(document.createElement('input'));
	radio.setAttribute('name', 'script');
	radio.setAttribute('type', 'radio');
	radio.style.setProperty('display', 'none');
	open && (radio.checked = true);
	let row = tab.appendChild(document.createElement('div'));
	row.classList.add('action-row');
	let edit = row.appendChild(document.createElement('button'));
	edit.innerText = '✎';
	let del = row.appendChild(document.createElement('button'));
	del.classList.add('danger');
	del.innerText = '🗑';
	del.addEventListener('click', () => confirm('Are you sure you want to delete this script?') && (scriptStore.delete(tab.dataset.id),
	tab.remove()), { passive: true })
	return tab
}

function createElement(tag, options) {
	return Object.assign(document.createElement(tag), options)
}

async function updateCurrentScript() {
	let currentScript = document.querySelector(':has(> input[name="script"]:checked)');
	if (!currentScript) return;
	let scriptExists = scriptStore.cache.has(currentScript.dataset.id);
	if (!scriptExists) {
		return scriptStore.set(currentScript.dataset.id, {
			content: editor.innerText,
			createdTimestamp: Date.now(),
			description: null,
			enabled: true,
			id: currentScript.dataset.id,
			name: 'New user script'
		});
	}
	return scriptStore.update(currentScript.dataset.id, {
		content: editor.innerText
	})
}