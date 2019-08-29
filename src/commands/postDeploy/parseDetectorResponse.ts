/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ColumnName, detectorDataset, detectorTable } from "./checkLinuxWebAppDownDetector";

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

export function getValuesByColumnName(table: detectorTable, columnName: ColumnName): string[] {
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
