/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IncomingMessage } from 'http';
import { isNumber } from 'util';
import { CancellationTokenSource } from 'vscode';
import { callWithTelemetryAndErrorHandling, IActionContext, UserCancelledError } from 'vscode-azureextensionui';
import { SiteTreeItem } from '../../explorer/SiteTreeItem';
import { delay } from '../../utils/delay';
import { requestUtils } from '../../utils/requestUtils';

type WebError = {
    response?: {
        statusCode?: number;
        statusMessage?: string;
    }
};

interface IValidateProperties {
    statusCodes?: string; // [[code,elapsedSeconds], [code,elapsedSeconds]...]
    canceled?: 'true' | 'false';
    correlationId?: string;
}

const initialPollingIntervalMs = 5000;
const pollingIncrementMs = 0; // Increase in interval each time
const maximumValidationMs = 60 * 1000;

export async function validateWebSite(deploymentCorrelationId: string, siteTreeItem: SiteTreeItem, tokenSource: CancellationTokenSource): Promise<number | void> {
    return callWithTelemetryAndErrorHandling('appService.validateWebSite', async (context: IActionContext) => {
        context.errorHandling.rethrow = false;
        context.errorHandling.suppressDisplay = true;

        const properties = <IValidateProperties>context.telemetry.properties;
        properties.correlationId = deploymentCorrelationId;

        let pollingIntervalMs = initialPollingIntervalMs;
        const start = Date.now();
        const uri = siteTreeItem.root.client.defaultHostUrl;
        let currentStatusCode: number | undefined = 0;
        const statusCodes: { code: number | undefined, elapsed: number }[] = [];

        // tslint:disable-next-line:no-constant-condition
        while (true) {
            if (tokenSource.token.isCancellationRequested) {
                // the user cancelled the check by deploying again
                context.telemetry.properties.canceled = 'true';
                throw new UserCancelledError();
            }

            try {
                const request: requestUtils.Request = await requestUtils.getDefaultRequest(uri);
                request.resolveWithFullResponse = true;
                const response = await requestUtils.sendRequest<IncomingMessage>(request);
                currentStatusCode = response.statusCode;
            } catch (error) {
                // tslint:disable-next-line:strict-boolean-expressions
                const response = (<WebError>error).response || {};
                currentStatusCode = isNumber(response.statusCode) ? response.statusCode : 0;
            }

            const elapsedSeconds = Math.round((Date.now() - start) / 1000);
            statusCodes.push({ code: currentStatusCode, elapsed: elapsedSeconds });

            if (Date.now() > start + maximumValidationMs) {
                break;
            }

            await delay(pollingIntervalMs);
            pollingIntervalMs += pollingIncrementMs;
        }

        properties.statusCodes = JSON.stringify(statusCodes);
    });
}
