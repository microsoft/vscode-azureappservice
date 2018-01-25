/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as kuduApi from 'kudu-api';
import * as request from 'request';
import { IncomingMessage } from 'http';

export type kuduFile = { mime: string, name: string, path: string };
export type webJob = { name: string, Message: string };
export type kuduIncomingMessage = IncomingMessage & { body: string };

/*
    DEPRECATED - Use 'vscode-azureappservice' or 'vscode-azurekudu' npm package instead
*/
export class KuduClient {
    private readonly _api;

    constructor(private webAppName: string, private publishingUserName: string, private publishingPassword: string, private domain?: string) {
        this.domain = domain || "scm.azurewebsites.net";
        this._api = kuduApi({
            website: webAppName,
            username: publishingUserName,
            password: publishingPassword,
            domain: this.domain
        });
    }

    getFile(path: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            this._api.vfs.getFile(path, (err, body) => {
                if (err) {
                    var errorMessage = [];
                    errorMessage[0] = { name: err.Message };
                    reject(errorMessage);
                    // format error to be processed as a NodeBase
                } else {
                    // if file is not found, kudu returns an Object rather than an array
                    if (body.Message) {
                        body = [{ name: body.Message, path: 'Error' }];
                    }
                    resolve(body);
                }
            });
        });
    }

    listFiles(path: string): Promise<kuduFile[]> {
        return new Promise<kuduFile[]>((resolve, reject) => {
            this._api.vfs.listFiles(path, (err, body) => {
                if (err) {
                    var errorMessage = [];
                    errorMessage[0] = { name: err.Message };
                    reject(errorMessage);
                    // format error to be processed as a NodeBase
                } else {
                    // if file is not found, kudu returns an Object rather than an array
                    if (body.Message) {
                        body = [{ name: body.Message, path: 'Error' }];
                    }
                    resolve(body);
                }
            });
        });
    }
    uploadFile(localPath: string, destPath: string) {
        return new Promise<kuduFile[]>((resolve, reject) => {
            this._api.vfs.uploadFile(localPath, destPath, '*', (err, body) => {
                if (err) {
                    var errorMessage = [];
                    errorMessage[0] = { name: err.Message };
                    reject(errorMessage);
                    // format error to be processed as a NodeBase
                } else {
                    // if file is not found, kudu returns an Object rather than an array
                    if (body.Message) {
                        body = [{ name: body.Message, path: 'Error' }];
                    }
                    resolve(body);
                }
            });
        });
    }

    listAllWebJobs(): Promise<webJob[]> {
        return new Promise<webJob[]>((resolve, reject) => {
            this._api.webjobs.listAll((err, jobList) => {
                if (err) {
                    var errorMessage = [];
                    errorMessage[0] = { name: err.Message };
                    reject(errorMessage);
                } else {
                    resolve(jobList);
                }
            });
        });
    }

    getLogStream(): request.Request {
        const baseUrl = `https://${this.webAppName}.${this.domain}/`;
        const headers = {
            Authorization: 'Basic ' + new Buffer(this.publishingUserName + ':' + this.publishingPassword).toString('base64')
        };
        const r = request.defaults({
            baseUrl: baseUrl,
            headers: headers,
        });
        return r('/api/logstream');
    }
}
