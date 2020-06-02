import * as querystring from 'querystring';
import { Disposable, Uri, UriHandler, window } from 'vscode';
import { ext } from 'vscode-azureappservice/out/src/extensionVariables';
import { callWithTelemetryAndErrorHandling, IActionContext } from '../../extension.bundle';
import { localize } from '../localize';
import { importTrialApp } from './trialApp/importTrialApp';

export class ImportTrialAppUriHandler implements UriHandler {
    private disposables: Disposable[] = [];

    constructor() {
        this.disposables.push(window.registerUriHandler(this));
    }

    public async handleUri(uri: Uri): Promise<void> {
        if (uri.path === './ImportTrialApp') {
            await this.importTrialApp(uri);
        }
    }

    public dispose(): void {
        Disposable.from(...this.disposables).dispose();
    }

    private async importTrialApp(uri: Uri): Promise<void> {
        const data = querystring.parse(uri.query);

        if (!data.url) {
            await ext.ui.showWarningMessage(`Failed to import URI: ${uri}`);
            return;
        }

        await callWithTelemetryAndErrorHandling<void>('importTrialApp', async (context: IActionContext): Promise<void> => {
            if (typeof data.loginSession === 'string') {
                await importTrialApp(context, data.loginSession);
            } else {
                throw Error(localize('invalidImportUri', 'Could not import trial app. Invalid Uri.'));
            }
        });
    }
}
