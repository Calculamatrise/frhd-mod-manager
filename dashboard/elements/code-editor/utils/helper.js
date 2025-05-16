import CSSHighlightFragment from "./csshighlight.js";
import HTMLHighlightFragment from "./htmlhighlight.js";
import JavaScriptHighlightFragment from "./jshighlight.js";

onmessage = function({ data }) {
	const SyntaxHighlight = parseHighlightFromLanguage(data.lang);
	delete data.lang;
	switch (data.type) {
	case 0: {
		const text = data.raw;
		const lines = text.split(/\r?\n/g);
		for (const i in lines) {
			lines[i] = SyntaxHighlight.split(lines[i]);
		}

		data = {
			editorId: data.editorId,
			lines: lines,
			// raw: lines.join('\n'),
			type: data.type
		};
		break;
	}

	case 1: {
		const lines = data.raw.split(/\r?\n/g);
		for (const i in lines) {
			postMessage({
				editorId: data.editorId,
				line: SyntaxHighlight.split(lines[i]),
				lineIndex: data.lineIndices[i],
				type: data.type
			});
		}
		return;
	}

	case 2:
		const highlightedLines = [];
		for (const lineContent of data.raw.split(/\r?\n/g)) {
			highlightedLines.push(SyntaxHighlight.split(lineContent));
		}

		data = {
			editorId: data.editorId,
			lines: highlightedLines,
			lineIndices: data.lineIndices,
			type: data.type
		};
	}

	postMessage(data)
}

function parseHighlightFromLanguage(lang) {
	switch (lang) {
	case 'css':
		return CSSHighlightFragment;
	case 'htm':
	case 'html':
		return HTMLHighlightFragment;
	case 'js':
	case 'mjs':
		return JavaScriptHighlightFragment
	}
	return null
}