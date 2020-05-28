/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtParentTreeItem, AzExtTreeItem, TreeItemIconPath } from 'vscode-azureextensionui';
import { localize } from '../../localize';
import { getIconPath } from '../../utils/pathUtils';
import { ITrialAppMetadata } from './ITrialAppMetadata';

export abstract class TrialAppTreeItemBase extends AzExtTreeItem {

    public get iconPath(): TreeItemIconPath {
        return getIconPath('WebApp');
    }

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

    public abstract metadata: ITrialAppMetadata;

    private readonly _defaultHostName: string;

    public constructor(parent: AzExtParentTreeItem, defaultHostName: string) {
        super(parent);
        this._defaultHostName = defaultHostName;
    }
}
