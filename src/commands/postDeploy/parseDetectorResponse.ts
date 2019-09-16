/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext } from "vscode-azureextensionui";
import { ColumnName, detectorDataset, detectorTable } from "./getLinuxDetectorError";

// the dataset contains several tables all with the same tableName and columnNames so to find the proper table, look for a specific value
export function findTableByRowValue(datasets: detectorDataset[], searchValue: string): detectorTable | undefined {
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

export function findTableByColumnName(datasets: detectorDataset[], columnName: ColumnName): detectorTable | undefined {
    for (const dataset of datasets) {
        for (const col of dataset.table.columns) {
            if (col.columnName === columnName) {
                return dataset.table;
            }
        }
    }

    return undefined;
}

export function getValuesByColumnName(context: IActionContext, table: detectorTable, columnName: ColumnName): string {
    // -1 indicates that findIndex returned nothing
    const rowIndex: number = table.columns.findIndex(column => column.columnName === columnName);
    const values: string[] = [];

    if (rowIndex > 0) {
        for (const row of table.rows) {
            values.push(row[rowIndex]);
        }
    }

    // keep track of how many values the detector is returning, but for now, we only use the first result
    context.telemetry.properties.columnName = columnName;
    context.telemetry.properties.numberOfValues = values.length.toString();

    // tslint:disable-next-line: strict-boolean-expressions
    return values[0] || '';
}
