/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { WebSiteManagementModels } from '@azure/arm-appservice';
import { BasicAuthenticationCredentials, HttpOperationResponse, ServiceClient, ServiceClientCredentials } from '@azure/ms-rest-js';
import { ISimplifiedSiteClient } from 'vscode-azureappservice';
import { ScmType } from 'vscode-azureappservice/out/src/ScmType';
import { appendExtensionUserAgent, createGenericClient } from 'vscode-azureextensionui';
import { KuduClient } from 'vscode-azurekudu';
import { ITrialAppMetadata } from './ITrialAppMetadata';

export class TrialAppClient implements ISimplifiedSiteClient {
    public isFunctionApp: boolean = false;
    public isLinux: boolean = true;
    public metadata: ITrialAppMetadata;

    private _credentials: ServiceClientCredentials;

    private constructor(metadata: ITrialAppMetadata) {
        this.metadata = metadata;
        this._credentials = new BasicAuthenticationCredentials(metadata.publishingUserName, metadata.publishingPassword);
    }

    public static async createTrialAppClient(loginSession: string): Promise<TrialAppClient> {
        const client: ServiceClient = await createGenericClient();
        const url: string = 'https://tryappservice.azure.com/api/vscoderesource';
        const headers: { [key: string]: string } = {
            accept: "*/*",
            "accept-language": "en-US,en;q=0.9",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            cookie: `loginsession=${loginSession}`
        };
        const response: HttpOperationResponse = await client.sendRequest({ method: 'GET', url, headers });
        const metadata: ITrialAppMetadata = <ITrialAppMetadata>response.parsedBody;
        return new TrialAppClient(metadata);
    }

    public get isExpired(): boolean {
        return isNaN(this.metadata.timeLeft);
    }

    public get fullName(): string {
        return this.metadata.siteName;
    }

    public get id(): string {
        return this.metadata.siteGuid;
    }

    public get kuduUrl(): string | undefined {
        return `https://${this.metadata.scmHostName}`;
    }

    public get defaultHostUrl(): string {
        return this.metadata.url;
    }

    public get gitUrl(): string {
        return this.metadata.gitUrl.split('@')[1];
    }

    public async getWebAppPublishCredential(): Promise<WebSiteManagementModels.User> {
        return { publishingUserName: this.metadata.publishingUserName, publishingPassword: this.metadata.publishingPassword };
    }

    public async getSiteConfig(): Promise<WebSiteManagementModels.SiteConfigResource> {
        return { scmType: ScmType.LocalGit };
    }

    public async getSourceControl(): Promise<WebSiteManagementModels.SiteSourceControl> {
        // Not relevant for trial apps.
        return {};
    }

    public async getKuduClient(): Promise<KuduClient> {
        return new KuduClient(this._credentials, {
            baseUri: this.kuduUrl,
            userAgent: appendExtensionUserAgent
        });
    }

    public async listApplicationSettings(): Promise<WebSiteManagementModels.StringDictionary> {
        const kuduClient: KuduClient = await this.getKuduClient();
        const settings: WebSiteManagementModels.StringDictionary = {};
        settings.properties = <{ [name: string]: string }>(await kuduClient.settings.getAll()).body;
        return settings;
    }

    public async updateApplicationSettings(appSettings: WebSiteManagementModels.StringDictionary): Promise<WebSiteManagementModels.StringDictionary> {
        const currentSettings: WebSiteManagementModels.StringDictionary = await this.listApplicationSettings();

        /**
         * We cannot use websiteManagementClient for trial apps since we do not have a subscription. And KuduClient.settings.set was not
         * working for an unknown reason (and is lacking documentation), so we are making our own https requests.
         * Since Azure 'merges' the app settings JSON sent in the request we have to make an explicit call to delete the old app setting when renaming.
         */

        // tslint:disable-next-line:strict-boolean-expressions
        const properties: { [name: string]: string } = currentSettings.properties || {};
        await Promise.all(Object.keys(properties).map(async (key: string) => {
            if (appSettings.properties && appSettings.properties[key] === undefined) {
                await this.deleteApplicationSetting(appSettings, key);
            }
        }));

        const client: ServiceClient = await createGenericClient(this._credentials);
        const url: string = `https://${this.metadata.scmHostName}/api/settings`;
        await client.sendRequest({ method: 'POST', url, body: appSettings.properties, headers: { 'Content-Type': 'application/json' } });
        return appSettings;
    }

    private async deleteApplicationSetting(appSettings: WebSiteManagementModels.StringDictionary, key: string): Promise<WebSiteManagementModels.StringDictionary> {
        const client: ServiceClient = await createGenericClient(this._credentials);
        const url: string = `https://${this.metadata.scmHostName}/api/settings/${key}`;
        await client.sendRequest({ method: 'DELETE', url, body: appSettings.properties, headers: { 'Content-Type': 'application/json' } });
        return appSettings;
    }
}
