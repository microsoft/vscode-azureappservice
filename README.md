# Azure App Service for Visual Studio Code (Preview)

[![Version](https://vsmarketplacebadge.apphb.com/version/ms-azuretools.vscode-azureappservice.svg)](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azureappservice) [![Installs](https://vsmarketplacebadge.apphb.com/installs-short/ms-azuretools.vscode-azureappservice.svg)](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azureappservice) [![Build Status](https://dev.azure.com/ms-azuretools/AzCode/_apis/build/status/vscode-azureappservice)](https://dev.azure.com/ms-azuretools/AzCode/_build/latest?definitionId=5)

App Service is Azure's fully-managed Platform as a Service (PaaS) that let's you
deploy and scale web, mobile, and API apps. Use the Azure App Service extension
for VS Code to quickly create, manage, and deploy your websites.

**Visit the [wiki](https://github.com/Microsoft/vscode-azureappservice/wiki) more information about Azure App Service and how to use the advanced features of the extension.**

## Installation

1. Download and install the [Azure App Service extension](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azureappservice) for Visual Studio Code
    > If you're interested in deploying single page web apps or progressive web apps (something **without** an express server), install the [Azure Storage extension](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azurestorage)
2. Wait for the extension to finish installing then reload Visual Studio Code when prompted
3. Once complete, you'll see an Azure icon in the Activity Bar
    > If your activity bar is hidden, you won't be able to access the extension. Show the Activity Bar by clicking View > Appearance > Show Activity Bar
4. Sign in to your Azure Account by clicking Sign in to Azure…
    >  If you don't already have an Azure Account, click "Create a Free Azure Account" or you can [try Azure for free](https://code.visualstudio.com/tryappservice/?utm_source=appservice-extension)

## Deploy your first Node.js app to Azure

Once you are signed in to your Azure account and you have your app open in Visual
Studio Code, click the deploy button in the Azure App Service explorer - it's
the blue up arrow - to deploy your app.

<img src="https://user-images.githubusercontent.com/1186948/50742590-49250000-11c2-11e9-85ff-c5f4c9352e3c.png" width="300">

> Tip: Be sure that your application is listening on the port provided by the PORT environment variable: `process.env.PORT`

1. Choose **Create New App**
2. Type a globally unique name for your Web App and press Enter. Valid characters for an app name are 'a-z', '0-9', and '-'
3. Choose your **Node.js version**, LTS is recommended
    > The notification shows each resource that's created to host your app. Once completed, click **View Output** to open the output channel and see the detailed resources required
4. Choose the directory that you currently have open

Click **Yes** when prompted to update your configuration to run `npm install` on the target server.

<img src="https://user-images.githubusercontent.com/1186948/50742595-63f77480-11c2-11e9-9268-b8522ce9a12b.png" width="400">

Once the deployment starts, you're prompted to update your workspace so that all subsequent deploys automatically deploy to the same App Service Web App. Choose **Yes** to ensure your changes are deployed to the correct app.

<img src="https://user-images.githubusercontent.com/1186948/50742599-75408100-11c2-11e9-98a4-588a62000e7a.png" width="400">

Once the deployment completes, click **Browse Website** in the prompt to view your freshly deployed website. It may take a few seconds for the deployment to complete.

## Stream Your Application Logs

1. In the Azure App Service explorer, expand the app then expand **Logs**
2. Click on **Connect to Log Steam...**

<img src="https://user-images.githubusercontent.com/1186948/51132977-961f5c80-17e8-11e9-9190-ada10f88967b.png" width="300">

3. Choose **Yes** when prompted to enable logging and restart the app
    > File logging is disabled by default and will automatically be disabled within 24 hours
4. The Visual Studio Code output window opens with a connection to the log stream

```
Connecting to log stream...
2019-01-06T07:36:52  Welcome, you are now connected to log-streaming service.
2019-01-06 07:37:08.038 INFO  - Starting container for site
2019-01-06 07:37:33.273 INFO  - Container mahernaexpress_0 for site mahernaexpress initialized successfully.
```

## Setup GitHub Deployment

Configure App Service to automatically deploy your GitHub repository when changes are pushed. With this setup, you can also rollback to previous commits if something goes wrong.

1. Create a new app in App Service
    > Click the "+" icon in the explorer to create a new app without deploying your current workspace
2. In the Azure App Service explorer, expand the app then expand **Deployments**
3. Click **Connect to a GitHub repository...**
4. Authorize Azure to access your GitHub organization by clicking **Go to Portal** in the notification
5. Click on "GitHub" (**1** in the screenshot below) then click **Authorize** (**2** in the screenshot below)

![image](https://user-images.githubusercontent.com/1186948/50780847-d450d500-1258-11e9-9601-25e1c5a28e8a.png)

Once authorized, close the browser window, return to Visual Studio Code, and click **Connect to a GitHub repository...** in the explorer again. From here, choose the organization, repository, and branch you want to deploy.

It will take some time while Azure configures the necessary hooks and does an initial deployment. Once configuration and deployment are complete, use the **Deployments** node to quickly verify the status of your deployments, view the deployment logs, or rollback to a previous commit.

## Advanced Creation Configuration Settings

* `appService.advancedCreation`
  * Enables full control for `Create New Web App...`.  Set this to `true` to explicitly control more settings (i.e. App Service plan size) when creating web apps rather than using the defaults.

## Known Issues

* Local Git deployment may fail with large commits

## Contributing

There are a couple of ways you can contribute to this repo:

* **Ideas, feature requests and bugs**: We are open to all ideas and we want to get rid of bugs! Use the Issues section to either report a new issue, provide your ideas or contribute to existing threads.
* **Documentation**: Found a typo or strangely worded sentences? Submit a PR!
* **Code**: Contribute bug fixes, features or design changes:
  * Clone the repository locally and open in VS Code.
  * Install [TSLint for Visual Studio Code](https://marketplace.visualstudio.com/items?itemName=eg2.tslint).
  * Open the terminal (press `` CTRL+` ``) and run `npm install`.
  * To build, press `F1` and type in `Tasks: Run Build Task`.
  * Debug: press `F5` to start debugging the extension.

### Legal

Before we can accept your pull request you will need to sign a **Contribution License Agreement**. All you need to do is to submit a pull request, then the PR will get appropriately labelled (e.g. `cla-required`, `cla-norequired`, `cla-signed`, `cla-already-signed`). If you already signed the agreement we will continue with reviewing the PR, otherwise system will tell you how you can sign the CLA. Once you sign the CLA all future PR's will be labeled as `cla-signed`.

### Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Telemetry

VS Code collects usage data and sends it to Microsoft to help improve our products and services. Read our [privacy statement](https://go.microsoft.com/fwlink/?LinkID=528096&clcid=0x409) to learn more. If you don’t wish to send usage data to Microsoft, you can set the `telemetry.enableTelemetry` setting to `false`. Learn more in our [FAQ](https://code.visualstudio.com/docs/supporting/faq#_how-to-disable-telemetry-reporting).

## License

[MIT](LICENSE.md)
