import { SiteConfigResource } from 'azure-arm-website/lib/models';
import * as vscode from 'vscode';
import { WizardStep } from '../../wizard';
import { LogPointsSessionWizard } from '../LogPointsSessionWizard';

export class EligibilityCheck extends WizardStep {
    constructor(private _wizard: LogPointsSessionWizard) {
        super(_wizard, 'Decide the app service eligibility for logpoints.');
    }

    public async prompt(): Promise<void> {
        const site = this._wizard.site;

        const kind = site.kind;

        if (!/linux$/.test(kind)) {
            throw new Error('Only Linux App Services are suppored');
        }

        const siteClient = this._wizard.websiteManagementClient;

        const config: SiteConfigResource = await siteClient.webApps.getConfiguration(site.resourceGroup, site.name);

        const linuxFxVersion = config.linuxFxVersion;

        if (!linuxFxVersion) {
            throw new Error('Cannot read "linuxFxVersion"');
        }

        const [framework, imageName] = linuxFxVersion.split('|');
        const enabledImages = vscode.workspace.getConfiguration('appService').get<string[]>('enabledDockerImages');

        if ('docker' !== framework.toLocaleLowerCase() || enabledImages.indexOf(imageName.toLocaleLowerCase()) === -1) {
            throw new Error(`Please use one of the supported docker image. The ${framework}|${imageName} combination is not supported`);
        }
    }
}
