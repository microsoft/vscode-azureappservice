/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { UserCancelledError } from 'vscode-azureextensionui';
import { WizardFailedError } from './errors';
import * as util from './util';

export type WizardStatus = 'PromptCompleted' | 'Completed' | 'Faulted' | 'Cancelled';

export abstract class WizardBase {
    public readonly output: vscode.OutputChannel;
    private readonly _steps: WizardStep[] = [];
    private _result: IWizardResult;

    protected constructor(output: vscode.OutputChannel) {
        this.output = output;
    }

    public write(text: string): void {
        this.output.append(text);
    }

    public writeline(text: string): void {
        this.output.appendLine(text);
    }

    protected abstract initSteps(): void;

    public async run(promptOnly: boolean = false): Promise<IWizardResult> {
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

    public async execute(): Promise<IWizardResult> {
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

    public findStepOfType<T extends WizardStep>(stepTypeConstructor: { new(...args: {}[]): T }, isOptional?: boolean): T {
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

    protected onError(err: Error, step: WizardStep): void {
        if (err instanceof UserCancelledError) {
            throw err;
        }

        throw new WizardFailedError(err, step.telemetryStepTitle, step.stepIndex);
    }

    protected beforeExecute(_step: WizardStep, _stepIndex: number): void {
        return;
    }
}

export interface IWizardResult {
    status: WizardStatus;
    step: WizardStep;
    error: Error | null;
}

export class WizardStep {
    public readonly telemetryStepTitle: string;
    protected readonly wizard: WizardBase;
    private persistenceState?: vscode.Memento;
    protected constructor(wizard: WizardBase, telemetryStepTitle: string, persistenceState?: vscode.Memento) {
        this.wizard = wizard;
        this.telemetryStepTitle = telemetryStepTitle;
        this.persistenceState = persistenceState;
    }

    public async prompt(): Promise<void> {
        return;
    }
    public async execute(): Promise<void> {
        return;
    }

    get stepIndex(): number {
        return this.wizard.steps.findIndex(step => step === this);
    }

    get stepProgressText(): string {
        return `Step ${this.stepIndex + 1}/${this.wizard.steps.length}`;
    }

    public async showQuickPick<T>(items: util.IQuickPickItemWithData<T>[] | Thenable<util.IQuickPickItemWithData<T>[]>,
        options: vscode.QuickPickOptions,
        persistenceKey?: string,
        token?: vscode.CancellationToken): Promise<util.IQuickPickItemWithData<T>> {
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

export interface IQuickPickItemWithData<T> extends vscode.QuickPickItem {
    persistenceId?: string; // A unique key to identify this item items across sessions, used in persisting previous selections
    data?: T;
}
