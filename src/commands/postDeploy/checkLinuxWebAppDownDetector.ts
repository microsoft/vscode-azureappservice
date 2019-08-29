/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebResource } from "ms-rest";
import { CancellationTokenSource } from "vscode";
import { callWithTelemetryAndErrorHandling, IActionContext, openInPortal, UserCancelledError } from "vscode-azureextensionui";
import { KuduClient } from "vscode-azurekudu";
import { DeployResult } from "vscode-azurekudu/lib/models";
import { SiteTreeItem } from "../../explorer/SiteTreeItem";
import { ext } from '../../extensionVariables';
import { delay } from "../../utils/delay";
import { requestUtils } from '../../utils/requestUtils';
import { getGlobalSetting } from '../../vsCodeConfig/settings';
import { findTableByColumnName, findTableByRowValue, getValuesByColumnName } from "./parseDetectorResponse";

const detectorId: string = 'LinuxAppDown';
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
export async function checkLinuxWebAppDownDetector(correlationId: string, node: SiteTreeItem, tokenSource: CancellationTokenSource): Promise<void> {
    return await callWithTelemetryAndErrorHandling('appService.linuxWebAppDownDetector', async (context: IActionContext): Promise<void> => {
        context.errorHandling.suppressDisplay = true;
        context.telemetry.properties.correlationId = correlationId;

        const kuduClient: KuduClient = await node.root.client.getKuduClient();
        const deployment: DeployResult = await kuduClient.deployment.getResult('latest');
        if (!deployment.startTime) {
            // if there's no deployment detected, nothing can be done
            context.telemetry.properties.cancelStep = 'noDeployResult';
            return;
        }

        const deployResultTime: Date = new Date(deployment.startTime);
        const enableDetectorOutputSetting: string = 'enableDetectorOutput';
        const showOutput: boolean | undefined = getGlobalSetting<boolean>(enableDetectorOutputSetting);;

        if (showOutput) {
            const detectorOutput: string = `Diagnosing web app "${node.root.client.siteName}" for critical errors...`;
            ext.outputChannel.appendLine(detectorOutput);
        }

        const detectorUri: string = `${node.id}/detectors/${detectorId}`;
        const requestOptions: requestUtils.Request = await requestUtils.getDefaultAzureRequest(detectorUri, node.root);

        // these parameters were specified to retrieve the timestamp from the detector
        // The string 'Latest time seen by detector. To be used in VSCode integration.' is added
        // when val: 'vscode' is added
        requestOptions.qs = {
            'api-version': "2015-08-01",
            val: "vscode",
            startTime: deployResultTime.toISOString(),
            endTime: new Date().toISOString()
        };

        let detectorErrorMessage: string | undefined;
        // wait 15 minutes for a response from the detector
        const detectorTimeoutMs: number = Date.now() + 15 * 60 * 1000;
        do {
            if (tokenSource.token.isCancellationRequested) {
                // the user cancelled the check by deploying again
                context.telemetry.properties.cancelStep = 'cancellationToken';
                throw new UserCancelledError();
            }

            if (Date.now() > detectorTimeoutMs) {
                if (showOutput) {
                    const noIssuesFound: string = `Diagnosing for "${node.root.client.siteName}" has timed out.`;
                    ext.outputChannel.appendLine(noIssuesFound);
                    context.telemetry.properties.failureCount = '0';
                }
                return undefined;
            }
            // update the new end time to be now
            requestOptions.qs.endTime = new Date().toISOString();
            detectorErrorMessage = await getLinuxDetectorError(context, requestOptions, deployResultTime, node.root.client.fullName);
            // poll every minute
            await delay(1000 * 60);
        } while (!detectorErrorMessage);

        if (showOutput) {
            await ext.ui.showWarningMessage(detectorErrorMessage, { title: 'Open in Portal' });
            await openInPortal(node.root, `${node.root.client.id}/troubleshoot`, { queryPrefix: `websitesextension_ext=asd.featurePath%3Ddetectors%2F${detectorId}` });
            context.telemetry.properties.didClick = 'true';
        }
    });
}

async function getLinuxDetectorError(context: IActionContext, requestOptions: WebResource, deployResultTime: Date, siteName: string): Promise<string | undefined> {
    const detectorResponse: string = await requestUtils.sendRequest<string>(requestOptions);
    const responseJson: detectorResponseJSON = <detectorResponseJSON>JSON.parse(detectorResponse);

    const datasets: detectorDataset[] = responseJson.properties.dataset;
    const vsCodeIntegration: string = 'Latest time seen by detector. To be used in VSCode integration.';
    const timestampTable: detectorTable | undefined = findTableByRowValue(datasets, vsCodeIntegration);

    // if we can't find the timestamp, exit and try again
    if (!timestampTable) {
        return undefined;
    }

    const timestamp = new Date(getValuesByColumnName(timestampTable, ColumnName.value)[0]);
    if (validateTimestamp(timestamp, deployResultTime)) {

        const criticalErrorTable: detectorTable | undefined = findTableByRowValue(datasets, 'Critical');
        const failureCountTable: detectorTable | undefined = findTableByColumnName(datasets, ColumnName.failureCount);

        // if the criticalError table or failureCounts aren't defined, we can't display anything to the user
        if (!criticalErrorTable || !failureCountTable) {
            return undefined;
        }

        const errorMessages: string[] = getValuesByColumnName(criticalErrorTable, ColumnName.value);
        const failureCount: string = getValuesByColumnName(failureCountTable, ColumnName.failureCount)[0];

        context.telemetry.properties.errorMessages = JSON.stringify(errorMessages);
        context.telemetry.properties.failureCount = failureCount;

        return `Critical insights found for "${siteName}": ${failureCount} as of ${new Date(timestamp).toLocaleString()}. Critical insight preview: "${errorMessages[0]}". Click here to access "App Service Diagnostics" for recommendations.`;
    }

    return undefined;
}

export function validateTimestamp(detectorTime: Date, deployResultTime: Date): boolean {
    const timeBetweenDeployAndDetector: number = Math.abs(detectorTime.getSeconds() - deployResultTime.getSeconds());

    // there's usually around a 5-20 second difference between the deploy result and time reported by the detector
    if (timeBetweenDeployAndDetector <= 20) {
        return true;
    }

    return false;
}

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
