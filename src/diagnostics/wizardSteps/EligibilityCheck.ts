import { SiteConfigResource } from 'azure-arm-website/lib/models';
import * as vscode from 'vscode';
import { WizardStep } from '../../wizard';
import { LogPointsSessionWizard } from '../LogPointsSessionWizard';
import { extensionPrefix } from '../../constants';

export class EligibilityCheck extends WizardStep {
    constructor(private _wizard: LogPointsSessionWizard) {
        super(_wizard, 'Decide the app service eligibility for logpoints.');
    }

    public async prompt(): Promise<void> {
        const site = this._wizard.site;

        const kind = site.kind;

        if (!/(^|,)linux($|,)/.test(kind)) {
            throw new Error('Only Linux App Services are supported');
        }

        const siteClient = this._wizard.websiteManagementClient;

        const config: SiteConfigResource = await siteClient.webApps.getConfiguration(site.resourceGroup, site.name);

        const linuxFxVersion = config.linuxFxVersion;

        if (!linuxFxVersion) {
            throw new Error('Cannot read "linuxFxVersion"');
        }

        const [framework, fullImageName] = linuxFxVersion.split('|');
        // Remove the 'tag' portion of the image name.
        const imageName = fullImageName.split(':')[0];
        const enabledImages = vscode.workspace.getConfiguration(extensionPrefix).get<string[]>('enabledDockerImages') || [];
        const enabledImagesTagless = enabledImages.map((name) => {
            return name.split(':')[0].toLocaleLowerCase();
        });

        if ('docker' !== framework.toLocaleLowerCase() || enabledImagesTagless.indexOf(imageName.toLocaleLowerCase()) === -1) {
            throw new Error(`Please use one of the supported docker image. ${imageName} is not supported for starting a Logpoints session. More details can be found here - https://aka.ms/logpoints`);
        }
    }
}
