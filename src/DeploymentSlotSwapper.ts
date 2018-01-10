/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IAzureNode } from 'vscode-azureextensionui';
import { DeploymentSlotTreeItem } from './explorer/DeploymentSlotTreeItem';
import { SwapStep } from './SwapStep';
import { WizardBase } from './wizard';

export class DeploymentSlotSwapper extends WizardBase {
    private readonly slot: IAzureNode<DeploymentSlotTreeItem>;

    constructor(output: vscode.OutputChannel, slot: IAzureNode<DeploymentSlotTreeItem>) {
        super(output);
        this.slot = slot;
    }

    protected initSteps(): void {
        this.steps.push(new SwapStep(this, this.slot));
    }

    protected beforeExecute(): void {
        this.writeline('Initializing deployment swap...');
    }
}
