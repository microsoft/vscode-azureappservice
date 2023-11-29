/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type SiteConfigResource } from '@azure/arm-appservice';
import { DialogResponses, type IParsedError } from '@microsoft/vscode-azext-utils';
import { env, Uri, window, type MessageItem } from 'vscode';
import { localize } from "../../localize";
import { LinuxRuntimes } from "../createWebApp/LinuxRuntimes";

const SURVEY_URL: string = 'https://aka.ms/AppServiceExtDeploymentFeedback';

function shouldPromptForSurvey(error: IParsedError, siteConfig: SiteConfigResource): string | null {
    if (siteConfig.linuxFxVersion?.toLowerCase().startsWith(LinuxRuntimes.python)) {
        const msg: string = error.message.toLowerCase();
        if (msg.includes("the service is unavailable")) {
            return "python-serviceunavailable";
        }
        if (msg.includes("unknown error")) {
            return "python-unknown";
        }
        if (/exceeded the limit.+free tier/.test(msg)) {
            return "python-freetierlimit";
        }
        if (msg.includes("oryx")) {
            return "python-oryx";
        }
        if (/deployment.+in progress.+try again/.test(msg)) {
            return "python-alreadydeploying";
        }
        if (/deployment.+not found/.test(msg)) {
            return "python-notfound";
        }
        if (msg.includes("central directory corrupt")) {
            return "python-centraldircorrupt";
        }
        if (msg.includes("entry not found in cache")) {
            return "python-entrynotfoundcache";
        }
        if (msg.includes("requirements")) {
            return "python-requirements";
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
        void env.openExternal(uri);
    }
}

export function failureMoreInfoSurvey(error: IParsedError, siteConfig: SiteConfigResource): boolean {
    if (env.language !== 'en' && !env.language.startsWith('en-')) {
        return false;
    }

    const failureKey: string | null = shouldPromptForSurvey(error, siteConfig);
    if (failureKey === null) {
        return false;
    }

    // don't wait
    void showSurveyPopup(
        localize(
            'failureSurveyQuestion',
            "The deployment failed with error: {0}. Please take a few minutes to help us improve the deployment experience",
            error.message
        ),
        Uri.parse(`${SURVEY_URL}?k=${encodeURIComponent(failureKey)}&m=${encodeURIComponent(env.machineId)}`));
    return true;
}
