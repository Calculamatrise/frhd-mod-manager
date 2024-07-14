import Caret from "./Caret.js";
import SyntaxHighlight from "./SyntaxHighlight.js";

export default class CodeEditor extends HTMLElement {
	constructor() {
		super();
		this.contentEditable = true;
		this.addEventListener('input', event => {
			let caret = Caret.get();
			let line = caret._selection.anchorNode.parentElement.closest('pre');
			let pos = Caret.getPositionWithin(line); // Caret.getPosition(line);
			let insert = null;
			switch(event.data) {
			case '\'':
			case '"':
			case '`':
				insert = event.data;
				console.log(line.textContent, line.textContent.slice(pos - 2, pos), insert)
				// if (''.padStart(2, insert) === line.textContent.slice(pos - 2, pos)) {
				// 	// line.replaceChildren(...SyntaxHighlight.parseLine(line.innerText.slice(0, pos - 1) + line.innerText.slice(pos)));
				// 	// Caret.setPosition(pos + 1, line);
				// 	return;
				// }
				break;
			case '(':
				insert = String.fromCharCode(1 + event.data.charCodeAt());
				break;
			case '[':
			case '{':
				insert = String.fromCharCode(2 + event.data.charCodeAt())
			}
			if (/^[`'"\)\]\}]$/.test(event.data) && event.data === line.textContent.slice(pos, pos + 1)) {
				line.replaceChildren(...SyntaxHighlight.parseLine(line.innerText.slice(0, pos - 1) + line.innerText.slice(pos)));
				Caret.setPosition(pos + 1, line);
				return;
			} else if (insert === null) {
				line.replaceChildren(...SyntaxHighlight.parseLine(line.innerText));
				Caret.setPosition(pos, line);
				return;
			} else if (/^['"]$/.test(insert) && ''.padStart(2, insert) === line.textContent.slice(pos - 2, pos)) {
				// line.replaceChildren(...SyntaxHighlight.parseLine(line.innerText.slice(0, pos - 1) + line.innerText.slice(pos)));
				// Caret.setPosition(pos + 1, line);
				return;
			}
			// let caret = Caret.get();
			// let line = caret._selection.anchorNode.parentElement.closest('pre');
			// line.innerText = line.innerText.slice(0, caret.position) + insert + line.innerText.slice(caret.position);
			line.replaceChildren(...SyntaxHighlight.parseLine(line.innerText.slice(0, pos) + insert + line.innerText.slice(pos)));
			Caret.setPosition(pos/* caret.position */, line);
			// Caret.setPosition(caret.position + insert.length, line);
		});
		this.addEventListener('keydown', event => {
			switch(event.key.toLowerCase()) {
			case 'enter':
				if (!event.shiftKey) break;
				event.preventDefault();
				let caret = Caret.get()
				  , focusNode = caret._selection.focusNode
				  , line = focusNode.parentElement.closest('pre.line')
				  , content = line.innerText;
				console.log(caret._selection, content, line, caret._selection.focusOffset)
				line.innerText = content.slice(0, caret._selection.focusOffset);
				let newLine = document.createElement('pre');
				newLine.classList.add('line');
				newLine.innerText = content.slice(caret._selection.focusOffset);
				line.after(newLine);
				this.highlightContent()
			}
		});
		this.addEventListener('paste', event => {
			event.preventDefault();
			let pos = Caret.getPosition(this);
			let prefix = this.innerText.slice(0, pos);
			let suffix = this.innerText.slice(pos);
			let pastedContent = event.clipboardData.getData('text/plain');
			// insert into position
			this.setContent(prefix + pastedContent + suffix);
			Caret.setPosition(pos + pastedContent.length, this)
		})
		new MutationObserver(function(mutations) {
			for (const mutation of mutations) {
				switch(mutation.type) {
				case 'childList':
					for (let pre of Array.from(mutation.addedNodes).filter(node => node instanceof HTMLPreElement && /^\n?$/.test(node.textContent))) {
						pre.innerHTML = '<br>';
					}
					for (let div of Array.from(mutation.addedNodes).filter(node => !(node instanceof HTMLPreElement))) {
						div.outerHTML = '<pre class="line">' + (div.innerHTML || '<br>') + '</pre>'
					}
				}
			}
		}).observe(this, { childList: true })
	}

	highlightContent() {
		for (let node of this.children) {
			node.innerHTML = SyntaxHighlight.parseLine/* replace */(node.innerText)
		}
	}

	setContent(text) {
		let nodes = [];
		for (let line of text.split('\n')) {
			let pre = document.createElement('pre');
			pre.classList.add('line');
			line.length > 0 && (pre.innerText = line);
			pre.innerText.length < 1 && (pre.innerHTML = '<br>');
			nodes.push(pre);
		}
		this.replaceChildren(...nodes),
		this.highlightContent()
	}

	toString() {
		let textContent = [];
		for (let div of this.children) {
			console.log(div, '"' + div.textContent + '"')
			textContent.push(div.textContent.replace(/\n$/, ''));
		}
		console.log(textContent)
		return textContent.join('\n')
	}
}

customElements.define('code-editor', CodeEditor)

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