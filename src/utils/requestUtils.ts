/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { HttpMethods, ServiceClientCredentials, WebResource } from "ms-rest";
import * as requestP from 'request-promise';
import { ISiteTreeRoot } from "vscode-azureappservice";
import { appendExtensionUserAgent } from "vscode-azureextensionui";

type queryString = {
    'api-version': string,
    fId: string,
    btnId: string,
    inpId: string,
    val: string,
    startTime: string,
    endTime: string
};

export namespace requestUtils {
    export type Request = WebResource & requestP.RequestPromiseOptions & { qs?: queryString };

    export async function getDefaultRequest(url: string, credentials?: ServiceClientCredentials, method: HttpMethods = 'GET'): Promise<Request> {
        const request: WebResource = new WebResource();
        request.url = url;
        request.method = method;
        request.headers = {
            ['User-Agent']: appendExtensionUserAgent()
        };

        if (credentials) {
            await signRequest(request, credentials);
        }

        return request;
    }

    export async function getDefaultAzureRequest(urlPath: string, root: ISiteTreeRoot, method: HttpMethods = 'GET'): Promise<Request> {
        let baseUrl: string = root.environment.resourceManagerEndpointUrl;
        if (baseUrl.endsWith('/')) {
            baseUrl = baseUrl.slice(0, -1);
        }

        if (!urlPath.startsWith('/')) {
            urlPath = `/${urlPath}`;
        }

        return getDefaultRequest(baseUrl + urlPath, root.credentials, method);
    }

    export async function sendRequest<T>(request: Request): Promise<T> {
        return await <Thenable<T>>requestP(request).promise();
    }

    export async function signRequest(request: Request, cred: ServiceClientCredentials): Promise<void> {
        await new Promise((resolve, reject): void => {
            cred.signRequest(request, (err: Error | undefined) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
}
