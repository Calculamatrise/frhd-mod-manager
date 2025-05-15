export default class SyntaxHighlightFragment extends Array {
	constructor(raw) {
		Object.defineProperty(super(), 'raw', { value: raw ?? null, writable: true })
	}

	toString() {
		for (let node of this.filter(node => typeof node != 'string')) {
			this.splice(this.indexOf(node), 1, node.outerHTML);
		}
		return this.join('')
	}

	static regexPatterns = {};
	static _wrap(text, options) {
		const { type, write = true } = arguments[arguments.length - 1];
		// let code = document.createElement('code');
		// code.classList.add(type);
		// write === !1 && (code.contentEditable = write);
		// code.replaceChildren(...Array.prototype.slice.call(arguments, 0, -1))
		return `<code class="${type}"${write ? ' contenteditable' : ''}>${this.encodeHTMLEntities(text)}</code>`
	}

	static _isolateMatches(segment, { filter, recurse, regex, type }) {
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
				parts.splice(matches.length - i, 0, {
					string: str,
					type
				});
			}
		} else
			parts.push(segment)
		return parts
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

	static _splitAndWrap(text, regex, type) {
		const matches = [...text.matchAll(regex)];
		if (!matches.length) return [text];
		let result = [];
		let lastIndex = 0;
		for (const match of matches) {
			let [matchedText] = match;
			let index = match.index;
			// Push text before the match
			if (index > lastIndex) result.push(text.slice(lastIndex, index));
			// Push highlighted match
			result.push(`<code class="${type}">${this.encodeHTMLEntities(matchedText)}</code>`);
			lastIndex = index + matchedText.length;
		}

		// Push remaining text
		if (lastIndex < text.length) result.push(text.slice(lastIndex));
		return result
	}

	static _splitAndInsert(text, regex, type) {
		const matches = [...text.matchAll(regex)];
		if (!matches.length) return [text];
		let result = [];
		let lastIndex = 0;
		// console.log(matches)
		for (const match of matches) {
			let [matchedText] = match;
			let index = match.index;
			// Push text before the match
			if (index > lastIndex) result.push(text.slice(lastIndex, index));
			// Push highlighted match
			result.push({
				string: matchedText,
				type
			});
			lastIndex = index + matchedText.length;
		}

		// Push remaining text
		if (lastIndex < text.length) result.push(text.slice(lastIndex));
		return result
	}

	static highlight(text) {
		let syntaxHighlight = new this(segment);
		let parts = [text];
		// Apply syntax highlighting for each pattern
		for (const [type, regex] of Object.entries(this.regexPatterns)) {
			parts = parts.flatMap(segment =>
				typeof segment === 'string'
					? this._splitAndWrap(segment, regex, type)
					: segment
			);
		}
		syntaxHighlight.push(...parts);
		return syntaxHighlight
	}

	static split(segment) {
		let syntaxHighlight = new this(segment);
		let parts = [segment];
		for (const [type, regex] of Object.entries(this.regexPatterns)) {
			parts = parts.flatMap(segment =>
				typeof segment === 'string'
					? this._splitAndInsert(segment, regex, type)
					: segment
			);
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

	static encodeHTMLEntities(str) {
		return str.replace(/[\u00A0-\u9999<>&"'`]/gim, c => `&#${c.charCodeAt(0)};`)
	}
}
