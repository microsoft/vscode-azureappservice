/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RequestOptions } from "http";
import { IncomingMessage, ServiceClientCredentials, WebResource } from "ms-rest";
import * as requestP from 'request-promise';
import { URL } from "url";
import { CancellationTokenSource } from "vscode";
import { callWithTelemetryAndErrorHandling, IActionContext, UserCancelledError } from "vscode-azureextensionui";
import { DeployResult } from "vscode-azurekudu/lib/models";
import { SiteTreeItem } from "./explorer/SiteTreeItem";
import { ext } from './extensionVariables';
import { delay } from "./utils/delay";
import { openUrl } from './utils/openUrl';
import { findTableByColumnName, findTableByRowValue, getValuesByColumnName } from "./utils/tableUtil";

const detectorId: string = 'LinuxContainerStartFailure';
export enum ColumnName {
    status = "Status",
    message = "Message",
    name = "Data.Name",
    value = "Data.Value",
    expanded = "Expanded",
    solutions = "Solutions",
    time = "Time",
    instance = "Instance",
    facility = "Facility",
    failureCount = "FailureCount"
}

export const detectorCancelTokens: Map<string, CancellationTokenSource> = new Map();
export async function checkLinuxWebAppDownDetector(node: SiteTreeItem, tokenSource: CancellationTokenSource): Promise<void> {
    return await callWithTelemetryAndErrorHandling('appService.linuxWebAppDownDetector', async (context: IActionContext): Promise<void> => {
        const deployment: DeployResult = await node.root.client.kudu.deployment.getResult('latest');
        if (!deployment.startTime) {
            // if there's no deployment detected, nothing can be done
            context.telemetry.properties.cancelStep = 'noDeployResult';
            return;
        }

        const deployResultTime: Date = new Date(deployment.startTime);

        const detectorOutput: string = `Diagnosing web app "${node.root.client.siteName}" for critical errors...`;
        ext.outputChannel.appendLine(detectorOutput);

        const detectorUri: string = `${node.root.environment.resourceManagerEndpointUrl}${node.id}/detectors/${detectorId}`;
        const requestOptions: WebResource & Partial<{ qs: queryString }> = new WebResource();

        requestOptions.method = 'GET';
        requestOptions.url = detectorUri;
        requestOptions.qs = {
            'api-version': "2015-08-01",
            fId: "1",
            btnId: "2",
            inpId: "1",
            val: "vscode",
            startTime: deployResultTime.toISOString(),
            endTime: new Date().toISOString()
        };
        await signRequest(requestOptions, node.root.credentials);

        let detectorErrorMessage: string | undefined;
        // wait 10 minutes for a response from the detector
        const detectorTimeoutMs: number = Date.now() + 20 * 60 * 1000;
        do {
            if (tokenSource.token.isCancellationRequested) {
                // the user cancelled the check by deploying again
                throw new UserCancelledError();
            }

            if (Date.now() > detectorTimeoutMs) {
                const noIssuesFound: string = `No critical issues found for web app "${node.root.client.siteName}".`;
                ext.outputChannel.appendLine(noIssuesFound);
                return undefined;
            }
            // update the new end time to be now
            requestOptions.qs.endTime = new Date().toISOString();
            detectorErrorMessage = await getLinuxDetectorError(requestOptions, deployResultTime, node.root.client.fullName);
            // poll every minute
            await delay(1000 * 60);
        } while (!detectorErrorMessage);

        await ext.ui.showWarningMessage(detectorErrorMessage, { title: 'Open in Portal' });
        const portalDeeplink = `${node.root.environment.portalUrl}/?websitesextension_ext=asd.featurePath%3Ddetectors%2F${detectorId}#@microsoft.onmicrosoft.com/resource/${node.root.client.id}/troubleshoot`;
        await openUrl(portalDeeplink);
        context.telemetry.properties.didClick = 'true';
    });
}

async function signRequest(req: WebResource, cred: ServiceClientCredentials): Promise<void> {
    await new Promise((resolve: () => void, reject: (err: Error) => void): void => {
        cred.signRequest(req, (err: Error | undefined) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

async function getLinuxDetectorError(requestOptions: WebResource, deployResultTime: Date, siteName: string): Promise<string | undefined> {
    const requestPromise = <(options: RequestOptions | string | URL) => Promise<IncomingMessage>><Function>requestP;
    const detectorResponse: string = <string><unknown>(await requestPromise(requestOptions));
    const responseJson: detectorResponseJSON = <detectorResponseJSON>JSON.parse(detectorResponse);

    const datasets: detectorDataset[] = responseJson.properties.dataset;
    const vsCodeIntegration: string = 'Latest time seen by detector. To be used in VSCode integration.';
    const timestampTable: detectorTable | undefined = findTableByRowValue(datasets, vsCodeIntegration);
    if (!timestampTable) {
        // if we can't find the timestamp, exit and try again
        return undefined;
    }

    const timestamp = new Date(getValuesByColumnName(timestampTable, ColumnName.value)[0]);
    if (validateTimestamp(timestamp, deployResultTime)) {

        const criticalErrorTable: detectorTable | undefined = findTableByRowValue(datasets, 'Critical');
        const failureCountTable: detectorTable | undefined = findTableByColumnName(datasets, ColumnName.failureCount);
        if (!criticalErrorTable || !failureCountTable) {
            return undefined;
        }

        const errorMessages: string[] = getValuesByColumnName(criticalErrorTable, ColumnName.value);
        const failureCount: string = getValuesByColumnName(failureCountTable, ColumnName.failureCount)[0];

        return `Critical insights found for "${siteName}": ${failureCount} as of ${new Date(timestamp).toLocaleString()}. Critical insight preview: "${errorMessages[0]}". Click here to access "App Service Diagnostics" for recommendations.`;
    }

    return undefined;
}

export function validateTimestamp(detectorTime: Date, deployResultTime: Date): boolean {
    const timeBetweenDeployAndDetector: number = Math.abs(detectorTime.getSeconds() - deployResultTime.getSeconds());

    // there's usually around a 5-20 second difference between the deploy result and time reported by the detector
    if (timeBetweenDeployAndDetector <= 60) {
        return true;
    }

    return false;
}

type queryString = {
    'api-version': string,
    fId: string,
    btnId: string,
    inpId: string,
    val: string,
    startTime: string,
    endTime: string
};

export type detectorResponseJSON = {
    properties: {
        dataset: detectorDataset[]
    }
};

export type detectorDataset = {
    table: detectorTable
};

export type detectorTable = {
    columns: detectorColumn[],
    rows: string[]
};

type detectorColumn = {
    columnName: ColumnName,
    dataType: string,
    columnType: string
};
