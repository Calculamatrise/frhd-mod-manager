import SyntaxHighlightFragment from "./highlight.js";

export default class HTMLHighlightFragment extends SyntaxHighlightFragment {
	static symbols = new Set(['<', '=', '>']);
	static regexPatterns = {
		boolean: /(?<=\<[!\/]?\b[\w-]+\s+)[\w-]+\b(?=.*>)/g,
		string: /(["'`])(?:\\.|(?!\1).)*\1/g,
		comment: /<!-{2}[\s\S]*?-->/g,
		tag: /(?<=\<[!\/]?)\b(?:[\w-]+)\b/g,
		symbol: /[<=>]/g,
	};
}