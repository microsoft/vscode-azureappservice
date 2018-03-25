/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteConfigResource, User } from 'azure-arm-website/lib/models';
import * as opn from 'opn';
import * as portfinder from 'portfinder';
import * as vscode from 'vscode';
import { SiteClient, TunnelProxy } from 'vscode-azureappservice';
import { DialogResponses, IAzureUserInput } from 'vscode-azureextensionui';

export class RemoteDebugCommands {
    private _siteClient: SiteClient;
    private _ui: IAzureUserInput;
    private _outputChannel: vscode.OutputChannel;
    private _progress: vscode.Progress<{}>;
    private _siteConfig: SiteConfigResource;

    constructor(siteClient: SiteClient, ui: IAzureUserInput, outputChannel: vscode.OutputChannel) {
        this._siteClient = siteClient;
        this._ui = ui;
        this._outputChannel = outputChannel;
    }

    public async startRemoteDebug(): Promise<void> {
        await this.checkForRemoteDebugSupport();

        let tunnelProxy: TunnelProxy;

        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async (p: vscode.Progress<{}>): Promise<void> => {
            this._progress = p;

            this.reportMessage('Detecting app configuration...');

            const debugConfig: vscode.DebugConfiguration = await this.getDebugConfiguration();
            const portNumber: number = debugConfig.port;

            this.reportMessage('Checking app settings...');

            const confirmEnableMessage: string = 'The app configuration will be updated to enable remote debugging and restarted. Would you like to continue?';
            await this.setRemoteDebug(true, confirmEnableMessage);

            this.reportMessage('Starting tunnel proxy...');

            const publishCredential: User = await this._siteClient.getWebAppPublishCredential();
            tunnelProxy = new TunnelProxy(portNumber, this._siteClient, publishCredential, this._outputChannel);
            await tunnelProxy.startProxy();

            this.reportMessage('Starting debugging...');

            // Enable tracing for debug configuration
            debugConfig.trace = 'verbose';
            await vscode.debug.startDebugging(undefined, debugConfig);

            const terminateDebugListener: vscode.Disposable = vscode.debug.onDidTerminateDebugSession(async (event: vscode.DebugSession) => {
                if (event.name === debugConfig.name) {
                    if (tunnelProxy !== undefined) {
                        tunnelProxy.dispose();
                    }
                    terminateDebugListener.dispose();

                    const confirmDisableMessage: string = 'Leaving the app in debugging mode may cause performance issues. Would you like to disable debugging for this app? The app will be restarted.';
                    await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async (p: vscode.Progress<{}>): Promise<void> => {
                        this._progress = p;
                        await this.setRemoteDebug(false, confirmDisableMessage);
                    });
                }
            });
        });
    }

    public async enableRemoteDebug(): Promise<void> {
        await this.checkForRemoteDebugSupport();

        const confirmMessage: string = 'The app configuration will be updated to enable remote debugging and restarted. Would you like to continue?';
        const noopMessage: string = 'The app is already configured for debugging.';

        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async (p: vscode.Progress<{}>): Promise<void> => {
            this._progress = p;
            await this.setRemoteDebug(true, confirmMessage, noopMessage);
        });
    }

    public async disableRemoteDebug(): Promise<void> {
        await this.checkForRemoteDebugSupport();

        const confirmMessage: string = 'The app configuration will be updated to disable remote debugging and restarted. Would you like to continue?';
        const noopMessage: string = 'The app is not configured for debugging.';

        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async (p: vscode.Progress<{}>): Promise<void> => {
            this._progress = p;
            await this.setRemoteDebug(false, confirmMessage, noopMessage);
        });
    }

    private reportMessage(msg: string): void {
        this._outputChannel.appendLine(msg);

        if (this._progress) {
            this._progress.report({ message: msg });
        }
    }

    private async getSiteConfig(): Promise<SiteConfigResource> {
        if (!this._siteConfig) {
            this.reportMessage('Fetching site configuration...');
            this._siteConfig = await this._siteClient.getSiteConfig();
        }

        return this._siteConfig;
    }

    private async needUpdateSiteConfig(isRemoteDebuggingToBeEnabled: boolean): Promise<boolean> {
        const siteConfig: SiteConfigResource = await this.getSiteConfig();
        return isRemoteDebuggingToBeEnabled !== siteConfig.remoteDebuggingEnabled;
    }

    private async updateSiteConfig(isRemoteDebuggingToBeEnabled: boolean): Promise<void> {
        const siteConfig: SiteConfigResource = await this.getSiteConfig();

        siteConfig.remoteDebuggingEnabled = isRemoteDebuggingToBeEnabled;
        this._siteConfig = siteConfig;

        this.reportMessage('Updating site configuration to set remote debugging...');
        await this._siteClient.updateConfiguration(siteConfig);
        this.reportMessage('Updating site configuration done...');
    }

    private async checkForRemoteDebugSupport(): Promise<void> {
        const siteConfig: SiteConfigResource = await this.getSiteConfig();

        // So far only node on linux is supported
        if (!siteConfig.linuxFxVersion.toLowerCase().startsWith('node')) {
            throw new Error('Azure Remote Debugging is not supported for this instance type');
        }
    }

    private async getDebugConfiguration(): Promise<vscode.DebugConfiguration> {
        const sessionId: string = Date.now().toString();
        const portNumber: number = await portfinder.getPortPromise();

        // So far only node is supported
        return {
            name: sessionId,
            type: 'node',
            protocol: 'inspector',
            request: 'attach',
            address: 'localhost',
            port: portNumber,
            localRoot: vscode.workspace.rootPath,
            remoteRoot: '/home/site/wwwroot'
        };
    }

    private async setRemoteDebug(isRemoteDebuggingToBeEnabled: boolean, confirmMessage: string, noopMessage?: string): Promise<void> {
        if (await this.needUpdateSiteConfig(isRemoteDebuggingToBeEnabled)) {
            const result: vscode.MessageItem = await this._ui.showWarningMessage(confirmMessage, DialogResponses.yes, DialogResponses.learnMore, DialogResponses.cancel);
            if (result === DialogResponses.yes) {
                await this.updateSiteConfig(isRemoteDebuggingToBeEnabled);
            } else if (result === DialogResponses.learnMore) {
                opn('https://aka.ms/appsvc-remotedebug');
            } else {
                // User canceled
                return;
            }
        } else {
            // Update not needed
            if (noopMessage) {
                vscode.window.showWarningMessage(noopMessage);
            }
        }
    }
}
