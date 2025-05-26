# Free Rider Mod Manager
A lightweight, user-friendly chrome-extension to manage and apply mods for [**Free Rider HD**](https://en.wikipedia.org/wiki/Free_Rider_HD). Whether you're tweaking visuals, manipulating in-game mechanics, or injecting custom functions, this is your go-to tool to customize and enhance your experience.

[![Add to Chrome](https://img.shields.io/badge/Add%20to%20Chrome-blue?logo=googlechrome&logoColor=white)](https://chrome.google.com/webstore/detail/ibipiaipelijncmejpfindopakhdhaco)

## Features
- Toggle mods with a single click
- Drag-and-drop support for installing mods
- Supports both `.zip` and extracted mod folders
- Clean and intuitive UI/UX

## Benefits
### For Developers
- No more worrying about proper, reliable script injection
- Scripts can hook into core ModManager events like `game:ready`, `game:start`, etc.
- Easy way to build mini-Tampermonkey-style scripts within the extension
- Extension-based mods can define config UIs (*coming soon*)
### For Users
- Add or remove mods effortlessly
- Fine-tune script order priority
- Improved performance and compatibility with scripts from various developers

> [!WARNING]
> **Script Execution Matters!**
> Some scripts depend on others. Script priority ensures they run in the right order – devs should clarify these dependencies.

## For Developers
A global `ModManager` object is injectied into the page, which:
- Provides a central hub for all loaded mods
- Emits events like:
	- `mod:load`
	- `game:ready`
	- `player:reset`
- Will eventually support mod configuration UIs within the extension popup
- Enables modular and reactive script structure

## Installation
> Available on the [Chrome Web Store](https://chrome.google.com/webstore/detail/ibipiaipelijncmejpfindopakhdhaco)

For a manual install of the latest release, follow these steps:
1. Clone the GitHub repository
2. Go to `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked**
5. Select the project folder

> **Want to learn more or join the discussion?**  
> Check out the [forum thread](https://community.freeriderhd.com/threads/free-rider-mod-manager.14961/)!