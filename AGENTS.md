# Unified desktop host

Read docs/WORKSPACE.md. This is the codex/unified-desktop worktree, based on
upstream Desktop 1.4.11; ../CodePulse is the HUD checkout. Use its
scripts/start-desktop.ps1 to run one Electron backend for both presentations.
Never start a second server on 17888. Preserve user changes and shared canonical
state. Device preview and LAN API use the same projection and renderer assets.
Do not publish private hardware records, runtime captures or credentials.
If Node tests rebuild better-sqlite3, rebuild it for Electron before launching.
Logs and temporary output belong in ../CodePulse/.tmpshots. Push only on request.
