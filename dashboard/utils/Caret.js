export default class Caret {
	_node = null;
	_selection = null;
	position = -1;
	constructor(node) {
		node && (this._node = node),
		this._update(),
		this._listen(),
		Object.defineProperty(this, '_selection', { enumerable: false })
	}

	_listen() {
		Object.defineProperty(this, '_selectionchange', {
			value: event => this._update(event.target.getSelection()),
			writable: true
		}),
		document.addEventListener('selectionchange', this._selectionchange)
	}

	_unlisten() {
		document.removeEventListener('selectionchange', this._selectionchange),
		this._selectionchange = null
	}

	_update(selection = document.getSelection()) {
		this._selection = selection,
		this.position = selection.focusOffset
	}

	static _carets = new WeakMap();
	static get(node, { force } = {}) {
		if (!force && this._carets.has(node)) return this._carets.get(node);
		let caret = new Caret(node);
		node && this._carets.set(node, caret);
		return caret
	}

	static getPosition(parentElement) {
		let selection = window.getSelection()
		  , focusOffset = selection.focusOffset;
		parentElement && parentElement.contains(selection.focusNode) ? focusOffset = this.getPositionWithin(parentElement) : (focusOffset = -1);
		return focusOffset
	}

	static getPositionWithin(element) {
		let caretOffset = 0;
		let sel = window.getSelection();
		if (sel.rangeCount > 0) {
			let range = sel.getRangeAt(0);
			let preCaretRange = range.cloneRange();
			preCaretRange.selectNodeContents(element);
			preCaretRange.setEnd(range.endContainer, range.endOffset);
			caretOffset = preCaretRange.toString().length;
		}
		return caretOffset
	}

	static setPosition(chars, element) {
		let selection = window.getSelection();
		let range = Caret._createRange(element, { count: Math.max(0, Math.min(element.textContent.length, chars < 0 ? element.textContent.length + chars : chars)) });
		if (range) {
			range.collapse(false),
			selection.removeAllRanges(),
			selection.addRange(range)
		}
	}

	static _createRange(node, chars, range) {
		if (!range) {
			range = document.createRange()
			range.selectNode(node);
			range.setStart(node, 0);
		}

		if (chars.count === 0) {
			range.setEnd(node, chars.count);
		} else if (node && chars.count >0) {
			if (node.nodeType === Node.TEXT_NODE) {
				if (node.textContent.length < chars.count) {
					chars.count -= node.textContent.length;
				} else {
					range.setEnd(node, chars.count);
					chars.count = 0;
				}
			} else {
				for (var lp = 0; lp < node.childNodes.length; lp++) {
					range = Caret._createRange(node.childNodes[lp], chars, range);
					if (chars.count === 0) {
						break;
					}
				}
			}
		} 

		return range
	}
}