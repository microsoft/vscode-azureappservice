/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext } from "@microsoft/vscode-azext-utils";
import { ColumnName, detectorDataset, detectorTable } from "./getLinuxDetectorError";

export function findTableByName(datasets: detectorDataset[], tableName: string): detectorTable | undefined {
    for (const dataset of datasets) {
        if (dataset.table.tableName === tableName) {
            return dataset.table;
        }
    }

    return undefined;
}

export function getValuesByColumnName(context: IActionContext, table: detectorTable, columnName: ColumnName): string {
    // -1 indicates that findIndex returned nothing
    const rowIndex: number = table.columns.findIndex(column => column.columnName === columnName);
    const values: string[] = [];

    if (rowIndex >= 0) {
        for (const row of table.rows) {
            values.push(row[rowIndex]);
        }
    }

    // keep track of how many values the detector is returning, but for now, we only use the first result
    context.telemetry.properties.columnName = columnName;
    context.telemetry.properties.numberOfValues = values.length.toString();

    // the last one should be the most recent
    return values.pop() || '';
}
