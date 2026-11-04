---
applyTo: "src/commands/createWebApp/**/*.ts,src/commands/createSlot.ts,src/commands/swapSlots.ts,src/tree/DeploymentSlotsTreeItem.ts"
---

# App creation, runtimes, and slots

- Follow `IWebAppWizardContext` and the existing prompt/execute steps.
  `createWebApp.ts` has different basic and advanced flows; preserve resource
  group/plan/Insights creation versus selection and the post-prompt defaults.
  Prompt-time state is not guaranteed to be final execute-time state.
- Preserve step priorities, `shouldExecute` checks, location/provider setup,
  activity results, and resource-tree refresh. Avoid duplicating resource
  creation or performing a new irreversible mutation in a selection step.
- `stacks/getStackPicks.ts` reads the stacks ARM API, filters versions, and falls
  back to `backupStacks.ts` with masked diagnostics and a visible warning.
  Preserve hidden/deprecated filtering, Java-container selection, recommendation
  ordering, and OS-specific preview/early-access metadata.
- A stack's display label is not its ARM runtime value. Follow the typed models,
  `WebAppStackStep.ts`, `getJavaLinuxRuntime.ts`, and `WebAppCreateStep.ts` when
  mapping selections to Linux `linuxFxVersion` or Windows language properties.
  Preserve .NET Framework versus .NET Core and Java server/container distinctions.
- Keep Linux `reserved`, app `kind`, custom-location `extendedLocation`, selected
  plan/location, and domain-name-label scope coherent in creation payloads.
  Use the returned `defaultHostName` rather than reconstructing a hostname from
  the app name; domain-label scope can change the hostname format.
- Preserve OS-specific Application Insights agent settings, profiler opt-in,
  Always On behavior, and Linux Node/Python remote-build defaults. Do not enable
  paid/resource-affecting options or change user choices as an unrelated fix.
- Slots are child resources, not independently selected production apps.
  `DeploymentSlotsTreeItem.ts` and resolved-resource children enforce supported
  plan behavior; keep the not-available/scale-up route.
- `createSlot.ts` configures supported deployment sources on the newly created
  slot using the parent source configuration. `swapSlots.ts` passes the source
  and sibling sites to the shared swap helper. Preserve source/target identity,
  confirmations, and production-versus-slot client routing.
- Cover relevant basic/advanced, Windows/Linux, Java/non-Java, fallback-stack,
  plan-tier, and slot cases with controlled contexts/client responses.
  Old runtime strings in nightly fixtures are not a support-policy reference.
