/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as querystring from 'querystring';
import { Uri, UriHandler } from 'vscode';
import { callWithTelemetryAndErrorHandling, IActionContext } from '../../extension.bundle';
import { localize } from '../localize';
import { importTrialApp } from './trialApp/importTrialApp';

export class ImportTrialAppUriHandler implements UriHandler {

    // only activates when the uri has our extension id in it. See docs here: https://code.visualstudio.com/api/references/activation-events#onUri
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
