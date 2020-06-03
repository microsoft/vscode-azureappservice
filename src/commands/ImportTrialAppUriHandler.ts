import * as querystring from 'querystring';
import { Uri, UriHandler } from 'vscode';
import { callWithTelemetryAndErrorHandling, IActionContext } from '../../extension.bundle';
import { localize } from '../localize';
import { importTrialApp } from './trialApp/importTrialApp';

export class ImportTrialAppUriHandler implements UriHandler {

    public async handleUri(uri: Uri): Promise<void> {
        if (uri.path === '/ImportTrialApp') {
            const data = querystring.parse(uri.query);

            await callWithTelemetryAndErrorHandling<void>('importTrialApp', async (context: IActionContext): Promise<void> => {
                if (typeof data.loginSession === 'string') {
                    await importTrialApp(context, data.loginSession);
                } else {
                    throw Error(localize('invalidImportUri', 'Could not import trial app. Invalid Uri.'));
                }
            });
        }
    }
}
