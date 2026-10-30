# App Service extension architecture

Use [.github/copilot-instructions.md](.github/copilot-instructions.md) for implementation,
bug-fixing, testing, and review rules. Deeper subsystem guidance lives in
[.github/instructions](.github/instructions).

## Follow a user action

`package.json` contributions and `package.nls.json` labels ->
`src/commands/registerCommands.ts` -> command implementation ->
shared Azure Tools helpers or subscription/site client ->
resource-tree refresh, activity/output, and focused tests.

## Code ownership map

| Area | Start here | Boundary |
| --- | --- | --- |
| Activation and dependencies | `main.js`, `src/extension.ts`, `src/extensionVariables.ts`, `src/utils/getExtensionApi.ts` | The handwritten entrypoint measures bundle load time; activation registers shared extension variables, commands, the Azure Resources resolver, and the filesystem. |
| Resource resolution and tree | `src/WebAppResolver.ts`, `src/tree/ResolvedWebAppResource.ts`, `src/tree/SiteTreeItem.ts`, `src/tree/DeploymentSlotsTreeItem.ts` | Resource Graph supplies lightweight models; ARM lazily initializes `ParsedSite`. `SiteTreeItem` delegates to the resolved resource for child/slot compatibility. |
| Azure clients and resource picking | `src/utils/azureClients.ts`, `src/utils/pickWebApp.ts`, `src/constants.ts` | Shared factories supply authentication/cloud context; initialized sites supply slot-aware clients. |
| Create apps and slots | `src/commands/createWebApp/`, `src/commands/createSlot.ts`, `src/commands/swapSlots.ts` | Wizard contexts/steps coordinate runtime, OS, plan, Insights, custom locations, and slot behavior. |
| Deploy code and configure sources | `src/commands/deploy/`, `src/commands/deployments/`, `src/commands/postDeploy/` | Local workspace/tasks feed shared deployment helpers; post-deploy health checks are separate from upload completion. |
| Deploy containers | `src/commands/deployImage/` | Container Tools command contract, Linux creation, ACR identity/role assignment, Arc credentials, and CI/CD webhooks. |
| Settings and Code Optimizations | `src/commands/appSettings/`, `src/commands/codeOptimizations/`, `src/tree/CodeOptimizationTreeItem.ts`, `src/utils/addProfilerUtils.ts`, `src/utils/fixInsightsUtils.ts`, `src/utils/perfIssuesUtils.ts` | Shared settings tree/client abstractions; local `.env` transfers; Insights/profiler configuration and diagnostic results. |
| Remote operations | `src/AppServiceFileSystem.ts`, `src/commands/showFile.ts`, `src/commands/remoteDebug/`, `src/commands/startSsh.ts`, `src/commands/logstream/` | Remote file ETags, language eligibility, authenticated tunnels, terminal/session cleanup, and logging. |
| Workspace configuration | `src/vsCodeConfig/`, `src/utils/workspace.ts`, `src/utils/pathUtils.ts`, `src/utils/javaUtils.ts` | Resource-scoped settings, task configuration, local path handling, and language-specific deployment preparation. |
| Extension API | `src/vscode-azureappservice.api.d.ts`, `src/commands/api/revealTreeItem.ts`, `src/extension.ts` | Versioned exported `revealTreeItem` API; container deployment is a separate registered command contract. |
| Tests | `test/global.test.ts`, `test/remoteDebug/getRemoteDebugLanguage.test.ts`, `test/parseDetectorTables.test.ts`, `test/nightly/` | VS Code-hosted Mocha tests; Azure integration fixtures and their currently skipped resource setup. |
| Engineering | `package.json`, `esbuild.mjs`, `.vscode-test.mjs`, `eslint.config.mjs`, `.github/workflows/main.yml`, `.config/` | Shared `vscode-azext-eng` tooling and `vscode-azuretools` pipeline templates. |

## External ownership

- `@microsoft/vscode-azext-azureappservice` owns shared `ParsedSite`, site clients,
  deployment, slot, log-stream, tunnel, and many wizard/tree helpers.
- `@microsoft/vscode-azext-azureappsettings` owns shared settings tree/client behavior.
- `@microsoft/vscode-azext-utils` and `@microsoft/vscode-azext-azureutils` own action
  handling, wizards, activities, client factories, and common Azure UI.
- The Azure Resources extension hosts the resource explorer and picker API.
  Do not build a parallel account/tree implementation here.
- Human review ownership is recorded in [.github/CODEOWNERS](.github/CODEOWNERS).
