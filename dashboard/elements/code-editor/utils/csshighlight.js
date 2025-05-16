import SyntaxHighlightFragment from "./highlight.js";

export default class JavaScriptHighlightFragment extends SyntaxHighlightFragment {
	static symbols = new Set(['=', '>']);
	static signs = new Set(['!', '=', '-', '+', '%', '&', '|']);
	static regexPatterns = {
		string: /(["'`])(?:\\.|(?!\1).)*\1/g,
		comment: /\/\*.*?\*\//gm,
		variable: /-{2}[\w-]+/g,
		pseudo: /:{1,2}[\w-]+/g,
		id: /#[\w-]+(?=.*{)/g,
		class: /\.[\w-]+(?=.*{)/g,
		tag: /(?:\*|\b([\w-]+)\b)(?=\s*{)/g,
		value: /(?<=:\s*)\b[\w-]+\b(?=.*[;}])/g,
		query: /@\b\w+(?=\s*\()|!important/g,
		function: /\b\w+(?=\s*\()/g,
		unit: /(?<=\d+)\b\w+/g,
		symbol: new RegExp(`[${[...this.symbols].join('\\')}]`, 'g'),
		sign: new RegExp(`\\B[${[...this.signs].join('\\')}]\\B`, 'g'),
		boolean: /\b(?:true|false|null|undefined|[\d\.]+|#[A-Fa-f\d\.]{3,4}|#[A-Fa-f\d\.]{6,8})\b/g,
	}
}