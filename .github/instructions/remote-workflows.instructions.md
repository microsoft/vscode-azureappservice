---
applyTo: "src/AppServiceFileSystem.ts,src/commands/showFile.ts,src/commands/remoteDebug/**/*.ts,src/commands/startSsh.ts,src/commands/logstream/**/*.ts"
---

# Remote files, debugging, SSH, and logs

- The `azureAppService` filesystem edits live remote site files, not a local
  deployment workspace. Preserve scheme registration and shared
  `AzExtTreeFileSystem`/site-file helpers; do not convert remote URLs to local paths.
- `AppServiceFileSystem.ts` caches ETags by `node.fullId` after reads, uses them on
  writes, retrieves a new ETag after success, and refreshes the node. Preserve the
  save/upload confirmation and explicit HTTP 412 conflict error; never retry a
  conflicting write as an unconditional overwrite.
- Runtime eligibility lives in `remoteDebug/getRemoteDebugLanguage.ts`, not just
  menu visibility. Preserve Linux runtime parsing, Node version/LTS handling,
  the experimental Python setting, and explicit errors for unsupported targets.
  Extend `test/remoteDebug/getRemoteDebugLanguage.test.ts` for changes.
- Keep Docker registry/image details out of telemetry: the language helper
  intentionally records only `docker` for Docker runtime values. Do not broaden
  remote-debug support merely because a runtime appears in creation picks.
- `startRemoteDebug.ts` delegates to the shared helper with site configuration
  and subscription credentials. Preserve progress/cancellation and target
  identity; do not invent a separate tunnel/authentication mechanism.
- `startSsh.ts` is Linux-only and disables remote debugging, with a restart
  warning, before tunneling. Preserve duplicate-start protection, terminal/tunnel
  reuse, failed-start map cleanup, and terminal-close disposal of listeners,
  tunnel, and session entry. Avoid broad process or terminal termination.
- SSH uses proposed `terminalDataWriteEvent` support, declared in `package.json`
  and the checked-in proposal declaration. Keep runtime API use and declarations
  aligned; do not assume the event is a stable API on all VS Code hosts.
- Log streaming uses shared start/stop helpers and a logging-enable callback.
  Preserve site initialization, app/slot labels, OS-specific logging behavior,
  and any restart/enable prompts. Do not mirror customer log streams into
  telemetry or unrelated diagnostic channels.
