---
applyTo: "src/commands/deploy/**/*.ts,src/commands/deployments/**/*.ts,src/commands/deployImage/**/*.ts,src/commands/postDeploy/**/*.ts,src/utils/javaUtils.ts,src/vsCodeConfig/tasks.ts"
---

# Code, source, and container deployments

- `deploy/deploy.ts` coordinates the workflow; actual deployment and pre-deploy
  task execution come from `@microsoft/vscode-azext-azureappservice`. Preserve its
  `IDeployContext` and `getDeployFsPath`/`getDeployNode` contracts rather than
  adding a second upload implementation.
- Keep `originalDeployFsPath`, `effectiveDeployFsPath`, and `workspaceFolder`
  distinct. Zip deployment uses the effective subpath; Local Git/GitHub use the
  original path. Preserve folder/archive and Java artifact selection.
- `setPreDeployConfig.ts` must respect existing `preDeployTask`, `deploySubpath`,
  disabled prompts, non-root deployment folders, and `.deployment` files.
  Keep .NET project and Maven module discovery/task configuration in their
  existing helpers; do not overwrite user tasks or other workspace folders.
- Preserve `SCM_DO_BUILD_DURING_DEPLOYMENT` handling: an existing setting, explicit
  `.deployment`, target runtime, SCM mode, and prompt configuration affect whether
  a Linux Node/Python remote-build prompt is appropriate.
- Keep deployment confirmation, saved-target prompts, and new-app behavior
  distinct. `deploySlot.ts` must retain slot selection and scale-up handling;
  do not silently substitute production for a slot.
- Source configuration, redeploy, and deployment logs under `deployments/` are
  not interchangeable with local code deployment. Preserve source-specific
  authentication, node selection, and refresh paths.
- A completed upload does not prove a healthy website. `postDeploy/runPostDeployTask.ts`
  starts validation and Linux detector work separately; retain cancellation and
  correlation with the deployment. Extend `test/parseDetectorTables.test.ts`
  for detector parsing/timestamp changes using synthetic, non-sensitive data.

## Container Tools contract and creation sequence

- `deployImage/IDeployImageContext.ts` defines the Container Tools options contract
  for `appService.deployImageApi`. Preserve required image/registry/repository/tag
  validation and optional credentials/ACR metadata; coordinate breaking changes
  with callers instead of silently reinterpreting their input.
- The image wizard creates Linux apps. Preserve `reserved`, `kind`, plan,
  custom-location `extendedLocation`, and Arc container-port configuration.
- Non-Arc ACR uses a system-assigned identity: create the site, assign `AcrPull`
  at the registry, then set `linuxFxVersion`. Keep execute priorities and
  `shouldExecute` gates aligned with those dependencies.
- Arc ACR uses explicitly supplied admin credentials; other registries follow
  their own credential path. Do not force the managed-identity path onto them,
  expose secrets, or silently change registry authentication policy.
- `CreateWebhookStep.ts` manages SCM basic auth/publishing credentials and
  registry-specific CI/CD. Treat these as security-affecting operations. Preserve
  repository/tag scoping and surface failures; never log credential-bearing
  webhook targets or raw requests containing them.
- Verify payloads and sequencing with isolated clients for affected branches.
  `test/nightly/deploy.test.ts` is a historical integration example, not proof
  of container coverage or current runtime support.
