---
applyTo: "src/commands/appSettings/**/*.ts,src/commands/codeOptimizations/**/*.ts,src/commands/fixInsight.ts,src/tree/CodeOptimizationTreeItem.ts,src/utils/addProfilerUtils.ts,src/utils/fixInsightsUtils.ts,src/utils/perfIssuesUtils.ts,src/vsCodeConfig/settings.ts"
---

# App settings, workspace configuration, and Code Optimizations

- App-setting commands use `AppSettingsTreeItem`, its client provider, and shared
  `@microsoft/vscode-azext-azureappsettings` operations. Preserve visibility,
  slot-setting semantics, selected app/slot, and refresh behavior rather than
  bypassing the shared client with a production-only ARM call.
- Upload/download target local `.env` files through workspace helpers. Keep
  URI/string/tree entry points working, preserve unrelated local and remote
  keys, and retain `confirmOverwriteSettings` before destructive merges.
  Preserve parsing, quoting, and newline behavior unless explicitly changing
  the serialization contract; cover empty input and cancellation.
- Never log setting values, connection strings, downloaded contents, or full
  settings payloads. Use synthetic values in tests and keep generated `.env`
  files out of commits.
- `src/vsCodeConfig/settings.ts` distinguishes global inspection/update from
  resource-scoped workspace reads/writes. Pass the correct folder path and
  prefix; do not replace multi-root conflict handling with the first folder.
  Keep settings declarations/defaults in `package.json` aligned with consumers.
- Code Optimizations spans `CodeOptimizationTreeItem.ts`, command handlers, and
  Insights/profiler utilities. Preserve eligibility and no-results states;
  a missing result is not proof that the app is unhealthy or uninstrumented.
- Windows profiler enablement updates existing settings and Always On; Linux
  uses a separate instrumentation-guidance workflow. Do not apply Windows
  extension settings indiscriminately to Linux or reset unrelated app settings.
- Enabling Insights may create/configure Azure resources. Preserve wizard
  selections, existing resource linkage, activity/error handling, and refresh
  after successful changes.
- Inspect generated Copilot prompts as data leaving the operation boundary.
  Do not add credentials, connection strings, or raw diagnostic payloads to
  prompts; existing prompt construction is not permission to expand disclosure.
- Use `test/nightly/codeOptimization.test.ts` only as an integration reference;
  check the skipped resource setup before claiming live Insights/profiler proof.
