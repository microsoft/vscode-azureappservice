/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import WebSiteManagementClient from 'azure-arm-website';
import { AppServicePlan } from 'azure-arm-website/lib/models';
import * as fse from 'fs-extra';
import * as path from 'path';
import { Uri, workspace, WorkspaceConfiguration, MessageItem, ConfigurationTarget } from 'vscode';
import { AppServicePlanNameStep, IAppServiceWizardContext, LinuxRuntimes, WebsiteOS } from 'vscode-azureappservice';
import { ext } from 'vscode-azureappservice/out/src/extensionVariables';
import { createAzureClient, LocationListStep, DialogResponses, UserCancelledError } from 'vscode-azureextensionui';
import { configurationSettings, extensionPrefix, turnOnAdvancedCreation } from '../constants';
import { javaUtils } from '../utils/javaUtils';
import { nonNullProp } from '../utils/nonNull';

export async function setAppWizardContextDefault(wizardContext: IAppServiceWizardContext): Promise<void> {
    const isJavaProject: boolean = await javaUtils.isJavaProject();

    if (isJavaProject) {
        wizardContext.recommendedSiteRuntime = [
            LinuxRuntimes.java,
            LinuxRuntimes.tomcat,
            LinuxRuntimes.wildfly
        ];

        // considering high resource requirement for Java applications, a higher plan sku is set here
        wizardContext.newPlanSku = { name: 'P1v2', tier: 'PremiumV2', size: 'P1v2', family: 'P', capacity: 1 };
        // to avoid 'Requested features are not supported in region' error
        await LocationListStep.setLocation(wizardContext, 'weseteurope');
    }

    // only detect if one workspace is opened
    if (workspace.workspaceFolders && workspace.workspaceFolders.length === 1) {
        const fsPath: string = workspace.workspaceFolders[0].uri.fsPath;
        if (await fse.pathExists(path.join(fsPath, 'package.json'))) {
            wizardContext.recommendedSiteRuntime = [LinuxRuntimes.node];
        } else if (await fse.pathExists(path.join(fsPath, 'requirements.txt'))) {
            // requirements.txt are used to pip install so a good way to determine it's a Python app
            wizardContext.recommendedSiteRuntime = [LinuxRuntimes.python];
        }
    }

    const workspaceConfig: WorkspaceConfiguration = workspace.getConfiguration(extensionPrefix);
    const advancedCreation: boolean | undefined = workspaceConfig.get(configurationSettings.advancedCreation);
    if (!advancedCreation) {
        if (!wizardContext.location) {
            await LocationListStep.setLocation(wizardContext, 'centralus');
        }

        if (!wizardContext.newPlanSku) {
            // don't overwrite the planSku if it is already set
            wizardContext.newPlanSku = { name: 'F1', tier: 'Free', size: 'F1', family: 'F', capacity: 1 };
        }

        // if we are recommending a runtime, then it is either Nodejs, Python, or Java which all use Linux
        if (wizardContext.recommendedSiteRuntime) {
            wizardContext.newSiteOS = WebsiteOS.linux;
        } else {
            await workspace.findFiles('*.csproj').then((files: Uri[]) => {
                if (files.length > 0) {
                    wizardContext.newSiteOS = WebsiteOS.windows;
                }
            });
        }
    }
}

export async function getAsp(wizardContext: IAppServiceWizardContext, newName: string): Promise<AppServicePlan | null> {
    const client: WebSiteManagementClient = createAzureClient(wizardContext, WebSiteManagementClient);
    return await client.appServicePlans.get(wizardContext.newResourceGroupName!, newName);
}


export function checkAspHasMoreThan3Sites(asp: AppServicePlan | null): boolean {
    if (asp && asp.numberOfSites && asp.numberOfSites >= 3) {
        const tier: string | undefined = asp && asp.sku && asp.sku.tier;
        if (tier && /^(basic|free)$/i.test(tier)) {
            return true;
        }
    }
    return false;
}

export function checkIfLinux(asp: AppServicePlan | null): boolean {
    return !!asp && !!asp.kind && asp.kind.toLowerCase().includes('linux');
}

export async function showPromptAboutPerf(asp: AppServicePlan): Promise<void> {
    const numberOfSites: number = nonNullProp(asp, 'numberOfSites');
    const createAnyway: MessageItem = { title: 'Create anyway' };
    const inputs: MessageItem[] = [createAnyway, turnOnAdvancedCreation, DialogResponses.dontWarnAgain]
    const input: MessageItem = await ext.ui.showWarningMessage(`The selected plan currently has ${numberOfSites} apps. Deploying additional apps may degrade the performance on the apps in the plan.`, { modal: true }, ...inputs);
    const workspaceConfig: WorkspaceConfiguration = workspace.getConfiguration(extensionPrefix);

    if (input === turnOnAdvancedCreation) {
        await workspaceConfig.update('advancedCreation', true, ConfigurationTarget.Global);
        throw new UserCancelledError();
    } else if (input === DialogResponses.dontWarnAgain) {
        workspaceConfig.update(configurationSettings.showASPPerfWarning, false);
    }
}

export async function getRelatedName(wizardContext: IAppServiceWizardContext, defaultName: string): Promise<string | undefined> {
    const minLength: number = 1;
    const maxLength: number = 40;

    const maxTries: number = 100;
    let count: number = 1;
    let newName: string;
    while (count < maxTries) {
        newName = generateSuffixedName(defaultName, count, minLength, maxLength);
        if (await validatePlanName(wizardContext, newName)) {
            const asp: AppServicePlan | null = await getAsp(wizardContext, newName);
            if (!asp || asp.numberOfSites && asp.numberOfSites < 3) {
                return newName;
            }
        }
        count += 1;
    }

    return undefined;
}

function generateSuffixedName(preferredName: string, i: number, minLength: number, maxLength: number): string {
    const suffix: string = i === 1 ? '' : i.toString();
    const minUnsuffixedLength: number = minLength - suffix.length;
    const maxUnsuffixedLength: number = maxLength - suffix.length;

    let unsuffixedName: string = preferredName;
    if (unsuffixedName.length > maxUnsuffixedLength) {
        unsuffixedName = preferredName.slice(0, maxUnsuffixedLength);
    } else {
        while (unsuffixedName.length < minUnsuffixedLength) {
            unsuffixedName += preferredName;
        }
    }

    return `${unsuffixedName}${suffix.length > 0 ? '_' : ''}${suffix}`;
}

async function validatePlanName(wizardContext: IAppServiceWizardContext, name: string): Promise<boolean> {
    return await new AppServicePlanNameStep().validatePlanName(wizardContext, name) === undefined;
}

// when creating a new web app...
// first check workspace setting to see if never warn again is enabled
// check to see if default plan has 3 sites
// if it does, check if it is linux or windows
// if linux, prompt user about performance
// if windows, keep cycling through the asp default plan names until one without 3 apps is found
// create app in that plan name
// if can't find one, then prompt user
