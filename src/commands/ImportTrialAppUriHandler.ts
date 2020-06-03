import * as querystring from 'querystring';
import { Uri, UriHandler } from 'vscode';
import { callWithTelemetryAndErrorHandling, IActionContext } from '../../extension.bundle';
import { localize } from '../localize';
import { importTrialApp } from './trialApp/importTrialApp';

export class ImportTrialAppUriHandler implements UriHandler {

    public async handleUri(uri: Uri): Promise<void> {
        if (uri.path === './ImportTrialApp') {
            await this.importTrialApp(uri);
        }
    }

    private async importTrialApp(uri: Uri): Promise<void> {
        const data = querystring.parse(uri.query);

        if (!data.url) {
            throw Error(`${localize('failedToImportUri', 'Failed to import Uri')}: ${uri}`);
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
