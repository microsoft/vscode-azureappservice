import * as vscode from 'vscode';
import { IAzureNode, IAzureTreeItem, UserCancelledError } from 'vscode-azureextensionui';
import { SiteTreeItem } from '../../explorer/SiteTreeItem';
import { WizardStep } from '../../wizard';
import { LogPointsSessionWizard } from '../LogPointsSessionWizard';

export class CheckLogStreamAvailability extends WizardStep {
    constructor(private _wizard: LogPointsSessionWizard) {
        super(_wizard, 'Detect logging stream availability.');
    }

    public async prompt(): Promise<void> {
        const siteTreeItem = this.getSiteTreeItem();

        if (!siteTreeItem) {
            throw new Error('Cannot locate a site to check logging stream availability.');
        }

        const loggingEnabled = await siteTreeItem.isHttpLogsEnabled(this._wizard.websiteManagementClient);

        // Only proceed if logging is enabled.
        if (!loggingEnabled) {
            vscode.window.showInformationMessage("Logpoints session require Streaming Log to start, which is not currently enabled. Please use \"View Streaming Log\" command to enable it.");
            throw new UserCancelledError("Streaming log is not enabled.");
        }
    }

    private getSiteTreeItem(): SiteTreeItem {
        let extendedTreeItem: IAzureNode<IAzureTreeItem> = this._wizard.uiTreeItem;

        while (extendedTreeItem) {
            if (!extendedTreeItem) {
                break;
            }

            if (extendedTreeItem.treeItem instanceof SiteTreeItem) {
                return extendedTreeItem.treeItem;
            }
            extendedTreeItem = extendedTreeItem.parent;
        }

        return null;
    }
}
