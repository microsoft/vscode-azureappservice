# Azure App Service repository guidance

This is the TypeScript VS Code extension for Azure App Service, not the App Service
backend or the Azure Functions extension. Start with [AGENTS.md](../AGENTS.md) for
the architecture map and `instructions/*.instructions.md` for subsystem contracts.

## Implementation and bug fixes

- Trace the concrete entry point through `package.json`,
  `src/commands/registerCommands.ts`, the command, and its shared helper/client.
  Establish the triggering input and expected behavior before editing.
- Make the smallest complete fix at the responsible layer. Preserve unrelated
  behavior; do not copy Azure Functions assumptions, introduce new frameworks,
  or duplicate behavior already supplied by the Azure Tools packages.
- Keep command IDs, argument shapes, context values, menu `when` clauses,
  keybindings, and configuration declarations aligned. Exercise both tree actions
  and command-palette/explorer/API entry points when affected; a selected node is
  not guaranteed.
- Use the existing `IActionContext`, `context.ui`, command-registration wrappers,
  `AzureWizard` steps, activity contexts, and output channel. Preserve user
  cancellation, confirmation prompts, progress, and temporary tree descriptions.
  Do not turn failed operations into successful notifications or swallow errors.
  Optional work may be best-effort only with an explicit, safe diagnostic path.
- Initialize lazily resolved sites before accessing `node.site`. Reuse
  `ParsedSite.createClient(context)` for site/slot operations and shared/local
  Azure client factories for ARM/Resource Graph operations. Preserve subscription,
  tenant, cloud, resource group, and slot identity; do not hardcode public-cloud
  management endpoints or introduce a separate credential flow.
- Distinguish the extension host OS from the target app OS. Preserve Windows/Linux,
  runtime, plan-tier, production/slot, and Azure/custom-location differences.
  Deployment may start from a folder, archive, tree item, or saved workspace target.
- Use `vscode.Uri` and Node `path` helpers for local paths; reuse
  `src/utils/pathUtils.ts`. Do not treat remote resource URLs as local filesystem
  paths or assume a single-root workspace. Use resource-scoped settings helpers
  in `src/vsCodeConfig/settings.ts` with the actual deployment/workspace path.
- Keep strict TypeScript and existing type-only import conventions. Use shared
  interfaces and explicit guards instead of new `any` or unchecked casts.
  Existing compatibility casts are not a precedent for bypassing validation.
- Localize new user-facing source strings through `src/localize.ts`; manifest
  strings belong in `package.nls.json` and `%key%` references in `package.json`.
  Preserve existing localization keys unless a change actually requires one.

## Sensitive data and lifecycle

- Never put app-setting values, `.env` contents, registry secrets, publishing
  credentials, credential-bearing SCM/webhook URLs, connection strings, or raw
  customer logs into telemetry, errors, fixtures, or new diagnostic output.
  Preserve masking in resolved resources and `maskUserInfo` paths.
- Treat user-visible transfer/display of settings and explicit credential-copy
  actions as privileged workflows, not permission to log their payloads.
  Do not send secrets to generated chat prompts or new external services.
- Dispose new event handlers, terminals, tunnels, cancellation sources, and
  providers with the owning lifecycle. Preserve per-resource session identity,
  duplicate-start protection, and cancellation of obsolete post-deploy checks.
- Refresh the affected resource/settings/slot tree after successful mutations
  using the existing host API or node refresh path. Do not mask an operation
  failure merely to make the tree look current.

## Build and verification

The exact package scripts are:

| Command | Purpose |
| --- | --- |
| `npm run build:esbuild` | Bundle via `esbuild.mjs` and shared engineering configuration. |
| `npm run build:check` | Type-check with `tsc --noEmit`. |
| `npm run build` | Runs the bundle and type-check scripts using a shell `&`; use the two explicit scripts sequentially when reliable individual exit status is required. |
| `npm run lint` | ESLint with zero warnings allowed. |
| `npm test` | VS Code extension-host tests through `vscode-test` and `.vscode-test.mjs`. |
| `npm run package` | Create a VSIX with `vsce package --githubBranch main`; not a routine test command. |

- Follow the lockfile when restoring dependencies (`npm ci`); use the repository's
  `.nvmrc`. Do not install tools or replace shared engineering configuration just
  to work around an unrelated environment problem.
- Add focused regression coverage for the triggering case and important adjacent
  behavior. Existing examples use Mocha/assert and Azure Tools test action/UI
  helpers. Restore modified settings and isolate external calls.
- Run the smallest relevant checks; report what actually ran and any blockers.
  Type-checking is not bundling, and a passing test command is not evidence that
  skipped Azure integration tests ran. See
  [testing instructions](instructions/testing.instructions.md).
- `.github/workflows/main.yml` delegates to the shared Azure Tools jobs workflow;
  `.config/build.yml` and `.config/release.yml` use shared Azure DevOps templates.
  Inspect the actual failed job before changing build code; do not assume the
  complete CI behavior is defined in this repository.
- Do not hand-edit `dist/`, `out/`, `node_modules/`, `.vscode-test/`, VSIX files,
  or test-result artifacts. `main.js` is a handwritten tracked loader, not a
  generated bundle. The stack fallback in
  `src/commands/createWebApp/stacks/backupStacks.ts` is checked-in source data:
  avoid incidental reformatting or treating its old runtimes as current support.
- Update directly affected documentation. Documentation-only changes need path,
  link, instruction-frontmatter, and whitespace inspection, not product builds.

## Pull request review

- Report concrete regressions introduced by the diff, not stylistic preferences,
  speculative Azure behavior, or unrelated existing issues. Follow callers and
  shared contracts before declaring a bug; distinguish evidence from uncertainty.
- For each finding, provide severity, the smallest useful changed file/line range,
  a realistic triggering scenario, observable user impact, and the smallest viable
  fix. Explain why existing guards or tests do not prevent it.
- Prioritize wrong app/subscription/slot mutations; overwritten settings/files;
  credential exposure; broken deployment modes; OS/runtime/plan incompatibility;
  missed refresh/cancellation/cleanup; and command/API contract breaks.
- Check relevant adjacent paths: production versus slots; zip versus Local Git
  or GitHub deployment; ACR versus other registries and Arc; tree versus no-node
  invocation; multi-root settings; empty/stale/partial Azure responses; and
  cancellation or failure after partial resource creation. Only require cases
  relevant to the change, not a blanket matrix.
- Do not claim testing or Azure validation that did not occur. If no actionable
  defects remain, say so and identify material coverage gaps without inventing
  findings.
