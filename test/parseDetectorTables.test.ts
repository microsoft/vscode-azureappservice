/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { IActionContext } from 'vscode-azureextensionui';
import { ColumnName, detectorResponseJSON, detectorTable, getValuesByColumnName, nonNullValue, validateTimestamp } from "../extension.bundle";
import { findTableByName } from '../src/commands/postDeploy/parseDetectorResponse';

const vsCodeIntegration: string = 'Latest time seen by detector. To be used in VSCode integration.';
const context: IActionContext = { telemetry: { properties: {}, measurements: {} }, errorHandling: { issueProperties: {} } };

suite('Detector Dataset Parser', () => {
    test('Find table by table name', async () => {
        const table: detectorTable | undefined = findTableByName(detectorResponse.properties.dataset, 'insights/logs');
        assert.equal(table, detectorResponse.properties.dataset[1].table);
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

// tslint:disable-next-line:one-variable-per-declaration
const rawDetectorResponse: string = `[{"table":{"tableName":"application/insight","columns":[{"columnName":"Status","dataType":"String","columnType":null},{"columnName":"Message","dataType":"String",
"columnType":null},{"columnName":"Data.Name","dataType":"String","columnType":null},{"columnName":"Data.Value","dataType":"String","columnType":null},{"columnName":"Expanded","dataType":"String","columnType":null},
{"columnName":"Solutions","dataType":"String","columnType":null}],"rows":[["Critical","Application logs from instance: RD0003FF119BD4 contain an error or a warning","[1] 2020-03-17T18:46:07","tar (child): node_modules.tar.gz:
Cannot open: No such file or directory","True","null"]]},"renderingProperties":{"type":7,"title":null,"description":null}},{"table":{"tableName":"application/log","columns":[{"columnName":"Markdown","dataType":"String","columnType":null}],
"rows":[["\n2020-03-17T18:46:04.104832118Z Documentation: http://aka.ms/webapp-linux\n2020-03-17T18:46:04.104835718Z NodeJS quickstart: https://aka.ms/node-qs\n2020-03-17T18:46:04.104850118Z NodeJS Version : v12.13.0\n2020-03-17T18:46:04.104853418Z
Note: Any data outside '/home' is not persisted\n2020-03-17T18:46:04.104856718Z \n2020-03-17T18:46:04.313645164Z Oryx Version: 0.2.20191105.2, Commit: 67e159d71419415435cb5d10c05a0f0758ee8809, ReleaseTagName: 20191105.2\n2020-03-17T18:46:04.313994966Z
Found build manifest file at '/home/site/wwwroot/oryx-manifest.toml'. Deserializing it...\n2020-03-17T18:46:04.322767810Z Build Operation ID: |jpbcyF+xyAE=.63e4a6cf_\n2020-03-17T18:46:04.971120759Z Writing output script to '/opt/startup/startup.sh'
\n2020-03-17T18:46:05.213664974Z Running #!/bin/sh\n2020-03-17T18:46:05.214350678Z \n2020-03-17T18:46:05.214660979Z # Enter the source directory to make sure the script runs where the user expects\n2020-03-17T18:46:05.215022181Z cd \"/home/site/wwwroot\
"\n2020-03-17T18:46:05.215375783Z \n2020-03-17T18:46:05.215646484Z export NODE_PATH=$(npm root --quiet -g):$NODE_PATH\n2020-03-17T18:46:05.216680489Z if [ -z \"$PORT\" ]; then\n2020-03-17T18:46:05.217029791Z \t\texport PORT=8080\n2020-03-17T18:46:05.217341793Z
 fi\n2020-03-17T18:46:05.217623294Z \n2020-03-17T18:46:05.218001196Z echo Found tar.gz based node_modules.\n2020-03-17T18:46:05.218105696Z extractionCommand=\"tar -xzf node_modules.tar.gz -C /node_modules\"\n2020-03-17T18:46:05.218689899Z echo \"Removing existing
 modules directory from root...\"\n2020-03-17T18:46:05.218820300Z rm -fr /node_modules\n2020-03-17T18:46:05.218912900Z mkdir -p /node_modules\n2020-03-17T18:46:05.219660304Z echo Extracting modules...\n2020-03-17T18:46:05.219695804Z $extractionCommand
 \n2020-03-17T18:46:05.219760305Z export NODE_PATH=\"/node_modules\":$NODE_PATH\n2020-03-17T18:46:05.219778805Z export PATH=/node_modules/.bin:$PATH\n2020-03-17T18:46:05.227172942Z if [ -d node_modules ] || [ -L node_modules ]; then
 \n2020-03-17T18:46:05.227205942Z     mv -f node_modules _del_node_modules || true\n2020-03-17T18:46:05.227266442Z fi\n2020-03-17T18:46:05.227302942Z \n2020-03-17T18:46:05.227352643Z if [ -d /node_modules ]; then\n2020-03-17T18:46:05.227370243Z
      ln -s /node_modules ./node_modules \n2020-03-17T18:46:05.227405443Z fi\n2020-03-17T18:46:05.227432643Z \n2020-03-17T18:46:05.227462843Z echo \"Done.\"\n2020-03-17T18:46:05.227477043Z pm2 start --no-daemon /opt/startup/default-static-site.js
      \n2020-03-17T18:46:07.007570963Z Found tar.gz based node_modules.\n2020-03-17T18:46:07.007735264Z Removing existing modules directory from root...\n2020-03-17T18:46:07.047362762Z Extracting modules...\n2020-03-17T18:46:07.073633894Z tar (child):
      node_modules.tar.gz: Cannot open: No such file or directory\n2020-03-17T18:46:07.079866925Z tar (child): Error is not recoverable: exiting now\n2020-03-17T18:46:07.080403428Z tar: Child returned status 2\n2020-03-17T18:46:07.080633829Z tar: Error
       is not recoverable: exiting now\n2020-03-17T18:46:07.120897831Z Done.\n2020-03-17T18:46:09.468330892Z \n2020-03-17T18:46:09.468367293Z                         -------------\n2020-03-17T18:46:09.468373393Z \n2020-03-17T18:46:09.468377593Z __/
       \\\\\\\\\\\\\\\\\\\\\\\\\\____/\\\\\\\\____________/\\\\\\\\____/\\\\\\\\\\\\\\\\\\_____\n2020-03-17T18:46:09.468382393Z  _\\/\\\\\\/////////\\\\\\_\\/\\\\\\\\\\\\________/\\\\\\\\\\\\__/\\\\\\///////\\\\\\___\n2020-03-17T18:46:09.468387093Z   _
       \\/\\\\\\_______\\/\\\\\\_\\/\\\\\\//\\\\\\____/\\\\\\//\\\\\\_\\///______\\//\\\\\\__\n2020-03-17T18:46:09.468391793Z    _\\/\\\\\\\\\\\\\\\\\\\\\\\\\\/__\\/\\\\\\\\///\\\\\\/\\\\\\/_\\/\\\\\\___________/\\\\\\/___\n2020-03-17T18:46:09.468396793Z     _
       \\/\\\\\\/////////____\\/\\\\\\__\\///\\\\\\/___\\/\\\\\\________/\\\\\\//_____\n2020-03-17T18:46:09.468401293Z      _\\/\\\\\\_____________\\/\\\\\\____\\///_____\\/\\\\\\_____/\\\\\\//________\n2020-03-17T18:46:09.468405693Z       _\\/\\\\\\_____________
       \\/\\\\\\_____________\\/\\\\\\___/\\\\\\/___________\n2020-03-17T18:46:09.468409993Z        _\\/\\\\\\_____________\\/\\\\\\_____________\\/\\\\\\__/\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_\n2020-03-17T18:46:09.468414493Z         _\\///______________\\///
       ______________\\///__\\///////////////__\n2020-03-17T18:46:09.468418793Z \n2020-03-17T18:46:09.468422493Z \n2020-03-17T18:46:09.468426393Z                           Runtime Edition\n2020-03-17T18:46:09.468430293Z \n2020-03-17T18:46:09.468434193Z
                PM2 is a Production Process Manager for Node.js applications\n2020-03-17T18:46:09.468438293Z                      with a built-in Load Balancer.\n2020-03-17T18:46:09.468442193Z \n2020-03-17T18:46:09.468445993Z
                Start and Daemonize any application:\n2020-03-17T18:46:09.468449993Z                 $ pm2 start app.js\n2020-03-17T18:46:09.468472393Z \n2020-03-17T18:46:09.468487593Z                 Load Balance 4 instances of
                api.js:\n2020-03-17T18:46:09.468491293Z                 $ pm2 start api.js -i 4\n2020-03-17T18:46:09.468495093Z \n2020-03-17T18:46:09.468498593Z                 Monitor in production:\n2020-03-17T18:46:09.468502193Z
                $ pm2 monitor\n2020-03-17T18:46:09.468516393Z \n2020-03-17T18:46:09.468519593Z                 Make pm2 auto-boot at server restart:\n2020-03-17T18:46:09.468523093Z                 $ pm2 startup\n2020-03-17T18:46:09.468526493Z \
                n2020-03-17T18:46:09.468529793Z                 To go further checkout:\n2020-03-17T18:46:09.468533193Z                 http://pm2.io/\n2020-03-17T18:46:09.468536593Z \n2020-03-17T18:46:09.468539793Z \n2020-03-17T18:46:09.468543094Z                         -------------\n2020-03-17T18:46:09.468546594Z \n2020-03-17T18:46:09.487986391Z pm2 launched in no-daemon mode (you can add DEBUG=\"*\" env variable to get more messages)\n2020-03-17T18:46:10.540603265Z 2020-03-17T18:46:10: PM2 log: Launching in no daemon mode\n2020-03-17T18:46:10.846597198Z 2020-03-17T18:46:10: PM2 log: [PM2] Starting /opt/startup/default-static-site.js in fork_mode (1 instance)\n2020-03-17T18:46:10.850114216Z 2020-03-17T18:46:10: PM2 log: App [default-static-site:0] starting in -fork mode-\n2020-03-17T18:46:10.887412103Z 2020-03-17T18:46:10: PM2 log: App [default-static-site:0] online\n2020-03-17T18:46:10.898641259Z 2020-03-17T18:46:10: PM2 log: [PM2] Done.\n2020-03-17T18:46:10.991671125Z 2020-03-17T18:46:10: PM2 log: ┌─────────────────────┬────┬─────────┬──────┬─────┬────────┬─────────┬────────┬─────┬──────────┬──────┬──────────┐\n2020-03-17T18:46:10.991706125Z │ App name            │ id │ version │ mode │ pid │ status │ restart │ uptime │ cpu │ mem      │ user │ watching │\n2020-03-17T18:46:10.991713525Z ├─────────────────────┼────┼─────────┼──────┼─────┼────────┼─────────┼────────┼─────┼──────────┼──────┼──────────┤\n2020-03-17T18:46:10.991718625Z │ default-static-site │ 0  │ 1.0.0   │ fork │ 67  │ online │ 0       │ 0s     │ 0%  │ 5.8 MB   │ root │ disabled │\n2020-03-17T18:46:10.991722825Z └─────────────────────┴────┴─────────┴──────┴─────┴────────┴─────────┴────────┴─────┴──────────┴──────┴──────────┘\n2020-03-17T18:46:11.008065807Z 2020-03-17T18:46:10: PM2 log:  Use pm2 show; <id | name> to get more details about an app\n2020-03-17T18:46:11.008087607Z 2020-03-17T18:46:11: PM2 log: [--no-daemon] Continue to stream logs\n2020-03-17T18:46:11.008094907Z 2020-03-17T18:46:11: PM2 log: [--no-daemon] Exit on target PM2 exit pid=52\n\n2020-03-17T18:47:01.621338849Z 18:47:01 0|default-static-site  | (node:67) [DEP0066] DeprecationWarning: OutgoingMessage.prototype._headers is deprecated\n\n"]]},"renderingProperties":{"enableEmailButtons":false,"isContainerNeeded":true,"type":9,"title":null,"description":null}},{"table":{"tableName":"docker/insight","columns":[{"columnName":"Status","dataType":"String","columnType":null},{"columnName":"Message","dataType":"String","columnType":null},{"columnName":"Data.Name","dataType":"String","columnType":null},{"columnName":"Data.Value","dataType":"String","columnType":null},{"columnName":"Expanded","dataType":"String","columnType":null},{"columnName":"Solutions","dataType":"String","columnType":null}],"rows":[["Critical","Docker on instance: RD0003FF119BD4 experienced container start failures.","","","True","null"]]},"renderingProperties":{"type":7,"title":null,"description":null}},{"table":{"tableName":"docker/log","columns":[{"columnName":"Markdown","dataType":"String","columnType":null}],"rows":[["2020-03-17 18:31:13.040 INFO  - Starting container for site\n2020-03-17 18:31:13.040 INFO  - docker run -d -p 9008:8080 --name naturins-node-awesome_0_af0ad279 -e WEBSITE_NODE_DEFAULT_VERSION=12-lts -e APPSETTING_WEBSITE_NODE_DEFAULT_VERSION=12-lts -e WEBSITE_SITE_NAME=naturins-node-awesome -e WEBSITE_AUTH_ENABLED=False -e WEBSITE_ROLE_INSTANCE_ID=0 -e WEBSITE_HOSTNAME=naturins-node-awesome.azurewebsites.net -e WEBSITE_INSTANCE_ID=2d81217236c12dee3b920ef52d54d0d1a725b7c965cbd7887d87a7ecd1390208 appsvc/node:12-lts  \n\n2020-03-17 18:31:13.040 INFO  - Logging is not enabled for this container.\nPlease use https://aka.ms/linux-diagnostics to enable logging to see container logs here.\n2020-03-17 18:31:15.739 INFO  - Initiating warmup request to container naturins-node-awesome_0_af0ad279 for site naturins-node-awesome\n2020-03-17 18:31:24.938 INFO  - Container naturins-node-awesome_0_af0ad279 for site naturins-node-awesome initialized successfully and is ready to serve requests.\n2020-03-17 18:41:30.918 INFO  - Starting container for site\n2020-03-17 18:41:30.919 INFO  - docker run -d -p 1858:8080 --name naturins-node-awesome_0_4c5b4271 -e WEBSITE_NODE_DEFAULT_VERSION=12-lts -e APPSETTING_WEBSITE_NODE_DEFAULT_VERSION=12-lts -e WEBSITE_SITE_NAME=naturins-node-awesome -e WEBSITE_AUTH_ENABLED=False -e WEBSITE_ROLE_INSTANCE_ID=0 -e WEBSITE_HOSTNAME=naturins-node-awesome.azurewebsites.net -e WEBSITE_INSTANCE_ID=2d81217236c12dee3b920ef52d54d0d1a725b7c965cbd7887d87a7ecd1390208 appsvc/node:12-lts  \n\n2020-03-17 18:41:30.920 INFO  - Logging is not enabled for this container.\nPlease use https://aka.ms/linux-diagnostics to enable logging to see container logs here.\n2020-03-17 18:41:33.468 INFO  - Initiating warmup request to container naturins-node-awesome_0_4c5b4271 for site naturins-node-awesome\n2020-03-17 18:41:40.632 INFO  - Container naturins-node-awesome_0_4c5b4271 for site naturins-node-awesome initialized successfully and is ready to serve requests.\n2020-03-17 18:44:59.542 INFO  - Recycling container because of HttpLoggingEnabledChange and httpLoggingEnabled = True\n2020-03-17 18:44:59.632 INFO  - Starting container for site\n2020-03-17 18:44:59.638 INFO  - docker run -d -p 6276:8080 --name naturins-node-awesome_1_22eb643e -e WEBSITE_NODE_DEFAULT_VERSION=12-lts -e APPSETTING_WEBSITE_NODE_DEFAULT_VERSION=12-lts -e WEBSITE_SITE_NAME=naturins-node-awesome -e WEBSITE_AUTH_ENABLED=False -e WEBSITE_ROLE_INSTANCE_ID=0 -e WEBSITE_HOSTNAME=naturins-node-awesome.azurewebsites.net -e WEBSITE_INSTANCE_ID=2d81217236c12dee3b920ef52d54d0d1a725b7c965cbd7887d87a7ecd1390208 -e HTTP_LOGGING_ENABLED=1 appsvc/node:12-lts  \n\n2020-03-17 18:45:05.954 INFO  - Initiating warmup request to container naturins-node-awesome_1_22eb643e for site naturins-node-awesome\n2020-03-17 18:45:21.625 INFO  - Waiting for response to warmup request for container naturins-node-awesome_1_22eb643e. Elapsed time = 15.6711869 sec\n2020-03-17 18:45:31.482 INFO  - Container naturins-node-awesome_1_22eb643e for site naturins-node-awesome initialized successfully and is ready to serve requests.\n2020-03-17 18:46:01.345 INFO  - Starting container for site\n2020-03-17 18:46:01.346 INFO  - docker run -d -p 8041:8080 --name naturins-node-awesome_0_71fd9e17 -e WEBSITE_NODE_DEFAULT_VERSION=12-lts -e APPSETTING_WEBSITE_NODE_DEFAULT_VERSION=12-lts -e WEBSITE_SITE_NAME=naturins-node-awesome -e WEBSITE_AUTH_ENABLED=False -e WEBSITE_ROLE_INSTANCE_ID=0 -e WEBSITE_HOSTNAME=naturins-node-awesome.azurewebsites.net -e WEBSITE_INSTANCE_ID=2d81217236c12dee3b920ef52d54d0d1a725b7c965cbd7887d87a7ecd1390208 -e HTTP_LOGGING_ENABLED=1 appsvc/node:12-lts  \n\n2020-03-17 18:46:04.955 INFO  - Initiating warmup request to container naturins-node-awesome_0_71fd9e17 for site naturins-node-awesome\n2020-03-17 18:46:20.436 INFO  - Container naturins-node-awesome_0_71fd9e17 for site naturins-node-awesome initialized successfully and is ready to serve requests."]]},"renderingProperties":{"enableEmailButtons":false,"isContainerNeeded":true,"type":9,"title":null,"description":null}}]`;

const detectorResponse: detectorResponseJSON = JSON.parse(rawDetectorResponse);
