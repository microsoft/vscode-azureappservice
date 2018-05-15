/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { TelemetryProperties, UserCancelledError } from 'vscode-azureextensionui';
import * as util from './util';

export type WizardStatus = 'PromptCompleted' | 'Completed' | 'Faulted' | 'Cancelled';

export abstract class WizardBase {
    public readonly output: vscode.OutputChannel;
    private readonly _steps: WizardStep[] = [];
    private _result: IWizardResult;
    private _telemetryProperties: TelemetryProperties;

    protected constructor(output: vscode.OutputChannel) {
        this.output = output;
    }

    public write(text: string): void {
        this.output.append(text);
    }

    public writeline(text: string): void {
        this.output.appendLine(text);
    }

    public async run(properties: TelemetryProperties, promptOnly: boolean = false): Promise<IWizardResult> {
        this._telemetryProperties = properties;
        this.initSteps();

        // Go through the prompts...
        for (const step of this.steps) {
            try {
                await step.prompt();
            } catch (err) {
                this.onError(<Error>err, step);
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
                this.onError(<Error>err, step);
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
            isOptional ? undefined : `The Wizard should have had a ${stepTypeConstructor.name} step`);
    }

    protected abstract initSteps(): void;

    protected findStep(predicate: (step: WizardStep) => boolean, errorMessage?: string): WizardStep | undefined {
        const step = this.steps.find(predicate);

        if (!step && errorMessage) {
            throw new Error(errorMessage);
        }

        return step;
    }

    protected cancel(step: WizardStep): void {
        this._telemetryProperties.stepTitle = step.telemetryStepTitle;
        this._telemetryProperties.stepIndex = step.stepIndex.toString();
        throw new UserCancelledError();
    }

    protected onError(err: Error, step: WizardStep): void {
        this._telemetryProperties.stepTitle = step.telemetryStepTitle;
        this._telemetryProperties.stepIndex = step.stepIndex.toString();
        throw err;
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

    public async showQuickPick<T>(
        items: util.IQuickPickItemWithData<T>[] | Thenable<util.IQuickPickItemWithData<T>[]>,
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
}

export interface IQuickPickItemWithData<T> extends vscode.QuickPickItem {
    persistenceId?: string; // A unique key to identify this item items across sessions, used in persisting previous selections
    data?: T;
}
