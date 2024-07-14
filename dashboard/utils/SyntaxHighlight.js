export default class SyntaxHighlightFragment extends Array {
	raw = null;
	constructor(raw) {
		super();
		this.raw = raw,
		Object.defineProperty(this, 'raw', { enumerable: false })
	}

	toString() {
		for (let node of this.filter(node => typeof node != 'string')) {
			this.splice(this.indexOf(node), 1, node.outerHTML);
		}
		return this.join('')
	}

	static keywords = new Set(['async', 'break', 'case', 'const', 'class', 'continue', 'delete', 'do', 'export', 'for', 'from', 'function', 'if', 'import', 'instanceof', 'let', 'new', 'of', 'return', 'static', 'switch', 'typeof', 'var', 'while', '=>']);
	static _keywordRegex = new RegExp('(?<=\\b)(?:' + Array.from(this.keywords.values()).join('|') + ')(?=\\b)(?!\=)', 'g');
	static symbols = new Set(['(', '[', '{', '#', '$', '}', ']', ')', ',', '.', ':', ';']);
	static _symbolRegex = new RegExp('[\\' + Array.from(this.symbols.values()).join('\\') + ']+(?![\\b\'"])', 'g');
	static signs = new Set(['!', '=', '-', '+', '%', '&', '|']);
	static _signRegex = new RegExp('[\\' + Array.from(this.signs.values()).join('\\') + ']+(?![\\b\'"])', 'g');
	static _arrowfnRegex = /=>/g;
	static _booleanRegex = /(?:fals|tru)e|null|undefined|\d+/g;
	static _commentRegex = /\/\/.*|\/\*.*\*\//g;
	static _stringRegex = /'[^']*'|"[^"]*"/g;
	static _escapeRegex = /\\[^tr]/g;
	static _mStringRegex = /`[^`]*`/gm;
	static _mEscapeRegex = /\\[^tr]/g;
	static _functionRegex = /\w+(?=\()/g;
	static _globalVariableRegex = /(?<=\b)\w+(?=\b)(?!:)/g;
	static _ternaryRegex = /\?[^:]:/g;
	static _createRegex(keyword) {
		return new RegExp('(?<=\\b)' + keyword + '(?=\\b)(?!\=)', 'g')
	}

	static _wrap(text, options) {
		const { type, write = true } = arguments[arguments.length - 1];
		let code = document.createElement('code');
		code.classList.add(type);
		write === !1 && (code.contentEditable = write);
		code.replaceChildren(...Array.prototype.slice.call(arguments, 0, -1))
		return code
	}

	static _wrapMatches(segment, { filter, recurse, regex, type }) {
		let parts = [];
		if (segment.match(regex)) {
			parts.push(...segment.split(regex));
			let matches = segment.match(regex).reverse();
			for (let i in matches) {
				let str = matches[i];
				let strParts = [str];
				typeof recurse == 'function' && (strParts = recurse(matches[i]));
				let wrapped = this._wrap(...strParts, { type });
				typeof filter == 'function' && !filter(str) && (wrapped = str);
				parts.splice(matches.length - i, 0, wrapped);
			}
		} else
			parts.push(segment)
		return parts
	}

	static parse(content) {
		let parsed = [];
		for (let line of content.split('\n')) {
			parsed.push(this.parseLine(line).toString());
			// parsed.push(this.replace(line));
		}
		return parsed.join('\n')
	}

	// quotes should be highlighted first and anything inside of them should be excempt from syntax highlights except back slashes
	// excluding back ticks
	static parseLine(segment) {
		let syntaxHighlight = new this(segment);
		let parts = this._wrapMatches(segment, { regex: this._commentRegex, type: 'comment' });
		let filterElements = node => typeof node == 'string';
		for (let seg of parts.filter(filterElements).filter(node => node.match(this._stringRegex))) {
			parts.splice(parts.indexOf(seg), 1, ...this._wrapMatches(seg, { recurse: str => this._wrapMatches(str, { regex: this._escapeRegex, type: 'escape' }), regex: this._stringRegex, type: 'string' }));
		}
		for (let seg of parts.filter(filterElements).filter(node => node.match(this._keywordRegex))) {
			parts.splice(parts.indexOf(seg), 1, ...this._wrapMatches(seg, { regex: this._keywordRegex, type: 'keyword' }));
		}
		for (let seg of parts.filter(filterElements).filter(node => node.match(this._functionRegex))) {
			parts.splice(parts.indexOf(seg), 1, ...this._wrapMatches(seg, { regex: this._functionRegex, type: 'function' }));
		}
		for (let seg of parts.filter(filterElements).filter(node => node.match(this._globalVariableRegex))) {
			parts.splice(parts.indexOf(seg), 1, ...this._wrapMatches(seg, { filter: str => globalThis.hasOwnProperty(str), regex: this._globalVariableRegex, type: 'constant' }));
		}
		for (let seg of parts.filter(filterElements).filter(node => node.match(this._ternaryRegex))) {
			parts.splice(parts.indexOf(seg), 1, ...this._wrapMatches(seg, { regex: this._ternaryRegex, type: 'keyword' }));
		}
		for (let seg of parts.filter(filterElements).filter(node => node.match(this._arrowfnRegex))) {
			parts.splice(parts.indexOf(seg), 1, ...this._wrapMatches(seg, { regex: this._arrowfnRegex, type: 'keyword' }));
		}
		for (let seg of parts.filter(filterElements).filter(node => node.match(this._symbolRegex))) {
			parts.splice(parts.indexOf(seg), 1, ...this._wrapMatches(seg, { regex: this._symbolRegex, type: 'symbol' }));
		}
		for (let seg of parts.filter(filterElements).filter(node => node.match(this._signRegex))) {
			parts.splice(parts.indexOf(seg), 1, ...this._wrapMatches(seg, { regex: this._signRegex, type: 'sign' }));
		}
		for (let seg of parts.filter(filterElements).filter(node => node.match(this._booleanRegex))) {
			parts.splice(parts.indexOf(seg), 1, ...this._wrapMatches(seg, { regex: this._booleanRegex, type: 'boolean' }));
		}
		syntaxHighlight.push(...parts);
		// console.log(syntaxHighlight)
		return syntaxHighlight
	}

	static replace(segment) {
		const before = segment;
		// for (let keyword of this.keywords.values()) {
		// 	let regex = this._createRegex(keyword);
		// 	regex.test(segment) && (segment = segment.replace(regex, '<code class="keyword">$1</code>'))
		// }
		segment = segment.replace(/(\/\/.*|\/\*.*\*\/)/g, '<em class="comment">$1</em>');
		segment = segment.replace(/*/(['"`][^'"`]*['"`])(?!\>)/g*/ /("[^"]*"|'[^']*'|`[^`$]*|[^`}]*`)(?!\>)/g, '<code class="string">$1</code>');
		/(?<=\b)\w+(?=\.)/g.test(segment) && (segment = segment.replace(/(?<=\b)\w+(?=\.)/g, match => {
			return globalThis.hasOwnProperty(match) ? '<code class="constant">' + match + '</code>' : match
		}));
		this._keywordRegex.test(segment) && (segment = segment.replace(this._keywordRegex, '<code class="keyword">$1</code>')),
		this._symbolRegex.test(segment) && (segment = segment.replace(this._symbolRegex, '<code class="symbol">$1</code>')),
		// /(?<=\b)\w+(?=\.)/g.test(segment) && segment.replace(/(?<=\b)\w+(?=\.)/g, matches => {
		// 	console.warn(matches)
		// })
		console.log('b4:', before + '\naftr:', segment)
		return segment
	}

	static test(segment) {
		for (let keyword of this.keywords.values()) {
			let regex = this._createRegex(keyword);
			if (regex.test(segment)) return true;
		}
		return false
	}
}