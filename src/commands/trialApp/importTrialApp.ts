/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as querystring from 'querystring';
import { commands, Disposable, ProgressLocation, Uri, UriHandler, window } from 'vscode';
import { callWithTelemetryAndErrorHandling, IActionContext } from 'vscode-azureextensionui';
import { TrialAppLoginSession } from '../../constants';
import { ext } from '../../extensionVariables';
import { localize } from '../../localize';

export async function importTrialApp(_context: IActionContext, loginSession: string): Promise<void> {

    window.withProgress({ location: ProgressLocation.Notification, cancellable: false }, async p => {
        p.report({ message: localize('importingTrialApp', 'Importing trial app...') });

        await commands.executeCommand('workbench.view.extension.azure');
        ext.context.globalState.update(TrialAppLoginSession, loginSession);
        await ext.azureAccountTreeItem.refresh();
    });
}

export class ImportUriHandler implements UriHandler {
    private disposables: Disposable[] = [];

    constructor() {
        this.disposables.push(window.registerUriHandler(this));
    }

    public async handleUri(uri: Uri): Promise<void> {
        switch (uri.path) {
            case '/ImportTrialApp': await this.importTrialApp(uri);
            default:
        }
    }

    public dispose(): void {
        this.disposables = dispose(this.disposables);
    }

    private async importTrialApp(uri: Uri): Promise<void> {
        const data = querystring.parse(uri.query);

        if (!data.url) {
            await ext.ui.showWarningMessage(`Failed to import URI: ${uri}`);
        }

        await callWithTelemetryAndErrorHandling<void>('importTrialApp', async (context: IActionContext): Promise<void> => {
            if (typeof data.loginSession === 'string') {
                await importTrialApp(context, data.loginSession);
            }
        });
    }
}

interface IDisposable {
    dispose(): void;
}

function dispose<T extends IDisposable>(disposables: T[]): T[] {
    disposables.forEach(d => d.dispose());
    return [];
}
