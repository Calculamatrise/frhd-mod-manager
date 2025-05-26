const ResponseCodes = {
	ClientError: 4,
	HostError: 5
};

const Operations = {
	GetContentScripts: 'getContentScripts',
	GetManifest: 'getManifest'
};

chrome.runtime.onMessageExternal.addListener(async function(message, sender, sendResponse) {
	if (message === null || message === 'help') {
		return sendResponse({
			errorResponseStructure: {
				code: 'number',
				message: 'string?'
			},
			operations: Object.values(Operations),
			payloadStructure: { op: 'string' },
			responseCodes: ResponseCodes
		});
	}

	const messageType = 'object';
	if (typeof message != messageType) {
		return sendResponse({
			code: ResponseCodes.ClientError,
			message: 'message must be of type: ' + messageType
		});
	}

	try {
		let res = null;
		if (message.op) {
			const opType = 'string';
			if (typeof message.op != opType) {
				return sendResponse({
					code: ResponseCodes.ClientError,
					message: 'message.op must be of type: ' + opType
				});
			}

			switch (message.op) {
			// case Operations.GetContentScripts:
			// 	res = await chrome.scripting.getRegisteredContentScripts();
			// 	break;
			case Operations.GetManifest:
				res = chrome.runtime.getManifest();
			}
		}

		sendResponse(res);
	} catch (err) {
		sendResponse({
			code: ResponseCodes.HostError,
			message: err.message || err
		})
	}
});