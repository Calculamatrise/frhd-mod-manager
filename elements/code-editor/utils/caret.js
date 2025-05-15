export default class Caret {
	lastPosition = -1;
	position = -1;
	rootNode = null;
	constructor(node) {
		Object.defineProperty(this, 'selection', {
			value: null,
			writable: true
		});
		node && (this.rootNode = node);
		this._update();
		this._listen()
	}

	_listen() {
		Object.defineProperty(this, '_selectionchange', {
			value: () => this._update(),
			writable: true
		});
		const target = document; // this.rootNode?.getRootNode?.() || window;
		target.addEventListener('selectionchange', this._selectionchange)
	}

	_unlisten() {
		const target = this.rootNode?.getRootNode?.() || window;
		target.removeEventListener('selectionchange', this._selectionchange)
		this._selectionchange = null
	}

	_update(selection = this.constructor._getSelection(this.rootNode)) {
		if (!(selection instanceof Selection))
			throw new TypeError("First positional argument must be of type: Selection");
		this.selection = selection;
		this.position !== this.lastPosition && (this.lastPosition = this.position);
		this.position = this.constructor.getPositionWithin(this.rootNode) // selection.focusOffset
	}

	closest(selectors) {
		let target = this.selection?.anchorNode;
		if (!target) return null;
		target.nodeType !== 1 && (target = target.parentElement);
		return target?.closest(selectors) || null
	}

	destroy() {
		this._unlisten();
		this.rootNode = null;
		this.selection = null
	}

	getSelectedNodes(selector = null) {
		const { anchorNode, extentNode } = this.selection;
		if (!extentNode) return null;
		const select = node => selector ? node.nodeType === 1 ? node.closest(selector) : node.parentElement.closest(selector) : node;
		if (anchorNode.isEqualNode(extentNode)) return [select(anchorNode)];
		let commonAncestor = select(anchorNode);
		while (commonAncestor && !commonAncestor.contains(extentNode))
			commonAncestor = commonAncestor.parentElement;
		if (!commonAncestor) return [];
		else if (selector && commonAncestor.matches(selector)) return [commonAncestor];
		const nodes = Array.from(selector ? commonAncestor.querySelectorAll(selector) : commonAncestor.childNodes)
			, anchorIndex = nodes.findIndex(node => node.contains(anchorNode))
			, extentIndex = nodes.findIndex(node => node.contains(extentNode));
		return nodes.slice(Math.min(anchorIndex, extentIndex), 1 + Math.max(anchorIndex, extentIndex))
	}

	setPosition(position) {
		this.constructor.setPositionWithin(this.rootNode, position)
	}

	static _carets = new WeakMap();
	static clearSelection() {
		if ('getSelection' in window)
			window.getSelection()?.removeAllRanges();
		else if ('selection' in document)
			document.selection.empty()
	}

	static get(node, { force } = {}) {
		if (!force && this._carets.has(node)) return this._carets.get(node);
		const caret = new Caret(node);
		node && this._carets.set(node, caret);
		return caret
	}

	static getFocusNode({ focusNode } = window.getSelection()) {
		return focusNode
	}

	static getPosition(node = null) {
		const { focusNode, focusOffset } = this._getSelection(node);
		if (!focusNode || (node && !node.contains(focusNode))) return -1;
		return node ? this.getPositionWithin(node) : focusOffset
	}

	// Solid -- This function is finalized
	// Works perfectly as expected
	static getPositionWithin(rootNode) {
		const sel = this._getSelection(rootNode);
		if (sel.rangeCount === 0) return 0;

		const range = sel.getRangeAt(0);
		const endNode = range.endContainer;

		let position = 0;
		let divCount = 0;

		const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_ALL, {
			acceptNode(node) {
				if (node.nodeType === Node.ELEMENT_NODE) {
					const isEmpty = node.textContent === '';
					return isEmpty ? NodeFilter.FILTER_SKIP : NodeFilter.FILTER_ACCEPT;
				}

				return NodeFilter.FILTER_ACCEPT
			}
		}, false);
		while (walker.nextNode()) {
			const node = walker.currentNode;
			if (node === endNode) break;
			else if (node.nodeType === Node.TEXT_NODE) {
				position += node.textContent.length;
			} else if (node.nodeType === Node.ELEMENT_NODE) {
				if (node.tagName === 'BR') {
					position += 1;
				} else {
					const isBlock = getComputedStyle(node).display === 'block';
					if (isBlock && node.textContent.length > 0) {
						if (divCount++ > 0) position += 1;
					}
				}
			}
		}

		return position + range.endOffset
	}

	static getSelection(node) {
		const sel = this._getSelection(node);
		if (node && node.contains(sel.focusNode))
			return this.getSelectionWithin(node);
		return {
			start: sel.anchorOffset,
			end: sel.focusOffset
		}
	}

	// static getSelectionWithin(node) {
	// 	let start = 0, end = 0;
	// 	const sel = this._getSelection(node);
	// 	if (sel.rangeCount > 0) {
	// 		const range = sel.getRangeAt(0);
	// 		const fullRange = range.cloneRange();
	// 		fullRange.selectNodeContents(node);

	// 		const preStart = fullRange.cloneRange();
	// 		preStart.setEnd(range.startContainer, range.startOffset);
	// 		start = preStart.toString().length;

	// 		const preEnd = fullRange.cloneRange();
	// 		preEnd.setEnd(range.endContainer, range.endOffset);
	// 		end = preEnd.toString().length;
	// 	}
	// 	return { start, end }
	// }

	// static getSelectionWithin(rootNode) {
	// 	const sel = this._getSelection(rootNode);
	// 	if (sel.rangeCount === 0) return { start: 0, end: 0 };

	// 	const range = sel.getRangeAt(0);

	// 	function getPositionAt(node, offset) {
	// 		let position = 0;
	// 		const walker = document.createTreeWalker(
	// 			rootNode,
	// 			NodeFilter.SHOW_ALL,
	// 			null,
	// 			false
	// 		);

	// 		while (walker.nextNode()) {
	// 			const currentNode = walker.currentNode;

	// 			if (currentNode === node) {
	// 				if (currentNode.nodeType === Node.TEXT_NODE) {
	// 					// inside text node: add offset chars
	// 					position += offset;
	// 				} else if (currentNode.nodeType === Node.ELEMENT_NODE) {
	// 					if (currentNode.tagName === 'BR') {
	// 						// offset 0 or 1, treat as position + offset
	// 						position += offset;
	// 					} else {
	// 						// block element or others: offset 0 means before, 1 means after (+1)
	// 						const isBlock = getComputedStyle(currentNode).display === 'block';
	// 						if (isBlock && currentNode !== rootNode && currentNode.childNodes.length > 0) {
	// 							position += offset; // 0 or 1
	// 						}
	// 					}
	// 				}
	// 				break;
	// 			}

	// 			if (currentNode.nodeType === Node.TEXT_NODE) {
	// 				position += currentNode.textContent.length;
	// 			} else if (currentNode.nodeType === Node.ELEMENT_NODE) {
	// 				if (currentNode.tagName === 'BR') {
	// 					position += 1;
	// 				} else {
	// 					const isBlock = getComputedStyle(currentNode).display === 'block';
	// 					if (isBlock && currentNode !== rootNode && currentNode.childNodes.length > 0) {
	// 						position += 1;
	// 					}
	// 				}
	// 			}
	// 		}
	// 		return position;
	// 	}

	// 	return {
	// 		start: getPositionAt(range.startContainer, range.startOffset),
	// 		end: getPositionAt(range.endContainer, range.endOffset),
	// 	};
	// }

	static getSelectionWithin(rootNode) {
		const sel = this._getSelection(rootNode);
		if (sel.rangeCount === 0) return { start: 0, end: 0 };

		const range = sel.getRangeAt(0);
		const startNode = range.startContainer;
		const endNode = range.endContainer;
		const startOffsetInNode = range.startOffset;
		const endOffsetInNode = range.endOffset;

		let position = 0;
		let divCount = 0;
		let start = null;
		let end = null;

		const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_ALL, {
			acceptNode(node) {
				if (node.nodeType === Node.ELEMENT_NODE) {
					return node.textContent === '' ? NodeFilter.FILTER_SKIP : NodeFilter.FILTER_ACCEPT;
				}
				return NodeFilter.FILTER_ACCEPT;
			}
		}, false);

		while (walker.nextNode()) {
			const node = walker.currentNode;

			if (node === startNode && start === null) {
				start = position + startOffsetInNode;
			}
			if (node === endNode && end === null) {
				end = position + endOffsetInNode;
			}

			if (node.nodeType === Node.TEXT_NODE) {
				position += node.textContent.length;
			} else if (node.nodeType === Node.ELEMENT_NODE) {
				if (node.tagName === 'BR') {
					position += 1;
				} else {
					const isBlock = getComputedStyle(node).display === 'block';
					if (isBlock && node.textContent.length > 0) {
						if (divCount++ > 0) {
							position += 1;
						}
					}
				}
			}
		}

		// fallback if one side of selection was outside filtered nodes
		if (start === null) start = 0;
		if (end === null) end = position;

		return { start, end };
	}

	static setSelectionWithin(rootNode, startOffset, endOffset = startOffset) {
		const selection = this._getSelection(rootNode);
		const range = document.createRange();

		let position = 0;
		let divCount = 0;

		let startSet = false;
		let endSet = false;

		const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_ALL, {
			acceptNode(node) {
				if (node.nodeType === Node.ELEMENT_NODE) {
					const isEmpty = node.textContent === '';
					return isEmpty ? NodeFilter.FILTER_SKIP : NodeFilter.FILTER_ACCEPT;
				}
				return NodeFilter.FILTER_ACCEPT
			}
		}, false);
		while ((!startSet || !endSet) && walker.nextNode()) {
			const node = walker.currentNode;
			if (node.nodeType === Node.TEXT_NODE) {
				const len = node.textContent.length;
				if (!startSet && position + len >= startOffset) {
					const offset = startOffset - position;
					range.setStart(node, offset);
					startSet = true;
				}
				if (!endSet && position + len >= endOffset) {
					const offset = endOffset - position;
					range.setEnd(node, offset);
					endSet = true;
				}
				position += len;

			} else if (node.nodeType === Node.ELEMENT_NODE) {
				if (node.tagName === 'BR') {
					if (!startSet && position === startOffset) {
						range.setStartBefore(node);
						startSet = true;
					}
					if (!endSet && position === endOffset) {
						range.setEndBefore(node);
						endSet = true;
					}
					position += 1;
				} else {
					const isBlock = getComputedStyle(node).display === 'block';
					if (isBlock && node.textContent.length > 0) {
						if (divCount++ > 0) {
							if (!startSet && position === startOffset) {
								range.setStartBefore(node);
								startSet = true;
							}
							if (!endSet && position === endOffset) {
								range.setEndBefore(node);
								endSet = true;
							}
							position += 1;
						}
					}
				}
			}
		}

		if (startSet && endSet) {
			selection.removeAllRanges();
			selection.addRange(range)
		}
	}

	static setPosition(chars, node) {
		const selection = this._getSelection(node);
		node ||= selection.anchorNode;
		const range = Caret._createRange(node, { count: Math.max(0, Math.min(node.textContent.length, chars < 0 ? node.textContent.length + chars : chars)) });
		if (range) {
			range.collapse(false),
			selection.removeAllRanges(),
			selection.addRange(range)
		}
	}

	static setPositionWithin(rootNode, targetOffset) {
		const selection = this._getSelection(rootNode);
		const range = document.createRange();

		let position = 0;
		let found = false;

		const stack = [{ node: rootNode, childIndex: 0 }];
		while (stack.length && !found) {
			const frame = stack[stack.length - 1];
			const { node, childIndex } = frame;
			if (node.nodeType === Node.TEXT_NODE) {
				const len = node.textContent.length;
				if (position + len >= targetOffset) {
					const offset = targetOffset - position;
					range.setStart(node, offset);
					range.setEnd(node, offset);
					found = true;
				} else {
					position += len;
				}
			} else if (node.nodeType === Node.ELEMENT_NODE) {
				if (node.tagName === 'BR') {
					if (position === targetOffset) {
						range.setStartBefore(node);
						range.setEndBefore(node);
						found = true;
					}
					position += 1;
				} else if (childIndex < node.childNodes.length) {
					frame.childIndex++;
					stack.push({ node: node.childNodes[childIndex], childIndex: 0 });
					continue;
				} else {
					const isBlock = getComputedStyle(node).display === 'block';
					if (isBlock && node !== rootNode && node.childNodes.length > 0) {
						if (position === targetOffset) {
							range.setStartAfter(node);
							range.setEndAfter(node);
							found = true;
						}
						position += 1;
					}
				}
			}
			stack.pop();
		}

		if (!found) return;
		selection.removeAllRanges();
		selection.addRange(range)
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
				for (let lp = 0; lp < node.childNodes.length; lp++) {
					range = Caret._createRange(node.childNodes[lp], chars, range);
					if (chars.count === 0) {
						break;
					}
				}
			}
		} 

		return range
	}

	static _getSelection(node) {
		if (!node) return window.getSelection();
		const root = node.getRootNode();
		return typeof root.getSelection == 'function' ? root.getSelection() : window.getSelection()
	}
}

Object.defineProperty(self, 'Caret', {
	value: Caret,
	writable: true
});