# Azure App Service for Visual Studio Code (Preview)

<!-- region exclude-from-marketplace -->

[![Version](https://vsmarketplacebadge.apphb.com/version/ms-azuretools.vscode-azureappservice.svg)](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azureappservice) [![Installs](https://vsmarketplacebadge.apphb.com/installs-short/ms-azuretools.vscode-azureappservice.svg)](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azureappservice) [![Build Status](https://dev.azure.com/ms-azuretools/AzCode/_apis/build/status/vscode-azureappservice)](https://dev.azure.com/ms-azuretools/AzCode/_build/latest?definitionId=5)

<!-- endregion exclude-from-marketplace -->

App Service is Azure's fully-managed Platform as a Service (PaaS) that lets you
deploy and scale web, mobile, and API apps. Use the Azure App Service extension
for VS Code to quickly create, manage, and deploy your websites.

**Visit the [wiki](https://github.com/Microsoft/vscode-azureappservice/wiki) for more information about Azure App Service and how to use the advanced features of the extension.**

>Sign up today for your free Azure account and receive 12 months of free popular services, $200 free credit and 25+ always free services 👉 [Start Free](https://azure.microsoft.com/free/open-source).

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

![Deploy button](resources/deploy-button.png)

> Tip: Be sure that your application is listening on the port provided by the PORT environment variable: `server.listen(process.env.PORT)`

1. Choose **Create New App**
2. Type a globally unique name for your Web App and press Enter. Valid characters for an app name are 'a-z', '0-9', and '-'
3. Choose your **Node.js version**, LTS is recommended
4. Select your current workspace if you have your app open already or browse to the directory containing your application code

Click **Yes** when prompted to update your configuration to run `npm install` on the target server.

![Update build notification](resources/update-build-notification.png)

Once the deployment starts, you're prompted to update your workspace so that subsequent deploys from this workspace automatically deploy to the same App Service web app. Choose **Yes** to ensure your changes are deployed to the correct app - you can change this later by editing your workspace settings (in `.vscode/settings.json`).

![Always deploy notification](resources/always-deploy-notification.png)

Once the deployment completes, click **Browse Website** in the prompt to view your freshly deployed website.

## Stream Your Application Logs

1. In the Azure App Service explorer, expand the app then expand **Logs**
2. Click on **Connect to Log Steam...**

![Connect to logstream](resources/connect-logstream.png)

3. Choose **Yes** when prompted to enable logging and restart the app
    > File logging is disabled by default and will automatically be disabled within 24 hours
4. The Visual Studio Code output window opens with a connection to the log stream

```
Connecting to log stream...
2019-01-06T07:36:52  Welcome, you are now connected to log-streaming service.
2019-01-06 07:37:08.038 INFO  - Starting container for site
2019-01-06 07:37:33.273 INFO  - Container mahernaexpress_0 for site mahernaexpress initialized successfully.
```

## Known Issues

* Local Git deployment may fail with large commits

<!-- region exclude-from-marketplace -->

## Contributing

There are a couple of ways you can contribute to this repo:

* **Ideas, feature requests and bugs**: We are open to all ideas and we want to get rid of bugs! Use the Issues section to either report a new issue, provide your ideas or contribute to existing threads.
* **Documentation**: Found a typo or strangely worded sentences? Submit a PR!
* **Code**: Contribute bug fixes, features or design changes:
  * Clone the repository locally and open in VS Code.
  * Install [TSLint for Visual Studio Code](https://marketplace.visualstudio.com/items?itemName=eg2.tslint).
  * Open the terminal (press <kbd>CTRL</kbd>+ <kbd>\`</kbd>) and run `npm install`.
  * To build, press <kbd>F1</kbd> and type in `Tasks: Run Build Task`.
  * Debug: press <kbd>F5</kbd> to start debugging the extension.

### Legal

Before we can accept your pull request you will need to sign a **Contribution License Agreement**. All you need to do is to submit a pull request, then the PR will get appropriately labelled (e.g. `cla-required`, `cla-norequired`, `cla-signed`, `cla-already-signed`). If you already signed the agreement we will continue with reviewing the PR, otherwise system will tell you how you can sign the CLA. Once you sign the CLA all future PR's will be labeled as `cla-signed`.

### Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

<!-- endregion exclude-from-marketplace -->

## Telemetry

VS Code collects usage data and sends it to Microsoft to help improve our products and services. Read our [privacy statement](https://go.microsoft.com/fwlink/?LinkID=528096&clcid=0x409) to learn more. If you don’t wish to send usage data to Microsoft, you can set the `telemetry.enableTelemetry` setting to `false`. Learn more in our [FAQ](https://code.visualstudio.com/docs/supporting/faq#_how-to-disable-telemetry-reporting).

## License

[MIT](LICENSE.md)
