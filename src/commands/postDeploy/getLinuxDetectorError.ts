/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ServiceClient } from '@azure/ms-rest-js';
import * as moment from 'moment';
import { createGenericClient, IActionContext } from "vscode-azureextensionui";
import { detectorTimestampFormat } from "../../constants";
import { localize } from "../../localize";
import { SiteTreeItem } from "../../tree/SiteTreeItem";
import { findTableByName, getValuesByColumnName } from "./parseDetectorResponse";

export enum ColumnName {
    status = "Status",
    message = "Message",
    name = "Name",
    value = "Value",
    expanded = "Expanded",
    solutions = "Solutions",
    time = "Time",
    instance = "Instance",
    facility = "Facility",
    failureCount = "FailureCount",
    dataValue = 'Data.Value',
    dataName = 'Data.Name'
}
export async function getLinuxDetectorError(context: IActionContext, detectorId: string, node: SiteTreeItem, startTime: string, endTime: string, deployEndTime: string): Promise<string | undefined> {
    const detectorUri: string = `${node.id}/detectors/${detectorId}`;
    const client: ServiceClient = await createGenericClient(context, node.subscription);

    const queryParameters: { [key: string]: string } = {
        'api-version': "2015-08-01",
        startTime,
        endTime,
        // query param to return plain text rather than html
        logFormat: 'plain'
    };

    const responseJson: detectorResponseJSON = <detectorResponseJSON>(await client.sendRequest({ method: 'GET', url: detectorUri, queryParameters })).parsedBody;
    if (!responseJson.properties) {
        return undefined;
    }

    const insightLogTable: detectorTable | undefined = findTableByName(responseJson.properties.dataset, 'insight/logs');

    if (!insightLogTable) {
        return undefined;
    }

    const rawApplicationLog: string = getValuesByColumnName(context, insightLogTable, ColumnName.value);
    const insightDataset: detectorDataset[] = <detectorDataset[]>JSON.parse(rawApplicationLog);

    let insightTable: detectorTable;
    let detectorTimestamp: string;

    const appInsightTable: detectorTable | undefined = findTableByName(insightDataset, 'application/insight');
    if (appInsightTable) {
        insightTable = appInsightTable;
        context.telemetry.properties.insight = 'app';
        detectorTimestamp = getValuesByColumnName(context, appInsightTable, ColumnName.dataName);
    } else {
        // if there are no app insights, defer to the Docker container
        const dockerInsightTable: detectorTable | undefined = findTableByName(insightDataset, 'docker/insight');
        if (!dockerInsightTable) {
            return undefined;
        }

        insightTable = dockerInsightTable;
        context.telemetry.properties.insight = 'docker';
        detectorTimestamp = getValuesByColumnName(context, dockerInsightTable, ColumnName.dataName);
    }

    // The format of the timestamp in the insight response is [1] 2020-04-21T18:23:50
    // The bracket are prefixed because internally the table is a Dictionary<string,object> so if the key is non-unique, it will throw an error
    const bracketsAndSpace: RegExp = /\[.*?\]\s/;
    detectorTimestamp = moment.utc(detectorTimestamp.replace(bracketsAndSpace, '')).format(detectorTimestampFormat);

    if (!detectorTimestamp || !validateTimestamp(context, detectorTimestamp, deployEndTime)) {
        return undefined;
    }

    if (getValuesByColumnName(context, insightTable, ColumnName.status) === 'Critical') {
        const insightError: string = getValuesByColumnName(context, insightTable, ColumnName.dataValue);
        context.telemetry.properties.errorMessages = JSON.stringify(insightError);
        return localize('criticalError', '"{0}" reported a critical error: {1}', node.site.siteName, insightError);
    }

    return undefined;
}

export function validateTimestamp(context: IActionContext, detectorTime: string, deployResultTime: string): boolean {
    const secondsBetweenTimes: number = (new Date(detectorTime).getTime() - new Date(deployResultTime).getTime()) / 1000;
    // the detector can be as fast as ~20 seconds for app errors, but Docker container errors seem to timeout at
    // about 5 minutes
    context.telemetry.properties.timeBetweenDeployAndDetector = secondsBetweenTimes.toString();

    // detector time must be more recent than deployResultTime
    if (secondsBetweenTimes >= 0) {
        return true;
    }

    context.telemetry.properties.invalidTimestamp = 'true';
    return false;
}

export type detectorResponseJSON = {
    properties?: {
        dataset: detectorDataset[]
    }
};

export type detectorDataset = {
    table: detectorTable
};

export type detectorTable = {
    tableName: string,
    columns: detectorColumn[],
    rows: string[]
};

type detectorColumn = {
    columnName: ColumnName,
    dataType: string,
    columnType: string
};
