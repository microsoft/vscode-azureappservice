/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext } from "vscode-azureextensionui";
import { SiteTreeItem } from "../../explorer/SiteTreeItem";
import { requestUtils } from "../../utils/requestUtils";
import { findTableByColumnName, findTableByRowValue, getValuesByColumnName } from "./parseDetectorResponse";

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

export async function getLinuxDetectorError(context: IActionContext, detectorId: string, node: SiteTreeItem, deployResultTime: Date, siteName: string): Promise<string | undefined> {
    const detectorUri: string = `${node.id}/detectors/${detectorId}`;
    const requestOptions: requestUtils.Request = await requestUtils.getDefaultAzureRequest(detectorUri, node.root);
    const currentTime: Date = new Date();

    // these parameters were specified to retrieve the timestamp from the detector by Detectors team
    // string "Latest time seen by detector. To be used in VSCode integration."" is added to response
    // when val: 'vscode' is added
    // https://github.com/microsoft/vscode-azureappservice/issues/1235

    requestOptions.qs = {
        'api-version': "2015-08-01",
        fId: "1",
        btnId: "2",
        val: "vscode",
        inpId: "1",
        startTime: new Date(currentTime.valueOf() - 1000),
        endTime: currentTime
    };

    const detectorResponse: string = await requestUtils.sendRequest<string>(requestOptions);
    const responseJson: detectorResponseJSON = <detectorResponseJSON>JSON.parse(detectorResponse);

    const datasets: detectorDataset[] = responseJson.properties.dataset;
    const vsCodeIntegration: string = 'Latest time seen by detector. To be used in VSCode integration.';
    const timestampTable: detectorTable | undefined = findTableByRowValue(datasets, vsCodeIntegration);

    // if we can't find the timestamp, exit and try again
    if (!timestampTable) {
        return undefined;
    }

    const timestamp: Date = new Date(getValuesByColumnName(context, timestampTable, ColumnName.value));
    if (validateTimestamp(context, timestamp, deployResultTime)) {

        const criticalErrorTable: detectorTable | undefined = findTableByRowValue(datasets, 'Critical');
        const failureCountTable: detectorTable | undefined = findTableByColumnName(datasets, ColumnName.failureCount);

        // if the criticalError table or failureCounts aren't defined, we can't display anything to the user
        if (!criticalErrorTable || !failureCountTable) {
            return undefined;
        }

        const errorMessages: string | undefined = getValuesByColumnName(context, criticalErrorTable, ColumnName.message);
        const failureCount: string | undefined = getValuesByColumnName(context, failureCountTable, ColumnName.failureCount);

        context.telemetry.properties.errorMessages = JSON.stringify(errorMessages);
        context.telemetry.properties.failureCount = failureCount;

        return `Critical insights found for "${siteName}": ${failureCount} as of ${new Date(timestamp).toLocaleString()}. Critical insight preview: "${errorMessages}". Click here to access "App Service Diagnostics" for recommendations.`;
    }

    return undefined;
}

export function validateTimestamp(context: IActionContext, detectorTime: Date, deployResultTime: Date): boolean {
    const secondsBetweenTimes: number = Math.abs((detectorTime.getTime() - deployResultTime.getTime()) / 1000);

    // we don't know how long it takes for the deployResult startTime and the detector timestamp
    context.telemetry.properties.timeBetweenDeployAndDetector = secondsBetweenTimes.toString();
    if (secondsBetweenTimes <= 60) {
        return true;
    }

    context.telemetry.properties.invalidTimestamp = 'true';
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
