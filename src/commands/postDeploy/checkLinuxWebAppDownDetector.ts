/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationTokenSource } from "vscode";
import { callWithTelemetryAndErrorHandling, IActionContext, openInPortal, UserCancelledError } from "vscode-azureextensionui";
import { KuduClient } from "vscode-azurekudu";
import { DeployResult } from "vscode-azurekudu/lib/models";
import { SiteTreeItem } from "../../explorer/SiteTreeItem";
import { ext } from '../../extensionVariables';
import { localize } from "../../localize";
import { delay } from "../../utils/delay";
import { getWorkspaceSetting } from '../../vsCodeConfig/settings';
import { getLinuxDetectorError } from "./getLinuxDetectorError";

const linuxLogViewer: string = 'LinuxLogViewer';

export async function checkLinuxWebAppDownDetector(correlationId: string, node: SiteTreeItem, tokenSource: CancellationTokenSource): Promise<void> {
    return await callWithTelemetryAndErrorHandling('appService.linuxWebAppDownDetector', async (context: IActionContext): Promise<void> => {
        context.errorHandling.suppressDisplay = true;
        context.telemetry.properties.correlationId = correlationId;

        const kuduClient: KuduClient = await node.root.client.getKuduClient();
        const deployment: DeployResult = await kuduClient.deployment.getResult('latest');

        if (!deployment.endTime) {
            // if there's no deployment detected, nothing can be done
            context.telemetry.properties.cancelStep = 'noDeployResult';
            return;
        }

        const enableDetectorsSetting: string = 'enableDetectors';
        const showOutput: boolean | undefined = getWorkspaceSetting<boolean>(enableDetectorsSetting);

        if (showOutput) {
            const detectorOutput: string = `Diagnosing web app "${node.root.client.siteName}" for critical errors...`;
            ext.outputChannel.appendLog(detectorOutput);
        }

        let detectorErrorMessage: string | undefined;
        const detectorTimeoutMs: number = Date.now() + 5 * 60 * 1000;

        while (!detectorErrorMessage) {
            if (tokenSource.token.isCancellationRequested) {
                // the user cancelled the check by deploying again
                context.telemetry.properties.cancelStep = 'cancellationToken';
                throw new UserCancelledError();
            }

            if (Date.now() > detectorTimeoutMs) {
                if (showOutput) {
                    const noIssuesFound: string = `Diagnosing for "${node.root.client.siteName}" has timed out.`;
                    ext.outputChannel.appendLog(noIssuesFound);
                    context.telemetry.properties.timedOut = 'true';
                }
                return undefined;
            }

            // time constraint of being less than the current time by 14.5 minutes is enforced system wide for all detectors
            // however LinuxLogViewer detector ignores it and gets the most recent data
            const nowTime: Date = new Date();
            const startTimeDate: Date = new Date(nowTime.getTime() - (60 * 60 * 1000));
            const endTimeDate: Date = new Date(nowTime.getTime() - (30 * 60 * 1000));

            // need to remove the miliseconds from the ISOstring for request
            const startTimeArray: string[] = startTimeDate.toISOString().split(':');
            const startTime: string = `${startTimeArray[0]}:${startTimeArray[1]}`;

            const endTimeArray: string[] = endTimeDate.toISOString().split(':');
            const endTime: string = `${endTimeArray[0]}:${endTimeArray[1]}`;

            detectorErrorMessage = await getLinuxDetectorError(context, linuxLogViewer, node, startTime, endTime, deployment.endTime);

            if (!detectorErrorMessage) {
                // poll every 10 seconds
                await delay(1000 * 10);
            }
        }

        if (showOutput) {
            ext.outputChannel.appendLog(detectorErrorMessage);
            const openInPortalMsg: string = localize('openInPortal', 'Open in Portal for more details.');
            await ext.ui.showWarningMessage(`${detectorErrorMessage} ${openInPortalMsg}`, { title: 'Open in Portal' });
            await openInPortal(node.root, `${node.root.client.id}/troubleshoot`, { queryPrefix: `websitesextension_ext=asd.featurePath%3Ddetectors%2F${linuxLogViewer}` });
            context.telemetry.properties.didClick = 'true';
        }

    });
}
