/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as kuduApi from 'kudu-api';

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

    vfsEmptyDirectory(directoryPath: string): Promise<void> {
        const cmd = `rm -r ${directoryPath}`;
        return this.cmdExecute(cmd, '/');
    }

    cmdExecute(command: string, remotePath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this._api.command.exec(command, remotePath, (err, body, response) => {
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

    private removeHomeFromPath(path: string): string {
         return path.substring('/home/'.length);
    }
 }