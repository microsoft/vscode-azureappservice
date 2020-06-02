/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RequestError } from 'request-promise/errors';
import { AzExtTreeItem, IActionContext } from 'vscode-azureextensionui';
import { localize } from '../../localize';
import { openUrl } from '../../utils/openUrl';
import { requestUtils } from '../../utils/requestUtils';
import { AzureAccountTreeItem } from '../AzureAccountTreeItem';
import { ISiteTreeItem } from '../ISiteTreeItem';
import { SiteTreeItemBase } from '../SiteTreeItemBase';
import { ITrialAppMetadata } from './ITrialAppMetadata';

export class TrialAppTreeItem extends SiteTreeItemBase implements ISiteTreeItem {
    public static contextValue: string = 'trialApp';
    public contextValue: string = TrialAppTreeItem.contextValue;

    public metadata: ITrialAppMetadata;

    public defaultHostName: string;

    public defaultHostUrl: string;

    private readonly _defaultHostName: string;

    public get label(): string {
        return this.metadata.siteName ? this.metadata.siteName : localize('nodeJsTrialApp', 'NodeJS Trial App');
    }

    private get minutesLeft(): number {
        return (this.metadata.timeLeft / 60);
    }

    public get description(): string {
        return isNaN(this.minutesLeft) ?
            localize('expired', 'Expired') : `${this.minutesLeft.toFixed(0)} ${localize('minutesRemaining', 'min. remaining')}`;
    }

    public get id(): string {
        return `trialApp${this._defaultHostName}`;
    }

    private constructor(parent: AzureAccountTreeItem, metadata: ITrialAppMetadata) {
        super(parent);
        this.metadata = metadata;
        this.defaultHostName = this.metadata.hostName;
        this.defaultHostUrl = `https://${this.defaultHostName}`;
    }

    public static async createTrialAppTreeItem(parent: AzureAccountTreeItem, loginSession: string): Promise<TrialAppTreeItem> {
        const metadata: ITrialAppMetadata = await this.getTrialAppMetaData(loginSession);
        return new TrialAppTreeItem(parent, metadata);
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

        try {
            const result: string = await requestUtils.sendRequest<string>(metadataRequest);
            return <ITrialAppMetadata>JSON.parse(result);
        } catch (e) {
            if (e instanceof RequestError) {
                throw Error(localize('errorMetadataRequest', 'Could not get trial app metadata: RequestError.'));
            } else if (e instanceof SyntaxError) {
                throw Error(localize('errorMetadataParse', 'Could not get trial app metadata. Could not parse response body.'));
            } else {
                throw e;
            }
        }
    }
    public loadMoreChildrenImpl(_clearCache: boolean, _context: IActionContext): Promise<AzExtTreeItem[]> {
        return Promise.resolve([]);
    }
    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public async browse(): Promise<void> {
        await openUrl(this.defaultHostUrl);
    }

    public async refreshImpl(): Promise<void> {
        this.metadata = await TrialAppTreeItem.getTrialAppMetaData(this.metadata.loginSession);
    }

    public isAncestorOfImpl?(_contextValue: string | RegExp): boolean {
        return _contextValue === TrialAppTreeItem.contextValue;
    }
}
