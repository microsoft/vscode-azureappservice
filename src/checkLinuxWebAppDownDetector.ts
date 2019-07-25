/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RequestOptions } from "http";
import { IncomingMessage, ServiceClientCredentials, WebResource } from "ms-rest";
import * as requestP from 'request-promise';
import { URL } from "url";
import { callWithTelemetryAndErrorHandling, IActionContext } from "vscode-azureextensionui";
import { DeployResult } from "vscode-azurekudu/lib/models";
import { SiteTreeItem } from "./explorer/SiteTreeItem";
import { ext } from './extensionVariables';
import { delay } from "./utils/delay";
import { openUrl } from './utils/openUrl';

const detectorId: string = 'LinuxContainerStartFailure';
enum ColumnName {
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

export async function checkLinuxWebAppDownDetector(node: SiteTreeItem | undefined): Promise<void> {
    return await callWithTelemetryAndErrorHandling('appService.linuxWebAppDownDetector', async (context: IActionContext): Promise<void> => {
        // if this is not a Linux web app, then exit
        if (!node || !(await node.root.client.getSiteConfig()).linuxFxVersion) {
            context.telemetry.properties.cancelStep = 'notLinuxApp';
            return;
        }

        const deployment: DeployResult = await node.root.client.kudu.deployment.getResult('latest');
        if (!deployment.startTime) {
            // if there's no deployment detected, nothing can be done
            context.telemetry.properties.cancelStep = 'noDeployResult';
            return;
        }

        const deployResultTime: Date = new Date(deployment.startTime);

        const detectorOutput: string = `Diagnosing the app "${node.root.client.siteName}" for critical errors...`;
        ext.outputChannel.appendLine(detectorOutput);

        const detectorUri: string = `https://management.azure.com/subscriptions/${node.root.subscriptionId}/resourceGroups/${node.root.client.resourceGroup}/providers/Microsoft.Web/sites/${node.root.client.siteName}/detectors/${detectorId}`;
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
        const detectorTimeoutMs: number = Date.now() + 10 * 60 * 1000;
        do {
            if (Date.now() > detectorTimeoutMs) {
                return undefined;
            }
            // update the new end time to be now
            requestOptions.qs.endTime = new Date().toISOString();
            detectorErrorMessage = await getLinuxDetectorError(requestOptions, deployResultTime, node.root.client.fullName);
            // poll every minute
            await delay(1000 * 60);
        } while (!detectorErrorMessage);

        await ext.ui.showWarningMessage(detectorErrorMessage, { title: 'Open in Portal' });
        const portalDeeplink = `https://portal.azure.com/?websitesextension_ext=asd.featurePath%3Ddetectors%2F${detectorId}#@microsoft.onmicrosoft.com/resource/${node.root.client.id}/troubleshoot`;
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

// the dataset contains several tables all with the same tableName and columnNames so to find the proper table, look for a specific value
function findTableByRowValue(datasets: detectorDataset[], searchValue: string): detectorTable | undefined {
    for (const dataset of datasets) {
        for (const row of dataset.table.rows) {
            for (const value of row) {
                if (value === searchValue) {
                    return dataset.table;
                }
            }
        }
    }

    return undefined;
}

function findTableByColumnName(datasets: detectorDataset[], columnName: ColumnName): detectorTable | undefined {
    for (const dataset of datasets) {
        for (const col of dataset.table.columns) {
            if (col.columnName === columnName) {
                return dataset.table;
            }
        }
    }

    return undefined;
}

function getValuesByColumnName(table: detectorTable, columnName: ColumnName): string[] {
    // -1 indicates that findIndex returned nothing
    let rowIndex: number = -1;
    const values: string[] = [];

    for (let i = 0; i < table.columns.length; i++) {
        if (table.columns[i].columnName === columnName) {
            rowIndex = i;
            break;
        }
    }

    if (rowIndex > 0) {
        for (const row of table.rows) {
            values.push(row[rowIndex]);
        }
    }

    return values;
}

function validateTimestamp(detectorTime: Date, deployResultTime: Date): boolean {
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

type detectorResponseJSON = {
    properties: {
        dataset: detectorDataset[]
    }
};

type detectorDataset = {
    table: detectorTable
};

type detectorTable = {
    columns: detectorColumn[],
    rows: string[]
};

type detectorColumn = {
    columnName: ColumnName,
    dataType: string,
    columnType: string
};
