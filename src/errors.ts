/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export class SiteActionError extends Error {
    public readonly servicePlanSize: string;
    constructor(error: Error, servicePlanSize: string) {
        super();
        this.message = error.message ? error.message : error.toString();
        this.servicePlanSize = servicePlanSize;
    }
}

// tslint:disable-next-line:max-classes-per-file
export class WizardFailedError extends Error {
    public readonly stepTitle: string;
    public readonly stepIndex: number;
    constructor(error: Error, stepTitle: string, stepIndex: number) {
        super();
        this.message = error.message ? error.message : error.toString();
        this.stepTitle = stepTitle;
        this.stepIndex = stepIndex;
    }
}
