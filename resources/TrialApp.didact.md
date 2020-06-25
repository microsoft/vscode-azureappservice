# Welcome to your Trial App Didact Tutorial

Your trial will last 60 minutes. Follow the below steps below to edit your free app. You can find more information about Azure App Service [here](https://docs.microsoft.com/en-us/azure/app-service/).

## Requirements

| Requirement (Click to Verify)  | Status | Additional Information/Solution |
| :--- | :--- | :--- |
| [Check if git is installed](didact://?commandId=vscode.didact.cliCommandSuccessful&text=git-install-status$$git%20version "Tests to see if git version returns sucessful."){.didact} | *Status: unknown*{#git-install-status} | Download and install git from [here](https://git-scm.com/download) |

## Getting Started

### Step 1: Clone the trial app source code

Clone the source code, then open the folder in VS Code.

[Click here](didact://?commandId=appService.CloneTrialApp) to clone the source code.

Make sure to add the folder to the workspace.
[This link verifies that at least one folder exists in the workspace](didact://?commandId=vscode.didact.workspaceFolderExistsCheck&text=workspace-folder-status "Ensures that at least one folder exists in the user workspace"){.didact}

*Status: unknown*{#workspace-folder-status}

### Step 2: Make some changes to your app

Make some changes to your trial app. Try changing some text in `template.html`.

[Click here](didact://?commandId=workbench.view.explorer) to view the project files in the Explorer.

### Step 3: Deploy your changes

[Click here](didact://?commandId=appService.deploy) to deploy your changes to Azure.

### Step 5: View your changes live

[Click here](didact://?commandId=appService.Browse) to browse your updated trial app site.

### Step 6: Transfer to an Azure account

[Click here]() to sign in/sign up for an Azure account and transfer your trial app to your subscription.

---

This tutorial is made with [vscode-didact](https://github.com/redhat-developer/vscode-didact).
