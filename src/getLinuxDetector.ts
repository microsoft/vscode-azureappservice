/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RequestOptions } from "http";
import { IncomingMessage, ServiceClientCredentials, WebResource } from "ms-rest";
import * as requestP from 'request-promise';
import { URL } from "url";
import { WebAppTreeItem } from './explorer/WebAppTreeItem';
import { ext } from './extensionVariables';
import { delay } from "./utils/delay";
export async function getLinuxDetector(node: WebAppTreeItem | undefined): Promise<void> {
    if (!node) {
        return;
    }

    const detectorUri: string = `https://management.azure.com/subscriptions/${node.root.subscriptionId}/resourceGroups/${node.root.client.resourceGroup}/providers/Microsoft.Web/sites/${node.root.client.siteName}/detectors/LinuxContainerStartFailure`;
    const requestOptions: WebResource = new WebResource();

    requestOptions.method = 'GET';
    requestOptions.url = detectorUri;
    requestOptions.qs = {
        "api-version": "2015-08-01",
        fId: "1",
        btnId: "2",
        inpId: "1",
        val: "vscode"
    };

    await signRequest(requestOptions, node.root.credentials);

    const requestPromise = <(options: RequestOptions | string | URL) => Promise<IncomingMessage>><Function>requestP;
    let detectorResponseJson = <unknown>(await requestPromise(requestOptions));
    let detectorResponse = JSON.parse(<string>detectorResponseJson);
    let time = detectorResponse.properties.dataset[1].table.rows[0][3];

    const deployResults = await node.root.client.kudu.deployment.getDeployResults();

    do {
        if (Math.abs(new Date(deployResults[0].lastSuccessEndTime).getSecondsBetween(new Date(time))) <= 60) {
            await ext.ui.showWarningMessage('SOMETING WOOOONG');
        }

        detectorResponseJson = <unknown>(await requestPromise(requestOptions));
        detectorResponse = JSON.parse(<string>detectorResponseJson);
        time = detectorResponse.properties.dataset[1].table.rows[0][3];
        await delay(6000);
    } while (Math.abs(new Date(deployResults[0].lastSuccessEndTime).getSecondsBetween(new Date(time))) > 60);
}

export async function signRequest(req: WebResource, cred: ServiceClientCredentials): Promise<void> {
    await new Promise((resolve: () => void, reject: (err: Error) => void): void => {
        cred.signRequest(req, (err: Error | undefined) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}
