import * as opn from 'opn';
import { window } from 'vscode';

export class UserCancelledError extends Error { }
export class GitNotInstalledError extends Error {
    constructor() {
        super();
        this.showInstallPrompt();
    }

    public async showInstallPrompt(): Promise<void> {
        const installString = 'Install';
        const input = await window.showErrorMessage('Git must be installed to use Local Git Deploy.', installString);
        if (input === 'Install') {
            opn('https://git-scm.com/downloads');
        }
    }
}

export class LocalGitDeployError extends Error {
    public readonly servicePlanSize: string;
    constructor(error: Error, servicePlanSize: string) {
        super();
        this.message = error.message;
        this.servicePlanSize = servicePlanSize;
    }
}

// tslint:disable-next-line:max-classes-per-file
export class WizardFailedError extends Error {
    public readonly stepTitle: string;
    public readonly stepIndex: number;
    constructor(error: Error, stepTitle: string, stepIndex: number) {
        super();
        this.message = error.message;
        this.stepTitle = stepTitle;
        this.stepIndex = stepIndex;
    }
}
