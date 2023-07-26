# Change Log

## 0.25.0 - 2023-05-20

### Changed
* [[#2519]](https://github.com/microsoft/vscode-azureappservice/pull/2519) Workspace commands have been organized into a submenu with an App Service icon.

<img width="511" alt="Screenshot 2023-07-19 at 4 51 39 PM" src="https://github.com/microsoft/vscode-azureappservice/assets/12476526/27e4ad87-d09f-4b04-a12f-9120c01f67b3">

* [[#2542]](https://github.com/microsoft/vscode-azureappservice/pull/2542) Make Web App items load significantly faster in the tree view.

### Bugs Fixed
* [[#2549]](https://github.com/microsoft/vscode-azureappservice/pull/2549) Fix Remote Debugging feature for Web Apps.
* [[#2549]](https://github.com/microsoft/vscode-azureappservice/pull/2549) Fix authentication error for the "SSH into Web App" command.
* [[#2518]](https://github.com/microsoft/vscode-azureappservice/pull/2518) Fix "View Properties" command for Web Apps.
* [[#2546]](https://github.com/microsoft/vscode-azureappservice/pull/2546) Fix Deploying to a Web App from the Web App created notification.

### Engineering
* [[#2512]](https://github.com/microsoft/vscode-azureappservice/pull/2512) Move to Track 2 Azure SDKs, remove dependence on `ms-rest-js`.
* [[#2517]](https://github.com/microsoft/vscode-azureappservice/pull/2517) Update to TS 5.1.3.

## 0.24.9 - 2023-05-17

### Added
* Add support for the upcoming Azure Resources Focus feature

## 0.24.8 - 2023-03-22

### Fixed
- Fix when clause contexts for upcoming VS Code (v1.77) release by @MicroFish91 in [#2420](https://github.com/microsoft/vscode-azureappservice/pull/2420)
- Fix extra step in view commit in GitHub command by @alexweininger in [#2389](https://github.com/microsoft/vscode-azureappservice/pull/2389)
- Refresh web app after disconnecting from GitHub by @alexweininger in [#2381](https://github.com/microsoft/vscode-azureappservice/pull/2381)

## 0.24.7 - 2023-02-10

### Fixed
- Error 404 when browsing site files by @alexweininger in [#2371](https://github.com/microsoft/vscode-azureappservice/pull/2371)

## 0.24.6 - 2023-02-08

### Added
- Support for Azure Resources API v2

### Fixed
- Fix `invalid java version 17` when create web app with java 17 runtime by @Flanker32 in [#2350](https://github.com/microsoft/vscode-azureappservice/pull/2350)

### Engineering
- Change context value to a regexp by @nturinski in [#2297](https://github.com/microsoft/vscode-azureappservice/pull/2297)
- Skip Azure tests by @nturinski in [#2335](https://github.com/microsoft/vscode-azureappservice/pull/2335)
- Add .nvmrc file by @alexweininger in [#2346](https://github.com/microsoft/vscode-azureappservice/pull/2346)
- Respond to AzExtTreeFileSystem changes by @alexweininger in [#2352](https://github.com/microsoft/vscode-azureappservice/pull/2352)
- Check `scmType` on an existing `siteConfig` comparison by @MicroFish91 in [#2354](https://github.com/microsoft/vscode-azureappservice/pull/2354)
- Add and use `pickWebApp` util by @alexweininger in [#2367](https://github.com/microsoft/vscode-azureappservice/pull/2367)
- Update azureutils from 0.3.7 to 0.3.8 by @alexweininger in [#2364](https://github.com/microsoft/vscode-azureappservice/pull/2364)
- Bump appservice package and remove kudu dependency by @Flanker32 in [#2365](https://github.com/microsoft/vscode-azureappservice/pull/2365)

### Dependencies
- Bump version after release by @github-actions in [#2329](https://github.com/microsoft/vscode-azureappservice/pull/2329)
- Bump @xmldom/xmldom from 0.7.5 to 0.7.6 by @dependabot in [#2327](https://github.com/microsoft/vscode-azureappservice/pull/2327)
- Bump loader-utils from 1.4.0 to 1.4.2 by @dependabot in [#2336](https://github.com/microsoft/vscode-azureappservice/pull/2336)
- Bump @xmldom/xmldom from 0.7.6 to 0.7.9 by @dependabot in [#2337](https://github.com/microsoft/vscode-azureappservice/pull/2337)
- Bump decode-uri-component from 0.2.0 to 0.2.2 by @dependabot in [#2342](https://github.com/microsoft/vscode-azureappservice/pull/2342)
- Bump simple-git from 3.7.1 to 3.15.1 by @dependabot in [#2345](https://github.com/microsoft/vscode-azureappservice/pull/2345)
- Bump json5 from 1.0.1 to 1.0.2 by @dependabot in [#2349](https://github.com/microsoft/vscode-azureappservice/pull/2349)
- Bump simple-git from 3.15.1 to 3.16.0 by @dependabot in [#2356](https://github.com/microsoft/vscode-azureappservice/pull/2356)

## 0.24.5 - 2022-10-18

### Fixed
- Deployment failures initialized from "Deploy..." button on Workspace ribbon [#2304](https://github.com/microsoft/vscode-azureappservice/issues/2304)

## 0.24.4 - 2022-09-22

## Fixed
- Deployment succeeds even after error "The request was aborted" is thrown [#2305](https://github.com/microsoft/vscode-azureappservice/issues/2305)

## 0.24.3 - 2022-07-05

### Changed
- Update @vscode/extension-telemetry to 0.6.2 [#2276](https://github.com/microsoft/vscode-azureappservice/pull/2276)
- Update minimum supported version of VS Code to 1.66.0 [#2280](https://github.com/microsoft/vscode-azureappservice/pull/2280)

### Fixed
- Include additional information for deployments [#2153](https://github.com/microsoft/vscode-azureappservice/issues/2153)

## 0.24.2 - 2022-06-01
### Changed
- Update @vscode/extension-telemetry to 0.5.2 [#2265](https://github.com/microsoft/vscode-azureappservice/pull/2265)

## 0.24.1 - 2022-05-26
### Added
- Deploy command is now accessible via the Workspace Deploy menu

## 0.24.0 - 2022-05-24

We've made some large design changes to the Azure extensions for VS Code. [View App Centric release notes](https://aka.ms/AzCode/AppCentric)

## 0.23.3 - 2022-04-21
### Fixed
- `Deploy to Slot...` incorrectly deploys to a web app [#2210](https://github.com/microsoft/vscode-azureappservice/issues/2210)

## 0.23.2 - 2022-04-13
### Fixed
- Zip deploy fails with ECONNRESET or 400 Bad Request on VS Code versions `>=1.66.0` [#2191](https://github.com/microsoft/vscode-azureappservice/issues/2191)

## 0.23.1 - 2022-02-24
### Changed
- Adopt VS Code's new [proposal API guidelines](https://github.com/microsoft/vscode/blob/fc7fb5d480418d149ee226ebd45e9c590e240cb5/src/vscode-dts/README.md)
- Minimum version of VS Code is now 1.63.0

## 0.23.0 - 2021-08-06
### Added
- Smart defaults for deploying Java projects (adds settings and tasks for one-click deployment)

### Fixed
- [Bugs Fixed](https://github.com/microsoft/vscode-azureappservice/issues?q=is%3Aissue+milestone%3A0.23.0+is%3Aclosed)

## 0.22.0 - 2021-05-25
### Added
- Support Azure App Service on Kubernetes with Azure Arc (Preview)
- Improve experience when user only has partial permissions for resources on Azure

### Changed
- Minimum version of VS Code is now 1.53.0
- Icons updated to match VS Code's theme. Install new product icon themes [here](https://marketplace.visualstudio.com/search?term=tag%3Aproduct-icon-theme&target=VSCode)
- Newly created Node.js and Python web apps targeting Linux will have `SCM_DO_BUILD_DURING_DEPLOYMENT` set to `true`, automatically building your app in Azure during deploy

### Fixed
- [Bugs Fixed](https://github.com/microsoft/vscode-azureappservice/issues?q=is%3Aissue+milestone%3A0.22.0+is%3Aclosed)

## 0.21.2 - 2021-03-09
### [Fixed](https://github.com/microsoft/vscode-azureappservice/issues/1571)
- Changed archiver to fix hanging deployment failures on WSL and Codespaces

## 0.21.1 - 2021-03-04
### Fixed
- Marketplace description

## 0.21.0 - 2021-03-03
### Added
- Now depends on the "Azure Resources" extension, which provides a "Resource Groups" and "Help and Feedback" view
- "Create Web App" will show a simplified prompt for pricing tier

### Changed
- "Report an Issue" button was removed from errors. Use the "Help and Feedback" view or command palette instead

### Removed
- Trial apps are no longer supported

### [Fixed](https://github.com/microsoft/vscode-azureappservice/issues?q=is%3Aissue+milestone%3A0.21.0+is%3Aclosed)
- Mitigated "ECONNRESET" errors by retrying the request

## 0.20.0 - 2020-11-10
### Added
- Create and deploy a .NET 5 web app
- View properties on a web app
- Improved extension activation time (by switching to the [azure-sdk-for-js](https://github.com/Azure/azure-sdk-for-js))

### Fixed
- [Bugs Fixed](https://github.com/microsoft/vscode-azureappservice/issues?q=is%3Aissue+milestone%3A0.20.0+is%3Aclosed)

## 0.19.0 - 2020-09-15
### Added
- Connect a PostgreSQL server to your web app through the [Azure Databases extension](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-cosmosdb)

### Changed
- Renamed "Connections" node to "Databases"

## 0.18.0 - 2020-07-23
### Added
- Free App Service trial apps! Visit [here](https://code.visualstudio.com/tryappservice/?utm_source=appservice-extension) to create and import your own free Node.js trial app.

### Fixed
- [Bugs Fixed](https://github.com/microsoft/vscode-azureappservice/issues?q=is%3Aissue+milestone%3A0.18.0+is%3Aclosed)

## 0.17.0 - 2020-05-26
### Added
- Enhanced deployment logs to show more information and more accurately detect failures
- Added critical insight notification to help diagnose issues when a deploy succeeds, but the app fails to start

### [Fixed](https://github.com/microsoft/vscode-azureappservice/issues?q=is%3Aissue+is%3Aclosed+milestone%3A0.17.0)
- Error "App is started, but port is unreachable" when ssh-ing into a web app

### Changed
- Minimum version of VS Code is now 1.40.0

## 0.16.5 - 2020-04-10
### Fixed
- Deployment stuck at "Running preDeployTask..." [#1478](https://github.com/microsoft/vscode-azureappservice/issues/1478)

## 0.16.4 - 2020-03-24
### Fixed
- Deployment stuck at "Creating zip package..." [#1447](https://github.com/microsoft/vscode-azureappservice/issues/1447)

## 0.16.3 - 2020-03-04
### Added
- SSH into Linux deployment slots
- Added setting "appService.showDeployConfirmation" to turn off "Are you sure you want to deploy..." dialog
- Logging is enabled by default when creating a web app

### Changed
- Inline button to view deployment logs was removed. Left or right click the tree item instead

### [Fixed](https://github.com/microsoft/vscode-azureappservice/issues?q=is%3Aissue+is%3Aclosed+milestone%3A0.16.3)
- Prompt to select existing resource group instead of "403" error when subscription doesn't have permissions to create

## 0.16.2 - 2019-12-04
### Added
- Python remote debugging (feature flag required)
    - Set `appService.enablePythonRemoteDebugging` to true in VS Code Settings

### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-azureappservice/issues?q=is%3Aissue+is%3Aclosed+milestone%3A0.16.2)

## 0.16.1 - 2019-10-16
### Fixed
- Ignore `deploySubPath` task for local git deploys [#1185](https://github.com/microsoft/vscode-azureappservice/issues/1185)
- Render Linux runtime choices properly when creating web apps [#1202](https://github.com/microsoft/vscode-azureappservice/issues/1202)

## 0.16.0 - 2019-09-18
### Added
- Smart defaults for deploying .NET projects (adds settings and tasks for one-click deployment)
- Add "Collpase All" button to top right of Azure Explorer view
- Web Apps support App Insights by default
- Create New Web App... (Advanced) [`appService.advancedCreation` setting is no longer supported]
- Timestamps are prepended to all output messages.  Turn this off by setting `appService.enableOutputTimestamps` to `false`
- App Service Diagnostics runs post deployment (feature flag required)

### Changed
- Project must be opened in workspace to deploy it

### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-azureappservice/issues?q=is%3Aissue+is%3Aclosed+milestone%3A0.16.0)

## 0.15.0 - 2019-06-10
### Added
- Free tier for Linux plans now available!
- Automatically create a new Windows app service plan if default plan already has 3 web apps
- Deployment slots automatically have the same deployment source configuration as the production web app

### Changed
- When deploying, the project is prompted for first and then the web app

### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-azureappservice/issues?q=is%3Aissue+is%3Aclosed+milestone%3A0.15.0)

## 0.14.0 - 2019-05-01
### Added
- SSH into Linux Web Apps
- View GitHub commits for web apps connected to a GitHub repo
- Show deployment source on Deployments node

### Fixed
- [Bugs fixed](https://github.com/Microsoft/vscode-azureappservice/issues?utf8=%E2%9C%93&q=is%3Aissue+milestone%3A%220.14.0%22+label%3Abug+is%3Aclosed+)

## 0.13.0 - 2019-03-07
### Added
- Remote debugging support for Node.js on Linux (previously required a feature flag)
- Automatically recommend Java runtimes when applicable

### Fixed
- [Bugs fixed](https://github.com/Microsoft/vscode-azureappservice/issues?utf8=%E2%9C%93&q=is%3Aissue+milestone%3A%220.13.0%22+label%3Abug+is%3Aclosed+)

## 0.12.0 - 2019-01-31
### Added
* Significantly improved startup and installation performance

### Fixed
- [Bugs fixed](https://github.com/Microsoft/vscode-azureappservice/issues?utf8=%E2%9C%93&q=is%3Aissue+milestone%3A%220.12.0%22+label%3Abug+is%3Aclosed+)

## 0.11.0 - 2019-01-16
### Added
- App settings are hidden by default and can be revealed by clicking on it in the explorer pane
- Download remote app settings as `.env` file
- Upload local `.env` to remote apps's settings
- Smarter Python defaults for faster, more reliable deployments
- Workspace setting for `appService.preDeployTask`
    - `appService.preDeployTask` will run task defined in `task.json` prior to deployment

### Fixed
- [Bugs fixed](https://github.com/Microsoft/vscode-azureappservice/issues?utf8=%E2%9C%93&q=is%3Aissue+milestone%3A%220.11.0%22+label%3Abug+is%3Aclosed+)

## 0.10.0 - 2018-11-28
### Added
- Deployments node for Web Apps that are connected to a GitHub or LocalGit repository
  - View deployment logs
  - Redeploy previous deployments
- CosmosDB Connections: Leverage [CosmosDB Extension](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-cosmosdb) to effortlessly connect databases to web apps
- Option to reset "appsService.defaultWebAppToDeploy" setting when confirming deployments
- "Connect to Log Stream" node within "Logs"

### Fixed
- [Bugs fixed](https://github.com/Microsoft/vscode-azureappservice/issues?utf8=%E2%9C%93&q=is%3Aissue+milestone%3A%220.10.0%22+label%3Abug+is%3Aclosed+)

## 0.9.1 - 2018-09-06
### Added
- Support for .jar deployment
- Shortcut key for Azure View

### Fixed
- [Bugs fixed](https://github.com/Microsoft/vscode-azureappservice/issues?utf8=%E2%9C%93&q=is%3Aissue+milestone%3A%220.9.1%22+label%3Abug+is%3Aclosed+)

## 0.9.0 - 2018-07-12
### Added
- View and edit remote files for Web Apps and slots (previously required a feature flag)
- View log files for Web Apps and slots
- Deployment defaults for a project workspace. The web app deployed to and the subpath deployed will be saved and used for consequent deployments.
- Support for WAR deploy

### Changed
- `Create New Web App...` has been redesigned to make smart defaults and have fewer prompts.
    - If the previous creation experience is desired, change the VS Code user-setting `{appService.advancedCreation: true}`
- Output window is no longer shown automatically.  Long running notifications have been implemented.

### [Fixed](https://github.com/Microsoft/vscode-azureappservice/issues?utf8=%E2%9C%93&q=is%3Aissue+milestone%3A%220.9.0%22+label%3Abug+is%3Aclosed+)

## 0.8.1 - 2018-05-16
### [Fixed](https://github.com/Microsoft/vscode-azureappservice/issues?utf8=%E2%9C%93&q=is%3Aissue+milestone%3A%220.8.1%22+label%3Abug+is%3Aclosed+)
- Remote debugging fails to attach if App Service tunnel is not ready

## 0.8.0 - 2018-05-03
### Added
- Remote debugging support for Node.js on Linux (feature flag required)
- Modal confirmation dialogs for more visibility

### Changed
- Moved App Service Explorer to Azure view container

### Fixed
- [Bugs fixed](https://github.com/Microsoft/vscode-azureappservice/issues?utf8=%E2%9C%93&q=is%3Aissue+milestone%3A%220.8.0%22+label%3Abug+is%3Aclosed+)

## 0.7.1 - 2018-04-13
### [Fixed](https://github.com/Microsoft/vscode-azureappservice/issues?utf8=%E2%9C%93&q=is%3Aissue+milestone%3A%220.7.1%22+label%3Abug+is%3Aclosed+)
- Deployment fail when deploying to web app with a custom domain

## 0.7.0 - 2018-04-05
### Added
- Subscription filter button next to Subscription nodes in the explorer
- Deploy to Web App context menu action for Web Apps
- Create Windows web apps
- Report issue button on error dialogs that links to the GitHub repo

### Removed
- Auto-browse after web app and slot creation

### Fixed
- [Bugs fixed](https://github.com/Microsoft/vscode-azureappservice/issues?utf8=%E2%9C%93&q=is%3Aissue+milestone%3A%220.7.0%22+label%3Abug+is%3Aclosed+)

## 0.6.1 - 2018-03-12
### [Fixed](https://github.com/Microsoft/vscode-azureappservice/issues?utf8=%E2%9C%93&q=is%3Aissue+milestone%3A%220.6.1%22+label%3Abug+is%3Aclosed+)
- Open in Portal and Browse Website fail on Linux with message "spawn EACCES"

## 0.6.0 - 2018-03-08
### Added
- Configure deployment source to a GitHub repository (requires authorizing Azure to access GitHub)
- Create PHP, .NET Core, and Ruby web apps on Linux
- Faster zipdeploy by leveraging SCM_DO_BUILD_DURING_DEPLOYMENT app setting.  Learn more [here](https://aka.ms/Kwwkbd)

### Fixed
- [Bugs fixed](https://github.com/Microsoft/vscode-azureappservice/issues?utf8=%E2%9C%93&q=is%3Aissue+milestone%3A%220.6.0%22+label%3Abug+is%3Aclosed+)

## 0.5.1 - 2018-01-25
Happy New Year, everybody!  Welcome to 2018!

### Added
- Auto-browse after web app and slot creation
- Link to a great tutorial to get started in the README
- View and edit a deployment slot's files (feature flag required)

### Fixed
- [Bugs fixed](https://github.com/Microsoft/vscode-azureappservice/issues?utf8=%E2%9C%93&q=is%3Aissue+milestone%3A%220.5.1%22+label%3Abug+is%3Aclosed+)

## 0.5.0 - 2017-12-15
### Added
- Configure web app's deployment source from the explorer
- Deploy from Explorer with a button
- Deploy projects immediately after web app creation
- Browse for any folder when deploying
- Zip deployment file inclusion setting
- Create deployment slots from configuration sources
- UI improvements including "Creating..." placeholder nodes, "Load More..." when there are a lot of web apps, etc.
- View and edit a web app's files (feature flag required)
- Run commands from the Command Palette

### Removed
- Deployment from web app context menu
- Display a web app's resource group (display state instead)

### Fixed
- [Bugs fixed](https://github.com/Microsoft/vscode-azureappservice/issues?q=is%3Aissue+milestone%3A%220.5.0%22+label%3Abug+is%3Aclosed)

## 0.4.0 - 2017-11-10
### Added
- Create Deployment Slot
- Icons now match the Azure portal

### Fixed
- [Bugs fixed](https://github.com/Microsoft/vscode-azureappservice/issues?q=is%3Aissue+milestone%3A%22Version+0.4.0%22+label%3Abug+is%3Aclosed)

## 0.3.1 - 2017-11-01
### Fixed
- Show warning message that zip deploy is a destructive action
- Leverage [new app service zipdeploy](https://github.com/projectkudu/kudu/wiki/Deploying-from-a-zip-file)

### Removed
- Zip Deploy no longer runs 'npm install'. It expects a ready-to-run app

## 0.3.0 - 2017-10-18
### Added
- Local Git deployment
- "Create New Web App" remembers user selections
- A setting to show/hide the App Service Explorer
- Swap deployment slots with production site
- "Open In Portal" context menu command for Application Settings
- Generate bash script based on existing web app for automated resource provisioning

### Removed
- "Create New Web App" no longer show bash script, use "Generate Azure CLI Script" context menu command instead.

### Fixed
- [Bugs fixed](https://github.com/Microsoft/vscode-azureappservice/issues?q=is%3Aissue+milestone%3A%22Version+0.3.0%22+is%3Aclosed+label%3Abug)

## 0.2.0 - 2017-10-03
### Added
- Deploy to Deployment Slots
- View web app log stream
- View and edit web app settings
- Delete Deployment Slots and Web Apps

### Removed
- The Explorer view no longer shows Function apps. Function app will have its own Visual Studio Code extension.

### Fixed
- [Bugs fixed](https://github.com/Microsoft/vscode-azureappservice/issues?q=is%3Aissue+milestone%3A%22Version+0.2.0%22+label%3Abug+is%3Aclosed)

## 0.1.0 - 2017-09-19
### Added
- App Service UI components (sash)
- Create new Linux Web App
- Deploy via zip to a Linux Web App
- Generate az shell script with creation/deployment commands
- Wizard style pick list
- Basic support for Deployment Slot - browse, open in portal and swap.
