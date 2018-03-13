/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Site } from 'azure-arm-website/lib/models';
import * as request from "request";
import { WizardStep } from '../../wizard';
import { LogPointsSessionWizard } from '../LogPointsSessionWizard';

export class ActivateSite extends WizardStep {
    constructor(private _wizard: LogPointsSessionWizard) {
        super(_wizard, 'Send an activation ping to the site root URL.');
    }

    public async prompt(): Promise<void> {
        const site = this._wizard.selectedDeploymentSlot;

        if (!site) {
            throw new Error("There is no pre-selected deployment slot or site.");
        }

        const siteRootUrl = this.getSiteRootUrl(site);

        // Intentionally ignore the response.
        request(siteRootUrl);
    }

    private getSiteRootUrl(site: Site): string {
        // tslint:disable-next-line:no-http-string
        return `http://${site.defaultHostName}`;
    }
}
