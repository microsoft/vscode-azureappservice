/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IncomingMessage } from 'http';
import { RequestOptions } from 'https';
import * as requestP from 'request-promise';
import { URL } from 'url';
import { isNumber } from 'util';
import { callWithTelemetryAndErrorHandling, IActionContext } from 'vscode-azureextensionui';
import { SiteTreeItem } from './explorer/SiteTreeItem';

const requestPromise = <(options: RequestOptions | string | URL) => Promise<IncomingMessage>><Function>requestP;

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

interface ICancellation {
    canceled: boolean;
}
const cancellations = new Map<string, ICancellation>();

export function cancelWebsiteValidation(siteTreeItem: SiteTreeItem): void {
    const cancellation = cancellations.get(siteTreeItem.fullId);
    if (cancellation) {
        cancellations.delete(siteTreeItem.fullId);
        cancellation.canceled = true;
    }
}

export async function validateWebSite(deploymentCorrelationId: string, siteTreeItem: SiteTreeItem): Promise<void> {
    cancelWebsiteValidation(siteTreeItem);
    const id = siteTreeItem.fullId;
    const cancellation: ICancellation = { canceled: false };
    cancellations.set(id, cancellation);

    return callWithTelemetryAndErrorHandling('appService.validateWebSite', async function (this: IActionContext): Promise<void> {
        this.rethrowError = false;
        this.suppressErrorDisplay = true;

        const properties = <IValidateProperties>this.properties;
        properties.correlationId = deploymentCorrelationId;

        let pollingIntervalMs = initialPollingIntervalMs;
        const start = Date.now();
        const uri = siteTreeItem.root.client.defaultHostUrl;
        const options: {} = {
            method: 'GET',
            uri: uri,
            resolveWithFullResponse: true
        };
        let currentStatusCode: number | undefined = 0;
        const statusCodes: { code: number | undefined, elapsed: number }[] = [];

        // tslint:disable-next-line:no-constant-condition
        while (true) {
            try {
                const response = <IncomingMessage>(await requestPromise(options));
                currentStatusCode = response.statusCode;
            } catch (error) {
                // tslint:disable-next-line:strict-boolean-expressions
                const response = (<WebError>error).response || {};
                currentStatusCode = isNumber(response.statusCode) ? response.statusCode : 0;
            }

            if (cancellation.canceled) {
                properties.canceled = 'true';
                break;
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

        if (cancellations.get(id) === cancellation) {
            cancellations.delete(id);
        }
    });
}

export async function delay(delayMs: number): Promise<void> {
    await new Promise<void>((resolve: () => void): void => { setTimeout(resolve, delayMs); });
}
