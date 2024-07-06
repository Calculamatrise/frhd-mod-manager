export default class SyntaxHighlighter {
	static keywords = new Set(['class', 'for', 'function', 'if', 'let', 'new', 'of', 'static', 'switch', 'var']);
	static parse(content) {
		let parsed = [];
		for (let line of content.split('\n')) {
			parsed.push(this.parseLine(line));
		}
		return parsed
	}

	static parseLine(segment) {
		let nodes = [];
		for (let keyword of this.keywords.values()) {
			let regex = new RegExp('(?<=[^\\w]|^)' + keyword + '(?=[^\\w]|$)', 'g');
			if (!regex.test(segment)) continue;
			let parts = segment.split(regex);
			let code = document.createElement('code');
			code.classList.add('keyword');
			code.innerText = keyword;
			code.contentEditable = false;
			for (let i = parts.length - 1; i > 0; i--) {
				parts.splice(i, 0, code.cloneNode(true))
			}
			nodes.push(...parts)
		}
		nodes.length < 1 && nodes.push(segment);
		return nodes
	}

	static replace(segment) {
		console.log('beforeee:', segment);
		for (let keyword of this.keywords.values()) {
			let regex = new RegExp('(?<=[^\\w])(' + keyword + ')(?=[^\\w]|$)', 'g');
			regex.test(segment) && (segment = segment.replace(regex, '<code class="' + keyword + '">$1</code>'))
		}
		console.log('aftr:', segment)
	}

	static test(segment) {
		for (let keyword of this.keywords.values()) {
			let regex = new RegExp('(?<=[^\\w])(' + keyword + ')(?=[^\\w]|$)', 'g');
			if (regex.test(segment)) return true;
		}
		return false
	}
}