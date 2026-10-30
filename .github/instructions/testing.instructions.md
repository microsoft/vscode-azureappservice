---
applyTo: "test/**/*.ts,.vscode-test.mjs,.vscode/launch.json"
---

# Testing contracts and limits

- Tests are VS Code-hosted Mocha suites, not a standalone Node test runner.
  `npm test` invokes `vscode-test`; `.vscode-test.mjs` re-exports
  `azExtTestConfig` from `@microsoft/vscode-azext-eng/vscode-test`.
  Inspect the installed runner's options before proposing new filtering flags.
- `test/global.test.ts` activates the extension, installs `TestOutputChannel`,
  and defaults actions to `TestUserInput` so unexpected prompts fail instead
  of hanging. Reuse `createTestActionContext`/`runWithTestActionContext` and
  scripted UI inputs where appropriate.
- Follow `test/remoteDebug/getRemoteDebugLanguage.test.ts` for runtime parsing,
  errors, telemetry masking, and settings-gated behavior;
  `test/parseDetectorTables.test.ts` covers detector tables/timestamps.
  Add focused assertions for the observable regression, not only helper calls.
- `test/runWithSetting.ts` supplies setting-restoration helpers. Restore changed
  settings and dispose stubs, listeners, and temporary resources even on failure.
  Do not let tests rely on a developer's saved target or signed-in subscription.
- Azure integration suites under `test/nightly/` have long-running gates.
  `test/global.test.ts` checks `AzCode_EnableLongRunningTestsLocal`,
  `FC_SERVICE_CONNECTION_NAME`, and `AzCode_UseAzureFederatedCredentials`;
  `test/nightly/global.resource.test.ts` currently calls `this.skip()`
  unconditionally and leaves resource cleanup commented out.
- Setting an environment flag alone does not make these Azure suites operational.
  Do not remove the skip or enable provisioning as incidental regression work.
  Any explicit restoration needs authenticated setup, isolated resources,
  reliable cleanup, and acknowledgement of Azure cost.
- Existing nightly fixtures contain historical runtime versions and sample
  projects. Do not infer current service support or runnable coverage from them.
  Prefer synthetic responses and isolated clients for local regression coverage.
- Distinguish bundle/type/lint checks from executed tests, and executed local
  suites from skipped live-Azure suites. Record environment/runner blockers
  accurately; do not describe skipped tests as passing coverage.
