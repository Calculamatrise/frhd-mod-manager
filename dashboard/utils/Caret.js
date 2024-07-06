export default class Caret {
	static getCurrentCursorPosition(parentElement) {
		var selection = window.getSelection(),
			charCount = -1,
			node;
		if (selection.focusNode) {
			if (Caret._isChildOf(selection.focusNode, parentElement)) {
				node = selection.focusNode; 
				charCount = selection.focusOffset;
				while (node) {
					if (node === parentElement) {
						break;
					}

					if (node.previousSibling) {
						node = node.previousSibling;
						charCount += node.textContent.length;
					} else {
						node = node.parentNode;
						if (node === null) {
							break;
						}
					}
				}
			}
		}

		return charCount
	}

	static setCurrentCursorPosition(chars, element) {
		let selection = window.getSelection();
		let range = Caret._createRange(element, { count: Math.max(0, Math.min(element.textContent.length, chars < 0 ? element.textContent.length + chars : chars)) });
		if (range) {
			range.collapse(false);
			selection.removeAllRanges();
			selection.addRange(range);
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

	static _isChildOf(node, parentElement) {
		while (node !== null) {
			if (node === parentElement) {
				return true;
			}
			node = node.parentNode;
		}

		return false
	}
}