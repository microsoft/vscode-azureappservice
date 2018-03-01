import * as vscode from 'vscode';
import { UserCancelledError } from 'vscode-azureextensionui';
import { WizardStep } from '../../wizard';
import { LogPointsSessionWizard } from '../LogPointsSessionWizard';

export class OpenStreamingLog extends WizardStep {
    constructor(private _wizard: LogPointsSessionWizard) {
        super(_wizard, 'Detect logging stream availability.');
    }

    public async prompt(): Promise<void> {
        const siteTreeItem = this._wizard.selectedDeploymentSlotTreeItem;

        if (!siteTreeItem) {
            throw new Error('Cannot locate a site to check logging stream availability.');
        }

        const loggingEnabled = await siteTreeItem.isHttpLogsEnabled(this._wizard.websiteManagementClient);

        // Only proceed if logging is enabled.
        if (!loggingEnabled) {
            vscode.window.showInformationMessage("Logpoints session require Streaming Log to start, which is not currently enabled. Please use \"View Streaming Log\" command to enable it.");
            throw new UserCancelledError("Streaming log is not enabled.");
        }

        // Open streaming log
        await siteTreeItem.connectToLogStream(this._wizard.websiteManagementClient, this._wizard.telemetryReporter, this._wizard.extensionContext);
        this._wizard.logpointsManager.onStreamingLogOutputChannelCreated(siteTreeItem.site, siteTreeItem.logStreamOutputChannel);
    }
}
