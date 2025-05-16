import Caret from "./utils/caret.js";

export default class CodeEditor extends HTMLElement {
	static styleSheet = (() => {
		const sheet = new CSSStyleSheet();
		sheet.replaceSync(`
			:host {
				--accent: 221;
				background-color: hsl(var(--accent) 13% 18%);
				box-sizing: border-box;
				caret-color: hsl(219 13.5% 71%);
				color:hsl(219 13.5% 71%);
				color-scheme: dark;
				counter-reset: line;
				font-family: monospace;
				font-size: clamp(12px, 1.5vmax, 14px);
				min-height: 2em;
				min-width: 14em;
				outline: none;
				overflow: auto scroll;
				padding-left: 1em;
				position: relative;
				scrollbar-color: hsl(var(--accent) 10% 50% / 50%) transparent;
				tab-size: 4;
				white-space: pre;
				width: 100%;
			}

			:host(:hover) { scrollbar-color: hsl(var(--accent) 10% 50% / 75%) transparent }
			::selection {
				background-color: hsl(0deg 0% 40% / 25%);
				border-radius: 4px;
				overflow: hidden;
			}

			:host(:focus) ::selection { background-color: hsl(0deg 0% 75% / 25%) }
			:host > .editor {
				height: 100%;
				margin: 0;
				min-width: 100%;
				outline: none;
				width: fit-content;
			}

			:host([data-lang="js"]),
			:host([data-lang="css"]) code.tag,
			:host([data-lang="html"]) code.tag { color: hsl(355, 65%, 65%) }
			:host > pre > * {
				counter-increment: line;
				line-height: 1.2em;
				margin-left: 2rem;
				min-height: 1em;
				padding-right: 1.5em;
				white-space: pre;
			}

			:host > pre > .focused { background-color: hsl(var(--accent) 15% 20%) }
			:host > pre > ::before {
				color: hsl(var(--accent) 50% 80% / 40%);
				content: counter(line);
				display: inline-block;
				left: 0;
				/* margin-right: 1.5em; */
				min-width: 2em;
				position: absolute;
				text-align: right;
			}
			:host > pre > :empty::after { content: "\\200B" }

			code:is(.boolean, .null, .number) { color: #D19A58 }
			code:is(.bracket, .parenthesis, .parentheses, .symbol) { color: #ABB2BF }
			code.parameter { font-style: italic }
			code:is(.parameter, .property, .variable) { color: #E06C75 }
			code:is(.function, .method) { color: #4FAFE3 }
			:is(code, em).comment { color: #7f848e }
			code:is(.enum, .escape, .sign) { color: #56b6c2 }
			code.string { color: #98C379 }

			:host([data-lang="css"]) code:is(.function, .pseudo) { color: #56b6c2 }
			:host([data-lang="css"]) code:is(.font-face, .important, .query) { color: #C678DD }
			:host([data-lang="css"]) code:is(.class, .value) { color: #D19A58 }

			:host([data-lang="js"]) code.constant { color: #E5C07B }
			:host([data-lang="js"]) code:is(.keyword, .arrowFn, .ternary) { color: #C678DD }
		
			.suggestions {
				background-color: hsl(var(--accent) 13% 18%);
				border: 1px solid hsl(0 0% 0% / 25%);
				border-radius: 4px;
				display: flex;
				flex-direction: column;
				max-height: 25%;
				max-width: 100%;
				overflow: auto;
				position: fixed;
				top: 100%;
				z-index: 1;
			}
			:has(> .suggestions) { position: relative }
			.suggestions > * {
				background: none;
				border: none;
				padding: .25em .5em;
				text-align: left;
			}
			.suggestions > :hover { background-color: hsl(0deg 0% 50% / 25%) }
		`);
		return sheet
	})();

	autoComplete = false;
	debounceThreshold = 10;
	suggestions = false;
	syntaxHighlights = true;
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
		this.shadowRoot.adoptedStyleSheets = [this.constructor.styleSheet];
		const editor = document.createElement('pre');
		editor.contentEditable = true;
		editor.classList.add('editor');
		const firstLine = document.createElement('div');
		firstLine.classList.add('line');
		editor.appendChild(firstLine);
		this.shadowRoot.append(editor);
		this.root = editor;
		// this.caret = new Caret(editor);
		this.constructor.integrateDebounce(this.highlightLines, { context: this, delay: 10 });
		Object.defineProperties(this, {
			_observer: {
				value: null,
				writable: true
			},
			caret: {
				value: null,
				writable: true
			},
			editorId: {
				value: crypto.randomUUID(),
				writable: true
			}
		})
	}

	connectedCallback() {
		this.caret = new Caret(this.root);
		this.addEventListener('input', this.handleInput, { passive: true });
		this.addEventListener('keydown', this.handleKeyDown);
		this.addEventListener('paste', this.handlePaste);
		document.addEventListener('selectionchange', this._boundFocus = this.handleFocus.bind(this));
		this._observer = new MutationObserver(mutations => {
			for (const mutation of mutations) {
				switch(mutation.type) {
				case 'childList':
					const addedNodes = Array.from(mutation.addedNodes);
					for (const node of addedNodes.filter(node => !(node instanceof HTMLDivElement))) {
						const div = document.createElement('div');
						div.classList.add('line');
						div.innerHTML = node.textContent;
						node.replaceWith(div)
					}
				}
			}
		});
		this._observer.observe(this.root, { childList: true });
		this.constructor.syntaxHighlighter.addEventListener('message', ({ data }) => {
			if (data.editorId !== this.editorId) return;
			switch (data.type) {
			case 0:
				// this.innerHTML = data.raw;
				let nodes = [];
				for (let line of data.lines) {
					let div = document.createElement('div');
					div.classList.add('line');
					if (line.find(item => typeof item == 'object')) {
						div.replaceChildren(...line.map(str => {
							if (typeof str == 'object') {
								const code = document.createElement('code');
								code.classList.add(str.type);
								code.textContent = str.string;
								return code;
							} else {
								return str
							}
						}));
					} else {
						line = line.join('');
						line.length > 0 && (div.innerHTML = line);
					}
					nodes.push(div);
				}
				// this.root.replaceChildren(...nodes);
				this.replaceChildren(...nodes);
				break;
			case 1: {
				const lineIndex = data.lineIndex;
				const line = this.root.children[lineIndex];
				if (!line) break;
				const div = document.createElement('div');
				div.classList.add('line');
				if (data.line.find(item => typeof item == 'object')) {
					div.replaceChildren(...data.line.map(str => {
						if (typeof str == 'object') {
							const code = document.createElement('code');
							code.classList.add(str.type);
							code.textContent = str.string;
							return code;
						} else {
							return str
						}
					}));
				} else {
					const lineContent = data.line.join('');
					lineContent.length > 0 && (div.innerHTML = lineContent);
				}
				// Restore caret position
				this.replaceChild(line, div)
			}
				break;
			case 2:
				for (const i in data.lines) {
					const lineIndex = data.lineIndices[i];
					const line = this.root.children[lineIndex];
					if (!line) break;
					const lineData = data.lines[i];
					const div = document.createElement('div');
					div.classList.add('line');
					if (lineData.find(item => typeof item == 'object')) {
						div.replaceChildren(...lineData.map(str => {
							if (typeof str == 'object') {
								const code = document.createElement('code');
								code.classList.add(str.type);
								code.textContent = str.string;
								return code;
							} else {
								return str
							}
						}));
					} else {
						const lineContent = lineData.join('');
						lineContent.length > 0 && (div.innerHTML = lineContent);
					}
					this.replaceChild(line, div)
				}
			}
		})

		// fetch('/elements/code-editor/CodeEditor.js').then(r => r.text()).then(r => {
		// 	this.setValue(r)
		// })
	}

	disconnectedCallback() {
		document.removeEventListener('selectionchange', this._boundFocus);
		this.removeEventListener('input', this.handleInput);
		this.removeEventListener('keydown', this.handleKeyDown);
		this.removeEventListener('paste', this.handlePaste);
		this._observer.disconnect();
		this._observer = null
	}

	handleFocus() {
		const lines = this.root.querySelectorAll('.line.focused');
		lines.forEach(line => line.classList.remove('focused'));
		if (this.caret.selection.toString().length > 0) return;
		const focusedLine = this.caret.closest('.line');
		focusedLine && focusedLine.classList.add('focused')
	}

	handleInput(event) {
		const line = this.caret.closest('.line');
		if (!line) return;
		const pos = Caret.getPosition(line);
		if (/^[`'"\)\]\}]$/.test(event.data) && event.data === line.textContent.slice(pos, pos + 1)) {
			line.replaceChildren(line.innerText.slice(0, pos) + line.innerText.slice(pos + 1));
			Caret.setPosition(pos, line);
		} else {
			let insert = null;
			if (event.inputType === 'insertParagraph') return;
			switch(event.data) {
			case '\'':
			case '"':
			case '`':
				insert = event.data;
				break;
			case '(':
				insert = String.fromCharCode(1 + event.data.charCodeAt());
				break;
			case '[':
			case '{':
				insert = String.fromCharCode(2 + event.data.charCodeAt())
			}

			if (insert !== null) {
				line.replaceChildren(line.innerText.slice(0, pos) + insert + line.innerText.slice(pos));
				Caret.setPosition(pos, line);
			}
		}

		this.dispatchEvent(new CustomEvent('change'));
		// Rename event -- recursive loop
		// const wasPrevented = !this.dispatchEvent(new CustomEvent('input', {
		// 	cancelable: true,
		// 	detail: event.data
		// }));
		// Have regex test if anything matches highlight syntax
		this.syntaxHighlights && this.constructor.debounce(this.highlightLines, line)
		// this.syntaxHighlights && this.highlightLines(line)
	}

	handleKeyDown(event) {
		// remove suggestiosn
		const element = this.root.querySelector('.suggestions');
		element && element.remove();
		switch(event.key.toLowerCase()) {
		case '/':
			if (!event.ctrlKey) break;
			event.preventDefault();
			{
				const position = Caret.getPositionWithin(this.root);
				let nodes = this.caret.getSelectedNodes();
				-1 !== nodes.findIndex(node => node.tagName !== 'DIV') && (nodes = nodes.map(node => node.parentElement.closest('div') || node.parentElement));
				nodes = nodes.filter(node => node.textContent);
				const comment = -1 !== nodes.findIndex(node => !node.textContent.startsWith('// '));
				// .replace(/^(\s{4})+/gm, match => '\t'.repeat(match.length / 4)); // replace spaces with tabs
				nodes.forEach(node => comment ? node.prepend('// ') : node.textContent = node.textContent.slice(3));
				// console.log(position, nodes)
				!comment && this.caret.setPosition(position - 3);
				this.syntaxHighlights && this.highlightLines(...nodes);
				// set selection
			}
			break;
		case '[':
		case ']':
			if (!event.ctrlKey) break;
			event.preventDefault();
			{
				const line = this.caret.closest('.line');
				// const selection = Caret.getSelectionWithin(this.root);
				const position = Caret.getPositionWithin(line); // Caret.getPositionWithin(this.root);
				let nodes = this.caret.getSelectedNodes();
				-1 !== nodes.findIndex(node => node.tagName !== 'DIV') && (nodes = nodes.map(node => node.parentElement.closest('div') || node.parentElement));
				nodes = nodes.filter(node => node.textContent);
				const add = event.key === ']';
				nodes.forEach(node => add ? node.prepend('\t') : node.textContent = node.textContent.replace(/^(?:\t|\s{1,4})/, ''));
				!add && Caret.setPosition(position - 1, line);
				// !add && Caret.setSelectionWithin(line, selection.start, selection.end);
				this.syntaxHighlights && this.highlightLines(...nodes);
				// console.log(selection)
				// !add && Caret.setSelectionWithin(line, selection.start, selection.end);
				// set selection
			}
			break;
		case 'backspace':
			this.root.children.length <= 1 && this.root.textContent.length < 1 && event.preventDefault();
			break;
		case 'enter':
			event.preventDefault();
			const nodesSelected = this.caret.getSelectedNodes('.line');
			if (!nodesSelected || nodesSelected.length < 1) break;
			const anchorNode = nodesSelected[0];
			console.warn('Debug', anchorNode);
			const anchorPosition = Caret.getPositionWithin(anchorNode);
			const extentNode = nodesSelected.at(-1);
			const extentPosition = Caret.getPositionWithin(extentNode);
			const newLine = document.createElement('div');
			newLine.classList.add('line');
			newLine.innerText = extentNode.textContent.slice(extentPosition);
			anchorNode.textContent = anchorNode.textContent.slice(0, anchorPosition);
			if (nodesSelected.length > 1) {
				for (let i = 1; i < nodesSelected.length; i++) {
					nodesSelected[i].remove();
				}
			}

			anchorNode.after(newLine);
			Caret.setPosition(0, newLine);
			this.syntaxHighlights && this.highlightLines(anchorNode, newLine);
			break;
		case 's':
			if (!event.ctrlKey) break;
			event.preventDefault();
			this.dispatchEvent(new CustomEvent('save', { detail: this.innerText }));
			break;
		case 'tab':
			if (element) break;
			event.preventDefault();
			{
				const line = this.caret.closest('.line');
				const position = Caret.getPositionWithin(line);
				const text = line.textContent;
				line.textContent = text.slice(0, position) + '\t' + text.slice(position);
				Caret.setPosition(position + 1, line);
			}
		}

		if (this.suggestions) {
			this._suggestions?.remove();
			const input = /^[\w\.]$/.test(event.key) ? event.key : '';
			if (event.key.length === 1 && input.length < 1) return;
			const line = this.caret.closest('.line')
				, position = Caret.getPositionWithin(line)
				, text = line.textContent.slice(0, position - (event.key === 'Backspace')) + input
				, matches = /(?<!\.)(?:\b\w+\.?)*$/.exec(text);
			matches && matches[0].length > 0 && this.showSuggestions(matches[0])
		}
	}

	handlePaste(event) {
		event.preventDefault();
		const selectionWithin = Caret.getSelectionWithin(this.root);
		const content = this.getValue();
		const prefix = content.slice(0, selectionWithin.start);
		const suffix = content.slice(selectionWithin.end);
		const pastedContent = event.clipboardData.getData('text/plain');
		// console.log(selectionWithin, this.caret.position)
		this.setValue(prefix + pastedContent + suffix);
		this.caret.setPosition(selectionWithin.end + pastedContent.length)
	}

	get value() {
		return this.getValue()
	}

	set value(textContent) {
		this.setValue(textContent)
	}

	getValue() {
		let textContent = [];
		for (let div of this.root.children)
			textContent.push(div.textContent);
		return textContent.join('\n')
	}

	highlightContent() {
		this.constructor.syntaxHighlighter.postMessage({
			editorId: this.editorId,
			lang: this.dataset.lang,
			raw: [...this.root.childNodes].map(({ textContent }) => textContent).join('\n'), // .join('\r\n'),
			type: 0
		})
	}

	highlightLines(...lines) {
		if (lines.length < 1) return;
		const allLines = Array.from(this.root.children);
		const filtered = lines.filter(line => line.classList.contains('line'));
		this.constructor.syntaxHighlighter.postMessage({
			editorId: this.editorId,
			lang: this.dataset.lang,
			lineIndices: filtered.map(line => allLines.indexOf(line)),
			raw: filtered.map(({ textContent }) => textContent).join('\n'),
			type: 2
		})
	}

	replaceChild(target, node) {
		if (target.isEqualNode(node)) return;

		const focusLine = this.caret.closest('.line');
		const nodes = Array.from(this.root.children);
		const focusNodeIndex = nodes.findIndex(n => n.contains(focusLine));
		const position = Caret.getPositionWithin(focusLine);
		// const selection = Caret.getSelectionWithin(this.root);

		const clone = node.cloneNode(true);
		target.replaceChildren(...clone.childNodes);

		if (focusNodeIndex !== -1 && focusLine === target) {
			Caret.setPosition(position, focusLine)
			// Caret.setSelectionWithin(this.root, selection.start, selection.end)
		}
	}

	replaceChildren() {
		let { focusNode } = this.caret.selection;
		if (focusNode) {
			const nodes = Array.from(this.root.children);
			var focusNodeIndex = nodes.findIndex(node => node.contains(focusNode))
			  , position = Caret.getPosition(this.root); // Caret.getPosition(nodes[focusNodeIndex]);
		}
		this.root.replaceChildren(...arguments);
		if (focusNodeIndex !== -1) {
			focusNode = this.root.children[focusNodeIndex];
			// console.log(focusNode?.textContent, focusNodeContent, position)
			// focusNode && Caret.setPosition(position, focusNode)
			focusNode && Caret.setPosition(position - focusNodeIndex, this.root);
		}

		// this.dispatchEvent(new CustomEvent('change'))
	}

	setValue(text) {
		let nodes = [];
		for (let line of text.split(/\r?\n/g)) {
			let div = document.createElement('div');
			line.length > 0 && (div.innerText = line + '\n' /* '\r\n' */);
			nodes.push(div);
		}
		// this.root.replaceChildren(...nodes);
		this.replaceChildren(...nodes);
		this.syntaxHighlights && this.highlightContent()
	}

	showSuggestions(text) {
		if (this.dataset.lang !== 'js') return;
		const tree = text.split('.')
			, search = tree.pop();
		let target = globalThis;
		while (tree.length) {
			const key = tree.shift();
			if (typeof target[key] != 'object' || target[key] === null) return;
			target = target[key];
		}

		const options = getAllProperties(target).filter(name => name.toLowerCase().includes(search.toLowerCase())); // Object.getOwnPropertyNames(target).filter(name => name.toLowerCase().includes(search.toLowerCase()));
		search && search.length > 0 && options.sort((a, b) => {
			let startsA = a.startsWith(search)
			  , startsB = b.startsWith(search);
			if (startsA !== startsB)
				return startsA ? -1 : 1;

			const lowerA = a.toLowerCase()
				, lowerB = b.toLowerCase();
			startsA = lowerA.startsWith(search)
			startsB = lowerB.startsWith(search);
			if (startsA !== startsB)
				return startsA ? -1 : 1;

			let indexA = lowerA.indexOf(search)
			  , indexB = lowerB.indexOf(search);
			if (indexA !== indexB)
				return indexA - indexB;

			return lowerA.localeCompare(lowerB)
		});
		function getAllProperties(obj) {
			let props = new Set();
			while (obj && obj !== Object.prototype) {
				Object.getOwnPropertyNames(obj)
					.forEach(p => props.add(p));
				obj = Object.getPrototypeOf(obj);
			}

			return Array.from(props)
		}

		const focusLine = this.caret.closest('.line');
		const defaultPrevented = !this.dispatchEvent(new CustomEvent('suggestions', {
			detail: {
				focusLine,
				options,
				search
	 		}
		}));
		if (defaultPrevented) return;
		else if (!this._suggestions) {
			const suggestions = document.createElement('div');
			suggestions.classList.add('suggestions');
			this._suggestions = suggestions;
		}

		this._suggestions.replaceChildren(...options.map(suggestion => {
			const div = document.createElement('div');
			div.textContent = suggestion;
			div.addEventListener('click', () => {
				focusLine.append(suggestion);
				this._suggestions.remove()
			});
			return div
		}));
		this.shadowRoot.appendChild(this._suggestions);

		const boundingRect = focusLine.getBoundingClientRect();
		this._suggestions.style.setProperty('left', boundingRect.left + 'px');
		this._suggestions.style.setProperty('top', boundingRect.bottom + 'px')
	}

	toString() {
		return this.getValue()
	}

	static syntaxHighlighter = new Worker('/dashboard/elements/code-editor/utils/helper.js', { type: 'module' });
	static debounce(callback, ...args) {
		if (typeof callback.debounce == 'undefined')
			throw new Error("Function must be integrated using CodeEditor#integrateDebounce before debouncing");
		else if (callback.debounce !== true)
			return callback.apply(callback.context, args);
		clearTimeout(callback.timeout);
		callback.timeout = setTimeout(() => callback.apply(callback.context, args), callback.delay ?? 10)
	}

	static integrateDebounce(callback, { delay = 10, context = null } = {}) {
		return Object.defineProperties(callback, {
			clear: {
				value: () => {
					clearTimeout(callback.timeout);
					callback.timeout = null
				},
				writable: true
			},
			context: {
				value: context,
				writable: true
			},
			debounce: {
				value: true,
				writable: true
			},
			delay: {
				value: delay,
				writable: true
			},
			timeout: {
				value: null,
				writable: true
			}
		})
	}
}

Object.defineProperty(self, 'CodeEditor', {
	value: CodeEditor,
	writable: true
});
customElements.define('code-editor', CodeEditor);