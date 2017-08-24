/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export type WizardStatus = 'Prompting' | 'Executing' | 'Completed' | 'Faulted' | 'Cancelled';

export class WizardBase {
    private readonly _steps: WizardStep[] = new Array<WizardStep>();
    private cancelFlag: boolean = false;

    async start(): Promise<WizardResult> {
        // Go through the prompts...
        for (var i = 0; i < this.steps.length; i++) {
            const step = this.steps[i];

            try {
                await this.steps[i].prompt();
            } catch (err) {
                if (err instanceof UserCancelledError) {
                    return {
                        status: 'Cancelled',
                        step: step,
                        error: err
                    };
                }

                return {
                    status: 'Faulted',
                    step: step,
                    error: err
                };
            }
        }

        return {
            status: 'Completed',
            step: this.steps[this.steps.length - 1],
            error: null
        };
    }

    cancel() {
        this.cancelFlag = true;
    }

    get steps(): WizardStep[] {
        return this._steps;
    }

    findStep(predicate: (step: WizardStep) => boolean, errorMessage: string): WizardStep {
        const step = this.steps.find(predicate);
       
        if (!step) {
            throw new Error(errorMessage);
        }

        return step;
    }
}

export interface WizardResult {
    status: WizardStatus;
    step: WizardStep;
    error: Error;
}

export class WizardStep {
    protected constructor(readonly wizard: WizardBase, readonly stepTitle: string) {}

    async prompt(): Promise<void> {}
    async execute(): Promise<void> {}

    get stepIndex(): number {
        return this.wizard.steps.findIndex(step => step === this);
    }

    get stepProgressText(): string {
        return `Step ${this.stepIndex + 1}/${this.wizard.steps.length}`;
    }

    async showQuickPick(items: vscode.QuickPickItem[], options: vscode.QuickPickOptions, token?: vscode.CancellationToken): Promise<vscode.QuickPickItem> {
        const result = await vscode.window.showQuickPick(items, options, token);

        if (!result) {
            throw new UserCancelledError();
        }

        return result;
    }

    async showInputBox(options?: vscode.InputBoxOptions, token?: vscode.CancellationToken): Promise<string> {
        const result = await vscode.window.showInputBox(options, token);

        if (!result) {
            throw new UserCancelledError();
        }

        return result;
    }
}

export class UserCancelledError extends Error {}