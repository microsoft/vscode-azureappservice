import { MessageItem, window } from "vscode";
import { AppServiceDialogResponses } from "../../constants";
import { SiteTreeItem } from "../../explorer/SiteTreeItem";
import { ext } from "../../extensionVariables";
import { nonNullValue } from "../../utils/nonNull";
import { startStreamingLogs } from '../startStreamingLogs';
import { IDeployContext } from "./IDeployContext";

export async function postDeploymentPrompt(deployContext: IDeployContext, node: SiteTreeItem): Promise<void> {
    const deployComplete: string = `Deployment to "${node.root.client.fullName}" completed.`;
    ext.outputChannel.appendLog(deployComplete);
    const browseWebsite: MessageItem = { title: 'Browse Website' };
    const streamLogs: MessageItem = { title: 'Stream Logs' };

    await window.showInformationMessage(deployComplete, browseWebsite, streamLogs, AppServiceDialogResponses.viewOutput).then(async (result: MessageItem | undefined) => {
        if (result === AppServiceDialogResponses.viewOutput) {
            ext.outputChannel.show();
        } else if (result === browseWebsite) {
            await nonNullValue(node).browse();
        } else if (result === streamLogs) {
            await startStreamingLogs(deployContext, node);
        }
    });
}
