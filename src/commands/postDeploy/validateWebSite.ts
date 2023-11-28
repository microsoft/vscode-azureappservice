/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type ServiceClient } from '@azure/core-client';
import { RestError, createPipelineRequest } from '@azure/core-rest-pipeline';
import { createGenericClient, type AzExtPipelineResponse } from '@microsoft/vscode-azext-azureutils';
import { UserCancelledError, callWithTelemetryAndErrorHandling, type IActionContext } from '@microsoft/vscode-azext-utils';
import { type CancellationTokenSource } from 'vscode';
import { type SiteTreeItem } from '../../tree/SiteTreeItem';
import { delay } from '../../utils/delay';

interface IValidateProperties {
    statusCodes?: string; // [[code,elapsedSeconds], [code,elapsedSeconds]...]
    canceled?: 'true' | 'false';
    correlationId?: string;
}

const initialPollingIntervalMs = 5000;
const pollingIncrementMs = 0; // Increase in interval each time
const maximumValidationMs = 60 * 1000;

export async function validateWebSite(originalContext: IActionContext, deploymentCorrelationId: string, siteTreeItem: SiteTreeItem, tokenSource: CancellationTokenSource): Promise<number | void> {
    return callWithTelemetryAndErrorHandling('appService.validateWebSite', async (context: IActionContext) => {
        context.errorHandling.rethrow = false;
        context.errorHandling.suppressDisplay = true;
        context.valuesToMask.push(...originalContext.valuesToMask);

        const properties = <IValidateProperties>context.telemetry.properties;
        properties.correlationId = deploymentCorrelationId;

        let pollingIntervalMs = initialPollingIntervalMs;
        const start = Date.now();
        const url = siteTreeItem.site.defaultHostUrl;
        let currentStatusCode: number | undefined = 0;
        const statusCodes: { code: number | undefined, elapsed: number }[] = [];

        const client: ServiceClient = await createGenericClient(context, undefined);

        // eslint-disable-next-line no-constant-condition
        while (true) {
            if (tokenSource.token.isCancellationRequested) {
                // the user cancelled the check by deploying again
                throw new UserCancelledError('userDeployedAgain');
            }

            try {
                const response: AzExtPipelineResponse = await client.sendRequest(createPipelineRequest({ method: 'GET', url }));
                currentStatusCode = response.status;
            } catch (error) {
                currentStatusCode = error instanceof RestError ? error.statusCode : 0;
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
