---
applyTo: "src/extension.ts,src/extensionVariables.ts,src/WebAppResolver.ts,src/tree/**/*.ts,src/utils/azureClients.ts,src/utils/getExtensionApi.ts,src/utils/pickWebApp.ts,src/utils/treeUtils.ts,src/utils/contextUtils.ts,src/commands/registerCommands.ts,src/commands/api/**/*.ts,src/vscode-azureappservice.api.d.ts"
---

# Azure Resources, tree adapters, and API boundaries

- `extension.ts` registers `WebAppResolver` through the Azure Resources host API;
  `utils/getExtensionApi.ts` negotiates the host API version. Preserve activation
  order, shared extension-variable registration, and disposable ownership.
- Azure Resources owns account/subscription selection and uses
  `@microsoft/vscode-azext-azureauth`, which calls `vscode.authentication.getSession`
  through the built-in Microsoft Authentication extension. The configured
  provider is `microsoft` for public Azure or `microsoft-sovereign-cloud` for
  sovereign/custom clouds; let the auth package choose provider/scopes/tenant.
- `pickWebApp.ts` delegates to `ext.rgApi.pickAppResource`.
  `WebAppResolver.resolveResource` receives the host's `ISubscriptionContext`;
  `ResolvedWebAppResource` retains it for lazy initialization and `ParsedSite`.
  Creation wizards copy the selected node's subscription context. Preserve
  credentials, `createCredentialsForScopes`, authentication when supplied,
  account/tenant identity, subscription, environment, and custom-cloud metadata
  when passing contexts to shared factories; do not reconstruct partial contexts.
- For auth bugs, follow host selection -> auth package session/credential ->
  subscription-context conversion -> local/shared client factory. Check Azure
  Resources and Microsoft Authentication logs without exposing tokens or account
  details. CLI login or federated test credentials do not verify interactive
  VS Code sign-in; do not add `DefaultAzureCredential` or an independent login
  fallback to work around missing host sessions.
- `WebAppResolver.ts` uses paginated Resource Graph results, a short-lived cache,
  a shared in-flight load, lowercased resource-ID keys, and an ARM fallback for
  newly created apps not yet visible in the graph. Retain these behaviors when
  changing resolution. Account for subscription identity when modifying caches.
- Check both `matchesResource` and the graph query when changing resource-kind
  filters; they are separate paths. Do not accidentally claim Functions or
  workflow resources. Preserve duplicate-name/location disambiguation.
- `ResolvedWebAppResource` can start with only an `AppServiceDataModel`.
  Await `initSite(context)` before accessing the full `ParsedSite`; a getter
  that initiates asynchronous work is not a substitute for awaited initialization.
- `SiteTreeItem` delegates to `ResolvedWebAppResource`. Keep both representations
  working for child loading, pickers, refresh, delete, properties, and slot nodes.
  Do not introduce assumptions that every command receives the same class.
- Context values are contracts with manifest menu conditions and picker routing.
  Preserve `azAppWebApp`/`azAppSlot` semantics, `pickTreeItemImpl`, child ordering,
  slot-plan availability, Linux WebJobs availability, and Code Optimizations
  eligibility when editing tree behavior.
- Prefer the initialized site's client for site/slot mutations. For other clients,
  preserve the lazy SDK imports and shared factories in `utils/azureClients.ts`;
  types should not cause eager loading of large SDKs during activation.
- Keep `maskedValuesToAdd` populated on initialization/refresh as resource metadata
  changes. Do not bypass masking by logging raw models, settings, or host URLs.
- Preserve version negotiation between `createApiProvider` and
  `vscode-azureappservice.api.d.ts`, including `revealTreeItem(resourceId)`.
  `appService.deployImageApi` is a separate command contract, not an exported
  member of that interface.
- Command registrations deliberately mix tree-node-unwrapping wrappers, site
  commands, and a plain image API command. Preserve argument adaptation and
  action/error handling when adding or moving a registration.
