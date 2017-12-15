# Change Log
All notable changes to the "azure-appservice" extension will be documented in this file.

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
