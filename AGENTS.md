# CodePulse unified development

This workspace maintains the embedded device and both desktop presentations as one project. Read docs/WORKSPACE.md for the current entry points.

- The current checkout preserves the HUD source and existing user changes. The sibling ../CodePulse-Desktop worktree, based on upstream 1.4.11, is the active unified desktop host. The sibling ../firmware is the independent ESP-IDF repository.
- Start the unified application with scripts/start-desktop.ps1. It loads the existing HUD renderer/preload build into the desktop host's Electron process. Do not run a second standalone HUD backend against port 17888.
- Share one canonical StatusHub, CLI hooks, collection services and device API. Surface-specific theme, layout and dismissal belong in the presentation layer; do not mutate another surface's data to implement them.
- Firmware display styles should consume the same device protocol and model. HUD and usage modes now share the production C renderer and desktop Wasm preview; preserve their pixel equivalence. Physical low-flicker quality is still experimental.
- Preserve source differences and user modifications while integrating. This integration is local; do not push or publish unless the user requests it.
- For desktop Node tests, better-sqlite3 may be rebuilt for Node. Rebuild native dependencies for Electron before running the app again. Logs and transient artifacts belong in .tmpshots.
