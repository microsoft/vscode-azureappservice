/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as kuduApi from 'kudu-api';

export type kuduFile = { mime: string, name: string, path: string };
export type webJob = { name: string, Message: string };

export class KuduClient {
    private readonly _api;

    constructor(webAppName: string, publishingUserName: string, publishingPassword: string, domain?: string) {
        this._api = kuduApi({
            website: webAppName,
            username: publishingUserName,
            password: publishingPassword,
            domain: domain
        });
    }

    async vfsEmptyDirectory(directoryPath: string): Promise<void> {
        const cmd = `rm -r ${directoryPath}`;
        await this.cmdExecute(cmd, '/');
    }

    cmdExecute(command: string, remotePath: string): Promise<CommandResult> {
        return new Promise<CommandResult>((resolve, reject) => {
            this._api.command.exec(command, remotePath, (err, body, response) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (response.statusCode !== 200) {
                    reject(new Error(`${response.statusCode}: ${body}`));
                    return;
                }

                resolve({
                    Error: body.Error,
                    ExitCode: body.ExitCode,
                    Output: body.Output
                });
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

    zipUpload(zipFilePath: string, remoteFolder: string) {
        return new Promise((resolve, reject) => {
            this._api.zip.upload(zipFilePath, remoteFolder, (err, body, response) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (response.statusCode !== 200) {
                    reject(new Error(`${response.statusCode}: ${body}`));
                    return;
                }

                resolve();
            });
        });
    }
}

export interface CommandResult {
    Error: string,
    ExitCode: number,
    Output: string
}