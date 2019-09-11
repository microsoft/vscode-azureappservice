import * as assert from 'assert';
import { IActionContext } from 'vscode-azureextensionui';
import { ColumnName, detectorResponseJSON, detectorTable, validateTimestamp } from "../src/commands/postDeploy/getLinuxDetectorError";
import { findTableByColumnName, findTableByRowValue, getValuesByColumnName } from "../src/commands/postDeploy/parseDetectorResponse";
import { nonNullValue } from '../src/utils/nonNull';

const vsCodeIntegration: string = 'Latest time seen by detector. To be used in VSCode integration.';
const context: IActionContext = { telemetry: { properties: {}, measurements: {} }, errorHandling: {} };

suite('Detector Dataset Parser', () => {
    test('Find table by column name', async () => {
        const table: detectorTable | undefined = findTableByColumnName(detectorJSONWithCriticalErrors.properties.dataset, ColumnName.failureCount);
        assert.equal(table, detectorJSONWithCriticalErrors.properties.dataset[4].table);
    });

    test('Find table by row value', async () => {
        const table: detectorTable | undefined = findTableByRowValue(detectorJSONWithCriticalErrors.properties.dataset, vsCodeIntegration);
        assert.equal(table, detectorJSONWithCriticalErrors.properties.dataset[1].table);
    });

    test('Get values by column name', async () => {
        const timestamp: string = "7/26/2019 8:40:00 PM UTC ";
        const table: detectorTable | undefined = findTableByRowValue(detectorJSONWithCriticalErrors.properties.dataset, vsCodeIntegration);
        assert.ok(table);
        const values: string = getValuesByColumnName(context, nonNullValue(table), ColumnName.value);
        assert.equal(values, timestamp);
    });

    test('Verify validateTimestamp', async () => {
        const timestamp: Date = new Date("7/26/2019 8:40:05 PM UTC ");
        const staleTimestamp: Date = new Date("7/26/2019 8:55:05 PM UTC ");
        const table: detectorTable | undefined = findTableByRowValue(detectorJSONWithCriticalErrors.properties.dataset, vsCodeIntegration);
        assert.ok(table);
        const parsedTimestamp: Date = new Date(getValuesByColumnName(context, nonNullValue(table), ColumnName.value));
        assert.equal(validateTimestamp(context, parsedTimestamp, timestamp), true);
        assert.equal(validateTimestamp(context, parsedTimestamp, staleTimestamp), false);
    });

    test('Return undefined if no timestamp value is found', async () => {
        const timestampTable: detectorTable | undefined = findTableByRowValue(detectorJSONWithoutCriticalErrors.properties.dataset, vsCodeIntegration);
        assert.equal(timestampTable, undefined);
    });

    test('Get failure counts', async () => {
        const table: detectorTable | undefined = findTableByColumnName(detectorJSONWithCriticalErrors.properties.dataset, ColumnName.failureCount);
        assert.ok(table);
        const failureCount: string = getValuesByColumnName(context, nonNullValue(table), ColumnName.failureCount);
        assert.equal(failureCount, 1);
    });

    test('Get error messages', async () => {
        const table: detectorTable | undefined = findTableByRowValue(detectorJSONWithCriticalErrors.properties.dataset, 'Critical');
        assert.ok(table);
        const errorMessages: string = getValuesByColumnName(context, nonNullValue(table), ColumnName.value);
        const expectedErrorMessage: string = 'Your app failed to start almost immediately.';
        assert.equal(errorMessages, expectedErrorMessage);
    });
});

const detectorJSONWithCriticalErrors: detectorResponseJSON = <detectorResponseJSON><unknown>{
    properties: {
        dataset: [
            {
                table: {
                    tableName: "",
                    columns: [
                        {
                            columnName: "Status",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "Message",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "Data.Name",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "Data.Value",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "Expanded",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "Solutions",
                            dataType: "String",
                            columnType: null
                        }
                    ],
                    rows: [
                        [
                            "Info",
                            "vscode",
                            "",
                            "",
                            "False",
                            "null"
                        ]
                    ]
                },
                renderingProperties: {
                    type: 7,
                    title: null,
                    description: null
                }
            },
            {
                table: {
                    tableName: "",
                    columns: [
                        {
                            columnName: "Status",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "Message",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "Data.Name",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "Data.Value",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "Expanded",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "Solutions",
                            dataType: "String",
                            columnType: null
                        }
                    ],
                    rows: [
                        [
                            "Info",
                            "Latest time seen by detector. To be used in VSCode integration.",
                            "Most recent time seen by the detector",
                            "7/26/2019 8:40:00 PM UTC ",
                            "False",
                            "null"
                        ]
                    ]
                },
                renderingProperties: {
                    type: 7,
                    title: null,
                    description: null
                }
            },
            {
                table: {
                    tableName: "",
                    columns: [
                        {
                            columnName: "Status",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "Message",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "Data.Name",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "Data.Value",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "Expanded",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "Solutions",
                            dataType: "String",
                            columnType: null
                        }
                    ],
                    rows: [
                        [
                            "Critical",
                            "Your app failed immediately",
                            "Observation",
                            "Your app failed to start almost immediately.",
                            "False",
                            "null"
                        ],
                        [
                            "Critical",
                            "Your app failed immediately",
                            "Possible reason",
                            "Your Docker image may not exist.",
                            "False",
                            "null"
                        ],
                        [
                            "Critical",
                            "Your app failed immediately",
                            "Error message",
                            "docker container could not be started: naturins-linux_1",
                            "False",
                            "null"
                        ],
                        [
                            "Critical",
                            "Your app failed immediately",
                            "Suggestion",
                            "Please check the repository name, image name, and container definitions.",
                            "False",
                            "null"
                        ]
                    ]
                },
                renderingProperties: {
                    type: 7,
                    title: null,
                    description: null
                }
            },
            {
                table: {
                    tableName: "",
                    columns: [
                        {
                            columnName: "Status",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "Message",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "Data.Name",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "Data.Value",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "Expanded",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "Solutions",
                            dataType: "String",
                            columnType: null
                        }
                    ],
                    rows: [
                        [
                            "Info",
                            "Get full Docker logs",
                            "Full Docker logs can be found from: ",
                            "<a href=\"https://naturins-linux.scm.azurewebsites.net/api/logs/docker\" target=\"_blank\">Get JSON with Docker log links</a> ",
                            "False",
                            "null"
                        ]
                    ]
                },
                renderingProperties: {
                    type: 7,
                    title: null,
                    description: null
                }
            },
            {
                table: {
                    tableName: "",
                    columns: [
                        {
                            columnName: "Time",
                            dataType: "DateTime",
                            columnType: null
                        },
                        {
                            columnName: "Instance",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "Facility",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "FailureCount",
                            dataType: "Int64",
                            columnType: null
                        }
                    ],
                    rows: [
                        [
                            "2019-07-26T20:40:00",
                            "467983_Small_90",
                            "naturins-linux",
                            1
                        ]
                    ]
                },
                renderingProperties: {
                    defaultValue: 0,
                    graphType: 1,
                    graphOptions: null,
                    timestampColumnName: null,
                    roleInstanceColumnName: null,
                    seriesColumns: null,
                    type: 2,
                    title: "Number of app Start Failures",
                    description: null
                }
            },
            {
                table: {
                    tableName: "",
                    columns: [
                        {
                            columnName: "Time",
                            dataType: "DateTime",
                            columnType: null
                        },
                        {
                            columnName: "Instance",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "Facility",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "Message",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "FailureCount",
                            dataType: "Int64",
                            columnType: null
                        }
                    ],
                    rows: [
                        [
                            "2019-07-26T20:40:00",
                            "467983_Small_90",
                            "naturins-linux",
                            "docker container could not be started: naturins-linux_1",
                            1
                        ]
                    ]
                },
                renderingProperties: {
                    displayColumnNames: null,
                    groupByColumnName: null,
                    type: 1,
                    title: null,
                    description: null
                }
            }
        ]
    }
};

const detectorJSONWithoutCriticalErrors: detectorResponseJSON = <detectorResponseJSON><unknown>{
    properties: {
        dataset: [
            {
                table: {
                    tableName: "",
                    columns: [
                        {
                            columnName: "Status",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "Message",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "Data.Name",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "Data.Value",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "Expanded",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "Solutions",
                            dataType: "String",
                            columnType: null
                        }
                    ],
                    rows: [
                        [
                            "Success",
                            "Your app started successfully.",
                            "Observation",
                            "No app start failures were found in this time range. Please use the time range selector to explore different time periods.",
                            "False",
                            "null"
                        ]
                    ]
                },
                renderingProperties: {
                    type: 7,
                    title: null,
                    description: null
                }
            },
            {
                table: {
                    tableName: "",
                    columns: [
                        {
                            columnName: "Status",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "Message",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "Data.Name",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "Data.Value",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "Expanded",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "Solutions",
                            dataType: "String",
                            columnType: null
                        }
                    ],
                    rows: [
                        [
                            "Info",
                            "Get full Docker logs",
                            "Full Docker logs can be found from: ",
                            "<a href=\"https://naturins-dotnet-linux.scm.azurewebsites.net/api/logs/docker\" target=\"_blank\">Get JSON with Docker log links</a> ",
                            "False",
                            "null"
                        ]
                    ]
                },
                renderingProperties: {
                    type: 7,
                    title: null,
                    description: null
                }
            }
        ]
    }
};
