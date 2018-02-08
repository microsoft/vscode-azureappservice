/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IncomingMessage } from 'http';
import * as kuduApi from 'kudu-api';

export type kuduFile = { mime: string, name: string, path: string };
export type webJob = { name: string, Message: string };
export type kuduIncomingMessage = IncomingMessage & { body: string };

/*
    DEPRECATED - Use 'vscode-azureappservice' or 'vscode-azurekudu' npm package instead
*/
export class KuduClient {
    private readonly _api: kuduApi;

    constructor(private webAppName: string, private publishingUserName: string, private publishingPassword: string, private domain?: string) {
        this.domain = domain || "scm.azurewebsites.net";
        this._api = kuduApi({
            website: this.webAppName,
            username: this.publishingUserName,
            password: this.publishingPassword,
            domain: this.domain
        });
    }

    public listAllWebJobs(): Promise<webJob[]> {
        return new Promise<webJob[]>((resolve, reject) => {
            this._api.webjobs.listAll((err, jobList) => {
                if (err) {
                    const errorMessage = [];
                    errorMessage[0] = { name: err.Message };
                    reject(errorMessage);
                } else {
                    resolve(jobList);
                }
            });
        });
    }
}
