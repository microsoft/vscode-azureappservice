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

export async function getLinuxDetectorError(context: IActionContext, detectorId: string, node: SiteTreeItem, startTime: string, endTime: string, deployResultTime: Date, siteName: string): Promise<string | undefined> {
    const detectorUri: string = `${node.id}/detectors/${detectorId}`;
    const requestOptions: requestUtils.Request = await requestUtils.getDefaultAzureRequest(detectorUri, node.root);

    requestOptions.qs = {
        'api-version': "2015-08-01",
        startTime,
        endTime
    };

    const detectorResponse: string = await requestUtils.sendRequest<string>(requestOptions);
    const responseJson: detectorResponseJSON = <detectorResponseJSON>JSON.parse(detectorResponse);

    const jsonTables: detectorTable[] = responseJson.properties.dataset[0].table;
    // const tableWithJsonString: detectorTable = datasets;
    // const vsCodeIntegration: string = 'Latest time seen by detector. To be used in VSCode integration.';
    // const timestampTable: detectorTable | undefined = findTableByRowValue(datasets, 'Critical');
    let selectedRow: string[] | undefined;

    for (const row of jsonTables.rows) {
        if (row[2]) {
            selectedRow = row;
        }
    }

    // if we can't find the timestamp, exit and try again
    if (!selectedRow) {
        return undefined;
    }

    const detectorDataset: detectorDataset = JSON.parse(selectedRow[3]);
    const detectorTable: detectorTable = detectorDataset[0].table;

    // if this fails, then there was no critical error
    const timestamp: Date = new Date(detectorTable.rows[0][2].substring(4) + 'z');
    if (validateTimestamp(context, timestamp, deployResultTime)) {

        const criticalError = detectorTable.rows[0][0];
        // if there is no criticalError, exit
        if (!criticalError) {
            return undefined;
        }

        context.telemetry.properties.errorMessages = JSON.stringify(detectorTable[3]);

        return `"${node.root.client.siteName}" - ${detectorTable.rows[0][1]}: ${detectorTable.rows[0][3]}`;
    }

    return undefined;
}

export function validateTimestamp(context: IActionContext, detectorTime: Date, deployResultTime: Date): boolean {
    const secondsBetweenTimes: number = Math.abs((detectorTime.getTime() - deployResultTime.getTime()) / 1000);

    // the log timestamp is typically about 30 seconds apart
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
