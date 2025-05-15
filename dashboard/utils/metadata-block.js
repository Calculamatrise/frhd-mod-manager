export function formatUserScript(content, metadata) {
	if (content.startsWith('// ==UserScript==')) return content;

	const lines = ['==UserScript=='];
	const maxKeyLen = Math.max(...Object.keys(metadata).map(k => k.length));
	for (const key in metadata) {
		lines.push('@' + key.padEnd(maxKeyLen) + ' ' + metadata[key]);
	}

	lines.push('==/UserScript==\n');
	return lines.map(line => '// ' + line).join('\n') + content
}

export function parseUserScript(content) {
	if (!content.startsWith('// ==UserScript==')) return null;

	const metadata = {};
	const lines = content.split('\n');
	lines.shift();
	while (lines.length) {
		const line = lines.shift().trim();
		if (line.startsWith('// ==/UserScript==')) break;

		const match = line.match(/^\/\/\s*@(\S+)\s+(.+)$/);
		if (!match) continue;

		const [, key, value] = match;
		metadata[key] = value.trim();
	}

	return Object.assign(metadata, { content: lines.join('\n') })
}