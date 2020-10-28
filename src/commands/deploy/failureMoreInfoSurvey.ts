/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementModels } from '@azure/arm-appservice';
import { env, MessageItem, Uri, window } from 'vscode';
import * as appservice from 'vscode-azureappservice';
import { DialogResponses, IParsedError } from 'vscode-azureextensionui';
import { localize } from "../../localize";

const SURVEY_URL: string = 'https://aka.ms/AppServiceExtDeploymentFeedback';

function shouldPromptForSurvey(error: IParsedError, siteConfig: WebSiteManagementModels.SiteConfigResource): string | null {
    if (siteConfig.linuxFxVersion && siteConfig.linuxFxVersion.toLowerCase().startsWith(appservice.LinuxRuntimes.python)) {
        if (error.errorType === 'Error') {
            const msg: string = error.message.toLowerCase();
            if (msg.indexOf("the service is unavailable") >= 0) {
                return "python-serviceunavailable";
            }
            if (msg.indexOf("unknown error") >= 0) {
                return "python-unknown";
            }
            if (msg.search(/exceeded the limit.+free tier/) >= 0) {
                return "python-freetierlimit";
            }
            if (msg.indexOf("oryx") >= 0) {
                return "python-oryx";
            }
            if (msg.search(/deployment.+in progress.+try again/) >= 0) {
                return "python-alreadydeploying";
            }
            if (msg.search(/deployment.+not found/) >= 0) {
                return "python-notfound";
            }
            if (msg.indexOf("central directory corrupt") >= 0) {
                return "python-centraldircorrupt";
            }
            if (msg.indexOf("entry not found in cache") >= 0) {
                return "python-entrynotfoundcache";
            }
            if (msg.indexOf("requirements") >= 0) {
                return "python-requirements";
            }
        }
        if (error.errorType === '502' || error.errorType === '503') {
            return `python-${error.errorType}`;
        }
        return "python-other";
    }
    return null;
}

async function showSurveyPopup(message: string, uri: Uri): Promise<void> {
    const button: MessageItem | undefined = await window.showErrorMessage(message, DialogResponses.reportAnIssue);
    if (button === DialogResponses.reportAnIssue) {
        env.openExternal(uri);
    }
}

export function failureMoreInfoSurvey(error: IParsedError, siteConfig: WebSiteManagementModels.SiteConfigResource): boolean {
    if (env.language !== 'en' && !env.language.startsWith('en-')) {
        return false;
    }

    const failureKey: string | null = shouldPromptForSurvey(error, siteConfig);
    if (failureKey === null) {
        return false;
    }

    // don't wait
    // tslint:disable-next-line: no-floating-promises
    showSurveyPopup(
        localize(
            'failureSurveyQuestion',
            "The deployment failed with error: {0}. Please take a few minutes to help us improve the deployment experience",
            error.message
        ),
        Uri.parse(`${SURVEY_URL}?k=${encodeURIComponent(failureKey)}&m=${encodeURIComponent(env.machineId)}`));
    return true;
}
