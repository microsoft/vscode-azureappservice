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

     vfsDeleteFile(filePath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this._api.vfs.deleteFile(filePath, err => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
     }

     zipUpload(zipFilePath: string, remoteFolder: string) {
        return new Promise((resolve, reject) => {
            this._api.zip.upload(zipFilePath, remoteFolder, err => { 
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });         
     }
 }