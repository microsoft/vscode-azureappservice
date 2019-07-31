/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteConfigResource } from 'azure-arm-website/lib/models';
import { WizardStep } from '../../wizard';
import { LogPointsSessionWizard } from '../LogPointsSessionWizard';
import { getGlobalSetting } from '../../vsCodeConfig/settings';

export class EligibilityCheck extends WizardStep {
    constructor(private _wizard: LogPointsSessionWizard) {
        super(_wizard, 'Decide the app service eligibility for logpoints.');
    }

    public async prompt(): Promise<void> {
        if (!/(^|,)linux($|,)/.test(this._wizard.client.kind)) {
            throw new Error('Only Linux App Services are supported');
        }

        const config: SiteConfigResource = await this._wizard.client.getSiteConfig();

        const linuxFxVersion = config.linuxFxVersion;

        if (!linuxFxVersion) {
            throw new Error('Cannot read "linuxFxVersion"');
        }

        const [framework, fullImageName] = linuxFxVersion.split('|');
        // Remove the 'tag' portion of the image name.
        const imageName = fullImageName.split(':')[0];
        const enabledImages = getGlobalSetting<string[]>('enabledDockerImages') || [];
        const enabledImagesTagless = enabledImages.map((name) => {
            return name.split(':')[0].toLocaleLowerCase();
        });

        if ('docker' !== framework.toLocaleLowerCase() || enabledImagesTagless.indexOf(imageName.toLocaleLowerCase()) === -1) {
            throw new Error(`Please use one of the supported docker image. ${imageName} is not supported for starting a Logpoints session. More details can be found here - https://aka.ms/logpoints`);
        }
    }
}
