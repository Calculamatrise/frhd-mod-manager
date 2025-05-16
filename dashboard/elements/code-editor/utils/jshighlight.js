import SyntaxHighlightFragment from "./highlight.js";

export default class JavaScriptHighlightFragment extends SyntaxHighlightFragment {
	static keywords = new Set([
		'=>', 'async', 'await', 'break', 'case', 'catch', 'const', 'class', 'continue', 'debugger',
		'default', 'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'from', 'function',
		'if', 'import', 'in', 'instanceof', 'let', 'new', 'return', 'static', 'switch',
		'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield'
	]);

	static symbols = new Set(['(', '[', '{', '#', '$', '}', ']', ')', ',', '.', ':', ';']);
	static signs = new Set(['!', '?', '=', '-', '+', '%', '&', '|']);
	static _mStringRegex = /`[^`]*`/gm;
	static regexPatterns = {
		comment: /\/\/.*|\/\*[\s\S]*?\*\//gm,
		string: /(["'`])(?:\\.|(?!\1).)*\1/g,
		regex: /\/[^\/]+\//g,
		regexFlag: /(?<=\/[^\/]+\/)([gmi]+)/g,
		keyword: new RegExp(`\\b(?:${[...this.keywords].join('|')})\\b(?!\\()`, 'g'),
		function: /\b\w+(?=\s*\()|\b\w+(?=\s*=(.+)=>)/g,
		parameter: /(?:(?<=\w+\s*\()(\w+)|(?<=\w+\s*\((\w+\s*,\s*)+)(\w+))|(\w+)(?=(\s*,\s*\w+)+\)\s*=>)|(\w+)(?=\)\s*=>)/g,
		number: /(?<=\.|\b)(\d+)\b/g,
		property: /\b(\w+)(?=:)|(?<=\.)\b(\w+)/g,
		symbol: new RegExp(`[${[...this.symbols].join('\\')}]`, 'g'),
		arrowFn: /=>/g,
		ternary: /\?[^:]*:/g,
		sign: new RegExp(`[${[...this.signs].join('\\')}]`, 'g'),
		boolean: /\b(?:true|false|null|undefined)\b/g,
		escapeChars: /\\[^tr]/g,
		constant: /(?<!let\s+)(?<!\.)\b\w+\b(?!:)|(?<=new\s+)\b\w+\b/g
	};
}