/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { BasicAuthenticationCredentials, ServiceClientCredentials } from 'ms-rest';
import { IFilesClient } from 'vscode-azureappservice';
import { addExtensionUserAgent } from 'vscode-azureextensionui';
import KuduClient from 'vscode-azurekudu';
import { requestUtils } from '../../utils/requestUtils';
import { ITrialAppMetadata } from './ITrialAppMetadata';

export class TrialAppClient implements IFilesClient {

    public isFunctionApp: boolean = false;
    public metadata: ITrialAppMetadata;

    private credentials: ServiceClientCredentials;

    private constructor(metadata: ITrialAppMetadata) {
        this.metadata = metadata;
        this.credentials = new BasicAuthenticationCredentials(metadata.publishingUserName, metadata.publishingPassword);
    }

    public static async createTrialAppClient(loginSession: string): Promise<TrialAppClient> {
        const metadata: ITrialAppMetadata = await this.getTrialAppMetaData(loginSession);
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

    public get defaultHostName(): string {
        return this.metadata.hostName;
    }

    public get defaultHostUrl(): string {
        return `https://${this.metadata.hostName}`;
    }

    public static async getTrialAppMetaData(loginSession: string): Promise<ITrialAppMetadata> {
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
        return <ITrialAppMetadata>JSON.parse(result);
    }

    public async getKuduClient(): Promise<KuduClient> {
        const kuduClient: KuduClient = new KuduClient(this.credentials, this.kuduUrl);
        addExtensionUserAgent(kuduClient);
        return kuduClient;
    }
}
