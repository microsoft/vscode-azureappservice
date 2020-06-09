/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { StringDictionary } from 'azure-arm-website/lib/models';
import { BasicAuthenticationCredentials, ServiceClientCredentials } from 'ms-rest';
import { IAppSettingsClient, IFilesClient } from 'vscode-azureappservice';
import { addExtensionUserAgent } from 'vscode-azureextensionui';
import KuduClient from 'vscode-azurekudu';
import { requestUtils } from '../../utils/requestUtils';
import { ITrialAppMetadata } from './ITrialAppMetadata';

export class TrialAppClient implements IAppSettingsClient, IFilesClient {

    public isFunctionApp: boolean = false;
    public isLinux: boolean = true;
    public metadata: ITrialAppMetadata;

    private _credentials: ServiceClientCredentials;

    private constructor(metadata: ITrialAppMetadata) {
        this.metadata = metadata;
        this._credentials = new BasicAuthenticationCredentials(metadata.publishingUserName, metadata.publishingPassword);
    }

    public static async createTrialAppClient(loginSession: string): Promise<TrialAppClient> {
        const metadataRequest: requestUtils.Request = await requestUtils.getDefaultRequest('https://tryappservice.azure.com/api/vscoderesource', undefined, 'GET');

        metadataRequest.headers = {
            accept: "*/*",
            "accept-language": "en-US,en;q=0.9",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            cookie: `loginsession=${loginSession}`
        };

        const result: string = await requestUtils.sendRequest<string>(metadataRequest);
        const metadata: ITrialAppMetadata = <ITrialAppMetadata>JSON.parse(result);
        return new TrialAppClient(metadata);
    }

    public get fullName(): string {
        return this.metadata.hostName;
    }

    public get id(): string {
        return this.metadata.siteGuid;
    }

    public get kuduUrl(): string | undefined {
        return `https://${this.metadata.scmHostName}`;
    }

    public get defaultHostUrl(): string {
        return `https://${this.fullName}`;
    }

    public async getKuduClient(): Promise<KuduClient> {
        const kuduClient: KuduClient = new KuduClient(this._credentials, this.kuduUrl);
        addExtensionUserAgent(kuduClient);
        return kuduClient;
    }

    public async listApplicationSettings(): Promise<StringDictionary> {
        const kuduClient: KuduClient = await this.getKuduClient();
        const settings: StringDictionary = {};
        settings.properties = <{ [name: string]: string }>await kuduClient.settings.getAll();
        return settings;
    }

    public async updateApplicationSettings(appSettings: StringDictionary): Promise<StringDictionary> {
        const currentSettings: StringDictionary = await this.listApplicationSettings();

        // To handle renaming app settings, we need to delete the old setting.
        // tslint:disable-next-line:strict-boolean-expressions
        const properties: { [name: string]: string } = currentSettings.properties || {};
        await Promise.all(Object.keys(properties).map(async (key: string) => {
            if (appSettings.properties && appSettings.properties[key] === undefined) {
                await this.deleteApplicationSetting(appSettings, key);
            }
        }));

        const request: requestUtils.Request = await requestUtils.getDefaultRequest(`https://${this.metadata.scmHostName}/api/settings`, this._credentials, 'POST');
        request.body = JSON.stringify(appSettings.properties);
        request.headers['Content-Type'] = 'application/json';

        await requestUtils.sendRequest(request);
        return appSettings;
    }

    private async deleteApplicationSetting(appSettings: StringDictionary, key: string): Promise<StringDictionary> {

        const deleteRequest: requestUtils.Request = await requestUtils.getDefaultRequest(`https://${this.metadata.scmHostName}/api/settings/${key}`, this._credentials, 'DELETE');
        deleteRequest.body = JSON.stringify(appSettings.properties);
        deleteRequest.headers['Content-Type'] = 'application/json';

        await requestUtils.sendRequest<string>(deleteRequest);
        return appSettings;
    }
}
