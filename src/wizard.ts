/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SubscriptionModels } from 'azure-arm-resource';
import { Subscription } from 'azure-arm-resource/lib/subscription/models';
import * as vscode from 'vscode';
import { AzureAccount } from './azure-account.api';
import { AzureAccountWrapper } from './AzureAccountWrapper';
import { UserCancelledError, WizardFailedError } from './errors';

export type WizardStatus = 'PromptCompleted' | 'Completed' | 'Faulted' | 'Cancelled';

export abstract class WizardBase {
    protected readonly output: vscode.OutputChannel;
    private readonly _steps: WizardStep[] = [];
    private _result: IWizardResult;

    protected constructor(output: vscode.OutputChannel) {
        this.output = output;
    }

    protected abstract initSteps(): void;

    protected async run(promptOnly: boolean = false): Promise<IWizardResult> {
        this.initSteps();

        // Go through the prompts...
        for (const step of this.steps) {
            try {
                await step.prompt();
            } catch (err) {
                this.onError(err, step);
            }
        }

        if (promptOnly) {
            return {
                status: 'PromptCompleted',
                step: this.steps[this.steps.length - 1],
                error: null
            };
        }

        return this.execute();
    }

    protected async execute(): Promise<IWizardResult> {
        // Execute each step...
        this.output.show(true);
        for (let i = 0; i < this.steps.length; i++) {
            const step = this.steps[i];

            try {
                this.beforeExecute(step, i);
                await this.steps[i].execute();
            } catch (err) {
                this.onError(err, step);
            }
        }

        this._result = {
            status: 'Completed',
            step: this.steps[this.steps.length - 1],
            error: null
        };

        return this._result;
    }

    get steps(): WizardStep[] {
        return this._steps;
    }

    protected findStepOfType<T extends WizardStep>(stepTypeConstructor: { new(...args: {}[]): T }, isOptional?: boolean): T {
        return <T>this.findStep(
            step => step instanceof stepTypeConstructor,
            isOptional ? null : `The Wizard should have had a ${stepTypeConstructor.name} step`);
    }

    protected findStep(predicate: (step: WizardStep) => boolean, errorMessage?: string): WizardStep {
        const step = this.steps.find(predicate);

        if (!step && errorMessage) {
            throw new Error(errorMessage);
        }

        return step;
    }

    protected write(text: string): void {
        this.output.append(text);
    }

    protected writeline(text: string): void {
        this.output.appendLine(text);
    }

    protected onError(err: Error, step: WizardStep): void {
        if (err instanceof UserCancelledError) {
            throw err;
        }

        this.writeline(`Error: ${err.message}`);
        this.writeline('');
        throw new WizardFailedError(err, step.telemetryStepTitle, step.stepIndex);
    }

    protected abstract beforeExecute(step?: WizardStep, stepIndex?: number): void;
}

export interface IWizardResult {
    status: WizardStatus;
    step: WizardStep;
    error: Error | null;
}

export abstract class WizardStep {
    protected readonly wizard: WizardBase;
    protected readonly telemetryStepTitle: string;
    private persistenceState?: vscode.Memento;
    protected constructor(wizard: WizardBase, telemetryStepTitle: string, persistenceState?: vscode.Memento) {
        this.wizard = wizard;
        this.telemetryStepTitle = telemetryStepTitle;
        this.persistenceState = persistenceState;
    }

    public abstract async prompt(): Promise<void>;
    public abstract async execute(): Promise<void>;

    get stepIndex(): number {
        return this.wizard.steps.findIndex(step => step === this);
    }

    get stepProgressText(): string {
        return `Step ${this.stepIndex + 1}/${this.wizard.steps.length}`;
    }

    public async showQuickPick<T>(items: IQuickPickItemWithData<T>[] | Thenable<IQuickPickItemWithData<T>[]>, options: vscode.QuickPickOptions, persistenceKey?: string, token?: vscode.CancellationToken): Promise<IQuickPickItemWithData<T>> {
        options.ignoreFocusOut = true;
        let resolvedItems = await items;
        if (this.persistenceState && persistenceKey) {
            // See if the previous value selected by the user is in this list, and move it to the top as default
            const previousId = this.persistenceState.get(persistenceKey);
            const previousItem = previousId && resolvedItems.find(item => item.persistenceId === previousId);
            if (previousItem) {
                resolvedItems = ([previousItem]).concat(resolvedItems.filter(item => item !== previousItem));
            }
        }

        const result = await vscode.window.showQuickPick(resolvedItems, options, token);
        if (!result) {
            throw new UserCancelledError();
        }

        if (this.persistenceState && persistenceKey) {
            this.persistenceState.update(persistenceKey, result.persistenceId);
        }

        return result;
    }

    public async showInputBox(options?: vscode.InputBoxOptions, token?: vscode.CancellationToken): Promise<string> {
        options.ignoreFocusOut = true;
        const result = await vscode.window.showInputBox(options, token);

        if (!result) {
            throw new UserCancelledError();
        }

        return result;
    }
}

export class SubscriptionStepBase extends WizardStep {
    private readonly azureAccount: AzureAccountWrapper;

    constructor(wizard: WizardBase, title: string, azureAccount: AzureAccountWrapper, subscription?: SubscriptionModels.Subscription, persistence?: vscode.Memento) {
        super(wizard, title, persistence);
        this.azureAccount = azureAccount;
        this.subscription = subscription;
    }

    protected getSubscriptionsAsQuickPickItems(): Promise<IQuickPickItemWithData<SubscriptionModels.Subscription>[]> {
        return Promise.resolve(
            this.azureAccount.getFilteredSubscriptions().map(s => {
                return {
                    persistenceId: s.subscriptionId,
                    label: s.displayName,
                    description: '',
                    detail: s.subscriptionId,
                    data: s
                };
            })
        );
    }

    get subscription(): SubscriptionModels.Subscription {
        return this.subscription;
    }

    set subscription(subscription: SubscriptionModels.Subscription) {
        this.subscription = subscription;
    }
}

export interface IQuickPickItemWithData<T> extends vscode.QuickPickItem {
    persistenceId?: string; // A unique key to identify this item items across sessions, used in persisting previous selections
    data?: T;
}
