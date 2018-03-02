/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IncomingMessage } from 'http';
import { RequestOptions } from 'https';
import * as requestP from 'request-promise';
import { URL } from 'url';
import { isNumber } from 'util';
import { OutputChannel } from 'vscode';
import { callWithTelemetryAndErrorHandling, IActionContext } from 'vscode-azureextensionui';
import TelemetryReporter from "vscode-extension-telemetry";
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
}

const initialPollingIntervalMs = 5000;
const pollingIncrementMs = 0; // Increase in interval each time
const maximumValidationMs = 60 * 1000; //

export async function validateWebSite(siteTreeItem: SiteTreeItem, outputChannel: OutputChannel, telemetryReporter: TelemetryReporter): Promise<void> {
    return callWithTelemetryAndErrorHandling('appService.validateWebSite', telemetryReporter, outputChannel, async function (this: IActionContext): Promise<void> {
        this.rethrowError = false;
        this.suppressErrorDisplay = true;

        const properties = <IValidateProperties>this.properties;

        let pollingIntervalMs = initialPollingIntervalMs;
        const start = Date.now();
        const uri = siteTreeItem.defaultHostUri;
        const options: {} = {
            method: 'GET',
            uri: uri,
            resolveWithFullResponse: true
        };
        let currentStatusCode: number = 0;
        const statusCodes: { code: number, elapsed: number, reported?: boolean }[] = [];

        // tslint:disable-next-line:no-constant-condition
        while (true) {
            try {
                const response = <IncomingMessage>(await requestPromise(options));
                currentStatusCode = response.statusCode;
            } catch (error) {
                const response = (<WebError>error).response || {};
                currentStatusCode = isNumber(response.statusCode) ? response.statusCode : 0;
            }

            const elapsedSeconds = Math.round((Date.now() - start) / 1000);
            statusCodes.push({ code: currentStatusCode, elapsed: elapsedSeconds });

            if (Date.now() > start + maximumValidationMs) {
                break;
            }

            // tslint:disable-next-line:no-string-based-set-timeout // false positive
            await delay(pollingIntervalMs);
            pollingIntervalMs += pollingIncrementMs;
        }

        properties.statusCodes = JSON.stringify(statusCodes);
    });
}

function delay(delayMs: number): Promise<void> {
    return new Promise<void>((resolve, _reject): void => { setTimeout(resolve, delayMs); });
}
