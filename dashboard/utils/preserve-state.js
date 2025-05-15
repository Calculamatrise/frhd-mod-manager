{
	const STORAGE_KEY = 'app.config';
	const parseConfig = () => {
		const entry = localStorage.getItem(STORAGE_KEY);
		if (entry) {
			try {
				return JSON.parse(entry);
			} catch {}
		}
		return null
	};
	const updateConfig = callback => {
		if (typeof callback != 'function')
			throw new TypeError("Callback must be of type: function");
		const config = parseConfig() || {};
		callback(config);
		if (Object.keys(config).length < 1) {
			localStorage.removeItem(STORAGE_KEY);
			return;
		}
		localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
	};

	const DOM = {
		Nav: {
			sidebar: document.querySelector('#sidebar'),
			sidebarToggle: document.querySelector('#sidebar-toggle')
		}
	};

	const defaultSidebarToggleState = DOM.Nav.sidebarToggle.checked;
	DOM.Nav.sidebarToggle.addEventListener('change', function() {
		updateConfig(config => {
			if (this.checked === defaultSidebarToggleState) {
				delete config.sidebarToggle;
				return;
			}
			config.sidebarToggle = this.checked
		})
	});

	const config = parseConfig();
	if (config) {
		for (const key in config) {
			switch (key) {
			case 'sidebarToggle':
				DOM.Nav.sidebar.style.setProperty('transition', 'none');
				DOM.Nav.sidebarToggle.checked = config[key];
				setTimeout(() => DOM.Nav.sidebar.style.removeProperty('transition'), 10)
			}
		}
	}
}