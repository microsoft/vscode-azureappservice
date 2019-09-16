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
import { delay } from "../../utils/delay";
import { getWorkspaceSetting } from '../../vsCodeConfig/settings';
import { getLinuxDetectorError } from "./getLinuxDetectorError";

const linuxContainerStartFailureId: string = 'LinuxContainerStartFailure';

export async function checkLinuxWebAppDownDetector(correlationId: string, node: SiteTreeItem, tokenSource: CancellationTokenSource): Promise<void> {
    return await callWithTelemetryAndErrorHandling('appService.linuxWebAppDownDetector', async (context: IActionContext): Promise<void> => {
        context.errorHandling.suppressDisplay = true;
        context.telemetry.properties.correlationId = correlationId;

        const kuduClient: KuduClient = await node.root.client.getKuduClient();
        const deployment: DeployResult = await kuduClient.deployment.getResult('latest');
        if (!deployment.startTime) {
            // if there's no deployment detected, nothing can be done
            context.telemetry.properties.cancelStep = 'noDeployResult';
            return;
        }

        const deployResultTime: Date = new Date(deployment.startTime);

        const enableDetectorsSetting: string = 'enableDetectors';
        const showOutput: boolean | undefined = getWorkspaceSetting<boolean>(enableDetectorsSetting);

        if (showOutput) {
            const detectorOutput: string = `Diagnosing web app "${node.root.client.siteName}" for critical errors...`;
            ext.outputChannel.appendLog(detectorOutput);
        }

        let detectorErrorMessage: string | undefined;
        // for telemetry's sake, wait for 30 minutes from after "deployment complete" prompt
        const detectorTimeoutMs: number = Date.now() + 30 * 60 * 1000;

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

            // tslint:disable-next-line: no-unsafe-any
            detectorErrorMessage = await getLinuxDetectorError(context, linuxContainerStartFailureId, node, deployResultTime, node.root.client.fullName);

            if (!detectorErrorMessage) {
                // poll every minute
                await delay(1000 * 60);
            }
        }

        if (showOutput) {
            await ext.ui.showWarningMessage(detectorErrorMessage, { title: 'Open in Portal' });
            await openInPortal(node.root, `${node.root.client.id}/troubleshoot`, { queryPrefix: `websitesextension_ext=asd.featurePath%3Ddetectors%2F${linuxContainerStartFailureId}` });
            context.telemetry.properties.didClick = 'true';
        }

    });
}
