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

     vfsList(directoryPath: string): Promise<Array<any>> {
        return new Promise((resolve, reject) => {
            this._api.vfs.listFiles(directoryPath, (err, body, response) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (response.statusCode !== 200) {
                    reject(new Error(`${response.statusCode}: ${body}`));
                    return;
                }

                resolve(<Array<any>>body);
            });
        });
     }

     async vfsEmptyDirectory(directoryPath: string): Promise<void> {
        const list = await this.vfsList(directoryPath);

        for (let i = 0; i < list.length; i++) {
            const element = list[i];
            const path = this.removeHomeFromPath(element.path);
            
            if (element.mime === 'inode/directory') {
                console.log('Deleting folder: ' + path);
                await this.vfsEmptyDirectory(path);
                await this.vfsDeleteDirectory(path);
            } else {
                console.log('Deleting file: ' + path);
                await this.vfsDeleteFile(path);
            }
        }
     }

     vfsDeleteDirectory(directoryPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this._api.vfs.deleteDirectory(directoryPath, (err, body, response) => {
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

     vfsDeleteFile(filePath: string): Promise<void> {
         return new Promise((resolve, reject) => {
             this._api.vfs.deleteFile(filePath, (err, body, response) => {
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
         })
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