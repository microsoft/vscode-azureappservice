/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { IActionContext } from 'vscode-azureextensionui';
import { ColumnName, detectorTable, findTableByName, getValuesByColumnName, validateTimestamp } from "../extension.bundle";

const context: IActionContext = { telemetry: { properties: {}, measurements: {} }, errorHandling: { issueProperties: {} } };

suite('Detector Dataset Parser', () => {
    test('Find table by table name', async () => {
        const table: detectorTable | undefined = findTableByName(detectorResponse.properties.dataset, 'insight/logs');
        assert.equal(table, detectorResponse.properties.dataset[1].table);
    });

    test('Get values by column name', async () => {
        const insightTable: any = detectorResponse.properties.dataset[1].table;
        const rawApplicationLog: string = getValuesByColumnName(context, insightTable, ColumnName.value);
        assert.equal(rawApplicationLog, detectorResponse.properties.dataset[1].table.rows[0][3]);
    });

    test('Verify validateTimestamp', async () => {
        const expectedTimestamp: string = "2020-04-21T18:24:28";
        // an hour earlier (stale)
        const staleTimestamp: string = "2020-04-21T17:24:28";
        // an hour in the future, meaning our deployment is more recent than the detector timestamp
        const futureTimestamp: string = "2020-04-21T19:24:28";

        const bracketsAndSpace: RegExp = /\[.*?\]\s/;
        const appInsightTable: any = JSON.parse(detectorResponse.properties.dataset[1].table.rows[0][3])[0].table;
        const detectorTimestamp: string = getValuesByColumnName(context, appInsightTable, ColumnName.dataName).replace(bracketsAndSpace, '');

        assert.equal(validateTimestamp(context, detectorTimestamp, expectedTimestamp), true);
        assert.equal(validateTimestamp(context, detectorTimestamp, staleTimestamp), true);
        assert.equal(validateTimestamp(context, detectorTimestamp, futureTimestamp), false);
    });

    test('Get error messages', async () => {
        const expectedErrorMessage: string = "Cannot find module 'yenv'";
        const appInsightTable: any = JSON.parse(detectorResponse.properties.dataset[1].table.rows[0][3])[0].table;
        const insightError: string = getValuesByColumnName(context, appInsightTable, ColumnName.dataValue);
        assert.equal(insightError, expectedErrorMessage);
    });
});

const detectorResponse: any = {
    id: "/subscriptions/9b5c7ccb-9857-4307-843b-8875e83f65e9/resourceGroups/appsvc_linux_centralus/providers/Microsoft.Web/sites/naturins-node-awesome/detectors/LinuxLogViewer",
    name: "LinuxLogViewer",
    type: "Microsoft.Web/sites/detectors",
    location: "Central US",
    properties: {
        metadata: {
            id: "LinuxLogViewer",
            name: "Application Logs",
            category: "Availability and Performance",
            author: "",
            description: "Check the summary of your latest logs. This allows you to view the relevant logs from your app, and highlights the specific text in the logs that might be a potential issue.",
            type: "Detector",
            supportTopicList: [],
            analysisTypes: [
                "LinuxAppDown"
            ],
            score: 0.0,
            typeId: "Diagnostics.ModelsAndUtils.Attributes.Definition, Diagnostics.ModelsAndUtils, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null"
        },
        dataset: [
            {
                table: {
                    tableName: "insight/top",
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
                            "Application logs from instance: RD0003FF625538 contain an error or a warning",
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
                    tableName: "insight/logs",
                    columns: [
                        {
                            columnName: "Label",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "Key",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "Selected",
                            dataType: "Boolean",
                            columnType: null
                        },
                        {
                            columnName: "Value",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "DropdownType",
                            dataType: "String",
                            columnType: null
                        },
                        {
                            columnName: "DropdownPosition",
                            dataType: "String",
                            columnType: null
                        }
                    ],
                    rows: [
                        [
                            "Select instance here (1 instances): ",
                            "RD0003FF625538",
                            true,
                            "[{\"table\":{\"tableName\":\"application/insight\",\"columns\":[{\"columnName\":\"Status\",\"dataType\":\"String\",\"columnType\":null},{\"columnName\":\"Message\",\"dataType\":\"String\",\"columnType\":null},{\"columnName\":\"Data.Name\",\"dataType\":\"String\",\"columnType\":null},{\"columnName\":\"Data.Value\",\"dataType\":\"String\",\"columnType\":null},{\"columnName\":\"Expanded\",\"dataType\":\"String\",\"columnType\":null},{\"columnName\":\"Solutions\",\"dataType\":\"String\",\"columnType\":null}],\"rows\":[[\"Critical\",\"Application logs from instance: RD0003FF625538 contain an error or a warning\",\"[1] 2020-04-21T18:24:28\",\"Cannot find module 'yenv'\",\"True\",\"null\"]]},\"renderingProperties\":{\"type\":7,\"title\":null,\"description\":null}},{\"table\":{\"tableName\":\"application/log\",\"columns\":[{\"columnName\":\"Markdown\",\"dataType\":\"String\",\"columnType\":null}],\"rows\":[[\"\\n2020-04-21T18:23:49.984267010Z \\n2020-04-21T18:23:49.984325412Z > express-cart@1.1.17 start /home/site/wwwroot\\n2020-04-21T18:23:49.984336612Z > node app.js\\n2020-04-21T18:23:49.984344812Z \\n2020-04-21T18:23:50.524784539Z internal/modules/cjs/loader.js:797\\n2020-04-21T18:23:50.524824240Z     throw err;\\n2020-04-21T18:23:50.524834740Z     ^\\n2020-04-21T18:23:50.524842541Z \\n2020-04-21T18:23:50.524850141Z Error: Cannot find module 'yenv'\\n2020-04-21T18:23:50.524858041Z Require stack:\\n2020-04-21T18:23:50.524865541Z - /home/site/wwwroot/app.js\\n2020-04-21T18:23:50.524873242Z     at Function.Module._resolveFilename (internal/modules/cjs/loader.js:794:15)\\n2020-04-21T18:23:50.524892642Z     at Function.Module._load (internal/modules/cjs/loader.js:687:27)\\n2020-04-21T18:23:50.524901242Z     at Module.require (internal/modules/cjs/loader.js:849:19)\\n2020-04-21T18:23:50.524909043Z     at require (internal/modules/cjs/helpers.js:74:18)\\n2020-04-21T18:23:50.524916743Z     at Object.<anonymous> (/home/site/wwwroot/app.js:2:14)\\n2020-04-21T18:23:50.524925043Z     at Module._compile (internal/modules/cjs/loader.js:956:30)\\n2020-04-21T18:23:50.524932643Z     at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\\n2020-04-21T18:23:50.524940344Z     at Module.load (internal/modules/cjs/loader.js:812:32)\\n2020-04-21T18:23:50.524948044Z     at Function.Module._load (internal/modules/cjs/loader.js:724:14)\\n2020-04-21T18:23:50.524955744Z     at Function.Module.runMain (internal/modules/cjs/loader.js:1025:10) {\\n2020-04-21T18:23:50.524963545Z   code: 'MODULE_NOT_FOUND',\\n2020-04-21T18:23:50.524970945Z   requireStack: [ '/home/site/wwwroot/app.js' ]\\n2020-04-21T18:23:50.524978345Z }\\n2020-04-21T18:23:50.554714626Z npm ERR! code ELIFECYCLE\\n2020-04-21T18:23:50.556544486Z npm ERR! errno 1\\n2020-04-21T18:23:50.566290708Z npm ERR! express-cart@1.1.17 start: `node app.js`\\n2020-04-21T18:23:50.572499512Z npm ERR! Exit status 1\\n2020-04-21T18:23:50.572520813Z npm ERR! \\n2020-04-21T18:23:50.572544814Z npm ERR! Failed at the express-cart@1.1.17 start script.\\n2020-04-21T18:23:50.572555314Z npm ERR! This is probably not a problem with npm. There is likely additional logging output above.\\n2020-04-21T18:23:50.594397235Z npm WARN Local package.json exists, but node_modules missing, did you mean to install?\\n2020-04-21T18:23:50.603758244Z \\n2020-04-21T18:23:50.609965348Z npm ERR! A complete log of this run can be found in:\\n2020-04-21T18:23:50.610895879Z npm ERR!     /root/.npm/_logs/2020-04-21T18_23_50_572Z-debug.log\\n\\n2020-04-21T18:24:23.321266180Z   _____                               \\n2020-04-21T18:24:23.321301081Z   /  _  \\\\ __________ _________   ____  \\n2020-04-21T18:24:23.321310882Z  /  /_\\\\  \\\\___   /  |  \\\\_  __ \\\\_/ __ \\\\ \\n2020-04-21T18:24:23.321318982Z /    |    \\\\/    /|  |  /|  | \\\\/\\\\  ___/ \\n2020-04-21T18:24:23.321326382Z \\\\____|__  /_____ \\\\____/ |__|    \\\\___  >\\n2020-04-21T18:24:23.321334083Z         \\\\/      \\\\/                  \\\\/ \\n2020-04-21T18:24:23.321341583Z A P P   S E R V I C E   O N   L I N U X\\n2020-04-21T18:24:23.321348683Z \\n2020-04-21T18:24:23.321355383Z Documentation: http://aka.ms/webapp-linux\\n2020-04-21T18:24:23.321363384Z NodeJS quickstart: https://aka.ms/node-qs\\n2020-04-21T18:24:23.321370684Z NodeJS Version : v12.13.0\\n2020-04-21T18:24:23.321377384Z Note: Any data outside '/home' is not persisted\\n2020-04-21T18:24:23.321384584Z \\n2020-04-21T18:24:23.454116961Z Oryx Version: 0.2.20191105.2, Commit: 67e159d71419415435cb5d10c05a0f0758ee8809, ReleaseTagName: 20191105.2\\n2020-04-21T18:24:23.455006994Z Cound not find build manifest file at '/home/site/wwwroot/oryx-manifest.toml'\\n2020-04-21T18:24:23.455753222Z Could not find operation ID in manifest. Generating an operation id...\\n2020-04-21T18:24:23.456281742Z Build Operation ID: c9262b5e-3a10-4692-9fc3-ca9607639000\\n2020-04-21T18:24:25.733012398Z Writing output script to '/opt/startup/startup.sh'\\n2020-04-21T18:24:26.112031407Z Running #!/bin/sh\\n2020-04-21T18:24:26.112846238Z \\n2020-04-21T18:24:26.112864938Z # Enter the source directory to make sure the script runs where the user expects\\n2020-04-21T18:24:26.112874739Z cd \\\"/home/site/wwwroot\\\"\\n2020-04-21T18:24:26.112882839Z \\n2020-04-21T18:24:26.114202789Z export NODE_PATH=$(npm root --quiet -g):$NODE_PATH\\n2020-04-21T18:24:26.114221489Z if [ -z \\\"$PORT\\\" ]; then\\n2020-04-21T18:24:26.118717658Z \\t\\texport PORT=8080\\n2020-04-21T18:24:26.118742159Z fi\\n2020-04-21T18:24:26.119091472Z \\n2020-04-21T18:24:26.119107873Z npm start\\n2020-04-21T18:24:28.701085633Z \\n2020-04-21T18:24:28.701136135Z > express-cart@1.1.17 start /home/site/wwwroot\\n2020-04-21T18:24:28.701147835Z > node app.js\\n2020-04-21T18:24:28.701155935Z \\n2020-04-21T18:24:28.951487592Z internal/modules/cjs/loader.js:797\\n2020-04-21T18:24:28.951530394Z     throw err;\\n2020-04-21T18:24:28.951540594Z     ^\\n2020-04-21T18:24:28.951548594Z \\n2020-04-21T18:24:28.951556295Z Error: Cannot find module 'yenv'\\n2020-04-21T18:24:28.951563995Z Require stack:\\n2020-04-21T18:24:28.951571495Z - /home/site/wwwroot/app.js\\n2020-04-21T18:24:28.951578996Z     at Function.Module._resolveFilename (internal/modules/cjs/loader.js:794:15)\\n2020-04-21T18:24:28.951598296Z     at Function.Module._load (internal/modules/cjs/loader.js:687:27)\\n2020-04-21T18:24:28.951606697Z     at Module.require (internal/modules/cjs/loader.js:849:19)\\n2020-04-21T18:24:28.951614497Z     at require (internal/modules/cjs/helpers.js:74:18)\\n2020-04-21T18:24:28.951622097Z     at Object.<anonymous> (/home/site/wwwroot/app.js:2:14)\\n2020-04-21T18:24:28.951630597Z     at Module._compile (internal/modules/cjs/loader.js:956:30)\\n2020-04-21T18:24:28.951638298Z     at Object.Module._extensions..js (internal/modules/cjs/loader.js:973:10)\\n2020-04-21T18:24:28.951646198Z     at Module.load (internal/modules/cjs/loader.js:812:32)\\n2020-04-21T18:24:28.951653498Z     at Function.Module._load (internal/modules/cjs/loader.js:724:14)\\n2020-04-21T18:24:28.951660899Z     at Function.Module.runMain (internal/modules/cjs/loader.js:1025:10) {\\n2020-04-21T18:24:28.951669599Z   code: 'MODULE_NOT_FOUND',\\n2020-04-21T18:24:28.951677099Z   requireStack: [ '/home/site/wwwroot/app.js' ]\\n2020-04-21T18:24:28.951684399Z }\\n2020-04-21T18:24:28.979364101Z npm ERR! code ELIFECYCLE\\n2020-04-21T18:24:28.980970459Z npm ERR! errno 1\\n2020-04-21T18:24:28.983463649Z npm ERR! express-cart@1.1.17 start: `node app.js`\\n2020-04-21T18:24:28.984807998Z npm ERR! Exit status 1\\n2020-04-21T18:24:28.992094961Z npm ERR! \\n2020-04-21T18:24:28.993262604Z npm ERR! Failed at the express-cart@1.1.17 start script.\\n2020-04-21T18:24:28.994279240Z npm ERR! This is probably not a problem with npm. There is likely additional logging output above.\\n2020-04-21T18:24:29.013987554Z npm WARN Local package.json exists, but node_modules missing, did you mean to install?\\n2020-04-21T18:24:29.015641513Z \\n2020-04-21T18:24:29.016600848Z npm ERR! A complete log of this run can be found in:\\n2020-04-21T18:24:29.021478125Z npm ERR!     /root/.npm/_logs/2020-04-21T18_24_28_999Z-debug.log\\n\"]]},\"renderingProperties\":{\"enableEmailButtons\":false,\"isContainerNeeded\":true,\"type\":9,\"title\":null,\"description\":null}},{\"table\":{\"tableName\":\"docker/insight\",\"columns\":[{\"columnName\":\"Status\",\"dataType\":\"String\",\"columnType\":null},{\"columnName\":\"Message\",\"dataType\":\"String\",\"columnType\":null},{\"columnName\":\"Data.Name\",\"dataType\":\"String\",\"columnType\":null},{\"columnName\":\"Data.Value\",\"dataType\":\"String\",\"columnType\":null},{\"columnName\":\"Expanded\",\"dataType\":\"String\",\"columnType\":null},{\"columnName\":\"Solutions\",\"dataType\":\"String\",\"columnType\":null}],\"rows\":[[\"Critical\",\"Docker on instance: RD0003FF625538 experienced container start failures.\",\"[1] 2020-04-21 18:23:26\",\"Container naturins-node-awesome_5_a186a675 didn't respond to HTTP pings on port: 8080, failing site start\",\"True\",\"null\"],[\"Critical\",\"Docker on instance: RD0003FF625538 experienced container start failures.\",\"[2] 2020-04-21 18:23:26\",\"Container naturins-node-awesome_5_a186a675 for site naturins-node-awesome has exited, failing site start\",\"True\",\"null\"],[\"Critical\",\"Docker on instance: RD0003FF625538 experienced container start failures.\",\"[3] 2020-04-21 18:23:38\",\"Container naturins-node-awesome_0_686f4651 didn't respond to HTTP pings on port: 8080, failing site start\",\"True\",\"null\"],[\"Critical\",\"Docker on instance: RD0003FF625538 experienced container start failures.\",\"[4] 2020-04-21 18:23:38\",\"Container naturins-node-awesome_0_686f4651 for site naturins-node-awesome has exited, failing site start\",\"True\",\"null\"],[\"Critical\",\"Docker on instance: RD0003FF625538 experienced container start failures.\",\"[5] 2020-04-21 18:23:51\",\"Container naturins-node-awesome_0_0e3fd480 didn't respond to HTTP pings on port: 8080, failing site start\",\"True\",\"null\"],[\"Critical\",\"Docker on instance: RD0003FF625538 experienced container start failures.\",\"[6] 2020-04-21 18:23:51\",\"Container naturins-node-awesome_0_0e3fd480 for site naturins-node-awesome has exited, failing site start\",\"True\",\"null\"],[\"Critical\",\"Docker on instance: RD0003FF625538 experienced container start failures.\",\"[7] 2020-04-21 18:24:29\",\"Container naturins-node-awesome_0_c01e0c28 didn't respond to HTTP pings on port: 8080, failing site start\",\"True\",\"null\"],[\"Critical\",\"Docker on instance: RD0003FF625538 experienced container start failures.\",\"[8] 2020-04-21 18:24:29\",\"Container naturins-node-awesome_0_c01e0c28 for site naturins-node-awesome has exited, failing site start\",\"True\",\"null\"]]},\"renderingProperties\":{\"type\":7,\"title\":null,\"description\":null}},{\"table\":{\"tableName\":\"docker/log\",\"columns\":[{\"columnName\":\"Markdown\",\"dataType\":\"String\",\"columnType\":null}],\"rows\":[[\"2020-04-21 01:54:22.577 INFO  - Starting container for site\\n2020-04-21 01:54:22.621 INFO  - docker run -d -p 8784:8080 --name naturins-node-awesome_1_6a195661 -e WEBSITE_NODE_DEFAULT_VERSION=12-lts -e APPSETTING_WEBSITE_NODE_DEFAULT_VERSION=12-lts -e WEBSITE_SITE_NAME=naturins-node-awesome -e WEBSITE_AUTH_ENABLED=False -e WEBSITE_ROLE_INSTANCE_ID=0 -e WEBSITE_HOSTNAME=naturins-node-awesome.azurewebsites.net -e WEBSITE_INSTANCE_ID=b7e72dec7e4cc8a4736179c6176e926e1a9bf791a689d53c7c98cb9379127d31 -e HTTP_LOGGING_ENABLED=1 appsvc/node:12-lts  \\n\\n2020-04-21 01:54:24.543 INFO  - Initiating warmup request to container naturins-node-awesome_1_6a195661 for site naturins-node-awesome\\n2020-04-21 01:54:33.718 INFO  - Container naturins-node-awesome_1_6a195661 for site naturins-node-awesome initialized successfully and is ready to serve requests.\\n2020-04-21 02:02:34.670 INFO  - Starting container for site\\n2020-04-21 02:02:34.670 INFO  - docker run -d -p 7540:8080 --name naturins-node-awesome_2_4873ba74 -e WEBSITE_NODE_DEFAULT_VERSION=12-lts -e APPSETTING_WEBSITE_NODE_DEFAULT_VERSION=12-lts -e WEBSITE_SITE_NAME=naturins-node-awesome -e WEBSITE_AUTH_ENABLED=False -e WEBSITE_ROLE_INSTANCE_ID=0 -e WEBSITE_HOSTNAME=naturins-node-awesome.azurewebsites.net -e WEBSITE_INSTANCE_ID=b7e72dec7e4cc8a4736179c6176e926e1a9bf791a689d53c7c98cb9379127d31 -e HTTP_LOGGING_ENABLED=1 appsvc/node:12-lts  \\n\\n2020-04-21 02:02:35.846 INFO  - Initiating warmup request to container naturins-node-awesome_2_4873ba74 for site naturins-node-awesome\\n2020-04-21 02:02:43.047 INFO  - Container naturins-node-awesome_2_4873ba74 for site naturins-node-awesome initialized successfully and is ready to serve requests.\\n2020-04-21 02:28:25.452 INFO  - Starting container for site\\n2020-04-21 02:28:25.454 INFO  - docker run -d -p 6804:8080 --name naturins-node-awesome_3_c991a6a2 -e WEBSITE_NODE_DEFAULT_VERSION=12-lts -e APPSETTING_WEBSITE_NODE_DEFAULT_VERSION=12-lts -e WEBSITE_SITE_NAME=naturins-node-awesome -e WEBSITE_AUTH_ENABLED=False -e WEBSITE_ROLE_INSTANCE_ID=0 -e WEBSITE_HOSTNAME=naturins-node-awesome.azurewebsites.net -e WEBSITE_INSTANCE_ID=b7e72dec7e4cc8a4736179c6176e926e1a9bf791a689d53c7c98cb9379127d31 -e HTTP_LOGGING_ENABLED=1 appsvc/node:12-lts  \\n\\n2020-04-21 02:28:26.502 INFO  - Initiating warmup request to container naturins-node-awesome_3_c991a6a2 for site naturins-node-awesome\\n2020-04-21 02:28:32.652 INFO  - Container naturins-node-awesome_3_c991a6a2 for site naturins-node-awesome initialized successfully and is ready to serve requests.\\n2020-04-21 02:42:56.847 INFO  - Starting container for site\\n2020-04-21 02:42:56.849 INFO  - docker run -d -p 3814:8080 --name naturins-node-awesome_4_d2e05968 -e WEBSITE_NODE_DEFAULT_VERSION=12-lts -e APPSETTING_WEBSITE_NODE_DEFAULT_VERSION=12-lts -e WEBSITE_SITE_NAME=naturins-node-awesome -e WEBSITE_AUTH_ENABLED=False -e WEBSITE_ROLE_INSTANCE_ID=0 -e WEBSITE_HOSTNAME=naturins-node-awesome.azurewebsites.net -e WEBSITE_INSTANCE_ID=b7e72dec7e4cc8a4736179c6176e926e1a9bf791a689d53c7c98cb9379127d31 -e HTTP_LOGGING_ENABLED=1 appsvc/node:12-lts  \\n\\n2020-04-21 02:43:00.792 INFO  - Initiating warmup request to container naturins-node-awesome_4_d2e05968 for site naturins-node-awesome\\n2020-04-21 02:43:06.380 INFO  - Container naturins-node-awesome_4_d2e05968 for site naturins-node-awesome initialized successfully and is ready to serve requests.\\n2020-04-21 18:23:15.761 INFO  - Starting container for site\\n2020-04-21 18:23:15.764 INFO  - docker run -d -p 6739:8080 --name naturins-node-awesome_5_a186a675 -e WEBSITE_NODE_DEFAULT_VERSION=12-lts -e APPSETTING_WEBSITE_NODE_DEFAULT_VERSION=12-lts -e WEBSITE_SITE_NAME=naturins-node-awesome -e WEBSITE_AUTH_ENABLED=False -e WEBSITE_ROLE_INSTANCE_ID=0 -e WEBSITE_HOSTNAME=naturins-node-awesome.azurewebsites.net -e WEBSITE_INSTANCE_ID=b7e72dec7e4cc8a4736179c6176e926e1a9bf791a689d53c7c98cb9379127d31 -e HTTP_LOGGING_ENABLED=1 appsvc/node:12-lts  \\n\\n2020-04-21 18:23:17.241 INFO  - Initiating warmup request to container naturins-node-awesome_5_a186a675 for site naturins-node-awesome\\n2020-04-21 18:23:26.453 ERROR - Container naturins-node-awesome_5_a186a675 for site naturins-node-awesome has exited, failing site start\\n2020-04-21 18:23:26.498 ERROR - Container naturins-node-awesome_5_a186a675 didn't respond to HTTP pings on port: 8080, failing site start. See container logs for debugging.\\n2020-04-21 18:23:31.325 INFO  - Starting container for site\\n2020-04-21 18:23:31.328 INFO  - docker run -d -p 5504:8080 --name naturins-node-awesome_0_686f4651 -e WEBSITE_NODE_DEFAULT_VERSION=12-lts -e APPSETTING_WEBSITE_NODE_DEFAULT_VERSION=12-lts -e WEBSITE_SITE_NAME=naturins-node-awesome -e WEBSITE_AUTH_ENABLED=False -e WEBSITE_ROLE_INSTANCE_ID=0 -e WEBSITE_HOSTNAME=naturins-node-awesome.azurewebsites.net -e WEBSITE_INSTANCE_ID=b7e72dec7e4cc8a4736179c6176e926e1a9bf791a689d53c7c98cb9379127d31 -e HTTP_LOGGING_ENABLED=1 appsvc/node:12-lts  \\n\\n2020-04-21 18:23:32.940 INFO  - Initiating warmup request to container naturins-node-awesome_0_686f4651 for site naturins-node-awesome\\n2020-04-21 18:23:38.160 ERROR - Container naturins-node-awesome_0_686f4651 for site naturins-node-awesome has exited, failing site start\\n2020-04-21 18:23:38.188 ERROR - Container naturins-node-awesome_0_686f4651 didn't respond to HTTP pings on port: 8080, failing site start. See container logs for debugging.\\n2020-04-21 18:23:38.210 INFO  - Stoping site naturins-node-awesome because it failed during startup.\\n2020-04-21 18:23:43.927 INFO  - Starting container for site\\n2020-04-21 18:23:43.931 INFO  - docker run -d -p 4647:8080 --name naturins-node-awesome_0_0e3fd480 -e WEBSITE_NODE_DEFAULT_VERSION=12-lts -e APPSETTING_WEBSITE_NODE_DEFAULT_VERSION=12-lts -e WEBSITE_SITE_NAME=naturins-node-awesome -e WEBSITE_AUTH_ENABLED=False -e WEBSITE_ROLE_INSTANCE_ID=0 -e WEBSITE_HOSTNAME=naturins-node-awesome.azurewebsites.net -e WEBSITE_INSTANCE_ID=b7e72dec7e4cc8a4736179c6176e926e1a9bf791a689d53c7c98cb9379127d31 -e HTTP_LOGGING_ENABLED=1 appsvc/node:12-lts  \\n\\n2020-04-21 18:23:45.511 INFO  - Initiating warmup request to container naturins-node-awesome_0_0e3fd480 for site naturins-node-awesome\\n2020-04-21 18:23:51.658 ERROR - Container naturins-node-awesome_0_0e3fd480 for site naturins-node-awesome has exited, failing site start\\n2020-04-21 18:23:51.675 ERROR - Container naturins-node-awesome_0_0e3fd480 didn't respond to HTTP pings on port: 8080, failing site start. See container logs for debugging.\\n2020-04-21 18:23:51.680 INFO  - Stoping site naturins-node-awesome because it failed during startup.\\n2020-04-21 18:24:21.705 INFO  - Starting container for site\\n2020-04-21 18:24:21.707 INFO  - docker run -d -p 8369:8080 --name naturins-node-awesome_0_c01e0c28 -e WEBSITE_NODE_DEFAULT_VERSION=12-lts -e APPSETTING_WEBSITE_NODE_DEFAULT_VERSION=12-lts -e WEBSITE_SITE_NAME=naturins-node-awesome -e WEBSITE_AUTH_ENABLED=False -e WEBSITE_ROLE_INSTANCE_ID=0 -e WEBSITE_HOSTNAME=naturins-node-awesome.azurewebsites.net -e WEBSITE_INSTANCE_ID=b7e72dec7e4cc8a4736179c6176e926e1a9bf791a689d53c7c98cb9379127d31 -e HTTP_LOGGING_ENABLED=1 appsvc/node:12-lts  \\n\\n2020-04-21 18:24:23.412 INFO  - Initiating warmup request to container naturins-node-awesome_0_c01e0c28 for site naturins-node-awesome\\n2020-04-21 18:24:29.565 ERROR - Container naturins-node-awesome_0_c01e0c28 for site naturins-node-awesome has exited, failing site start\\n2020-04-21 18:24:29.590 ERROR - Container naturins-node-awesome_0_c01e0c28 didn't respond to HTTP pings on port: 8080, failing site start. See container logs for debugging.\\n2020-04-21 18:24:29.595 INFO  - Stoping site naturins-node-awesome because it failed during startup.\\n2020-04-21 20:54:13.202 INFO  - Starting container for site\\n2020-04-21 20:54:13.205 INFO  - docker run -d -p 8288:8080 --name naturins-node-awesome_0_f694fec2 -e WEBSITE_NODE_DEFAULT_VERSION=12-lts -e APPSETTING_WEBSITE_NODE_DEFAULT_VERSION=12-lts -e WEBSITE_SITE_NAME=naturins-node-awesome -e WEBSITE_AUTH_ENABLED=False -e WEBSITE_ROLE_INSTANCE_ID=0 -e WEBSITE_HOSTNAME=naturins-node-awesome.azurewebsites.net -e WEBSITE_INSTANCE_ID=b7e72dec7e4cc8a4736179c6176e926e1a9bf791a689d53c7c98cb9379127d31 -e HTTP_LOGGING_ENABLED=1 appsvc/node:12-lts  \\n\\n\"]]},\"renderingProperties\":{\"enableEmailButtons\":false,\"isContainerNeeded\":true,\"type\":9,\"title\":null,\"description\":null}}]",
                            "Legacy",
                            "FloatLeft"
                        ]
                    ]
                },
                renderingProperties: {
                    type: 11,
                    title: "Logs and Insights",
                    description: null
                }
            },
            {
                table: {
                    tableName: "logging/on",
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
                            "Verbose application logging is on.",
                            "Observation",
                            "HTTP Logging is set to true. This means that you will be able to see any logs from your app itself. This should be turned on when you're troubleshooting your app.",
                            "True",
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
                            "Link to Full Logs",
                            "Link to Full Logs",
                            "You can access the full logs from the Kudu/SCM site <a href=\"https://naturins-node-awesome.scm.azurewebsites.net/api/logs/docker\" target=\"_blank\">here</a>.",
                            "True",
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
        ],
        status: {
            message: null,
            statusId: 0
        },
        dataProvidersMetadata: null,
        suggestedUtterances: null
    }
};
