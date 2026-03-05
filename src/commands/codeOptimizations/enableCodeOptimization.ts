/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { type StringDictionary } from "@azure/arm-appservice";
import { type GenericTreeItem, type IActionContext } from "@microsoft/vscode-azext-utils";
import * as vscode from 'vscode';
import { webAppFilter } from "../../constants";
import { ext } from "../../extensionVariables";
import { localize } from "../../localize";
import { CodeOptimizationsTreeItem } from "../../tree/CodeOptimizationTreeItem";
import { getPromptForAddingProfilerSupport } from "../../utils/addProfilerUtils";

/**
 * Enables the Application Insights profiler on a Windows web app by setting the
 * required app settings and enabling Always On in the site configuration.
 *
 * @param context - The action context for telemetry and user interaction.
 * @param node - The "profiler not enabled" tree item. If not provided, the user
 *               will be prompted to select a qualifying web app.
 */
export async function enableProfiler(context: IActionContext, node?: GenericTreeItem | undefined): Promise<void> {
    // If invoked without a specific tree node, prompt the user to pick a web app that needs the profiler
    if (!node || !(node.parent instanceof CodeOptimizationsTreeItem)) {
        const noItemFoundErrorMessage: string = localize('somethingWrongInsights', 'Unable to enable profiler');
        node = await ext.rgApi.pickAppResource<GenericTreeItem>({ ...context, noItemFoundErrorMessage }, {
            filter: webAppFilter,
            expectedChildContextValue: new RegExp("profilerNotEnabled")
        });
    }
    else {
        const client = await node.parent.parent.site.createClient(context);
        const settings = await client.listApplicationSettings();

        // Set the app settings required to activate the Application Insights profiler
        if (settings.properties) {
            settings.properties['APPINSIGHTS_PROFILERFEATURE_VERSION'] = '1.0.0';
            settings.properties['XDT_MicrosoftApplicationInsights_Mode'] = 'recommended';
            settings.properties['DiagnosticServices_EXTENSION_VERSION'] = '~3';
        }

        await client.updateApplicationSettings(settings);

        // Enable Always On so the profiler can run continuously without being unloaded due to inactivity
        const config = await client.getSiteConfig()
        config.alwaysOn = true;
        await client.updateConfiguration(config);

        // Refresh the tree so the "not enabled" node is replaced with the actual profiler status
        await node.parent.refresh(context);
    }
}

/**
 * Opens a Copilot Chat session with instructions for adding profiler support to a Linux web app.
 * Unlike Windows apps (which can be configured via app settings alone), Linux apps require
 * code-level changes, so this function generates an LLM prompt to guide the user.
 *
 * @param context - The action context for telemetry and user interaction.
 * @param node - The "no profiler results (Linux)" tree item. If not provided, the user
 *               will be prompted to select a qualifying web app.
 */
export async function promptAddProfilerLinux(context: IActionContext, node?: GenericTreeItem | undefined): Promise<void> {
    // If invoked without a specific tree node, prompt the user to pick a Linux web app
    if (!node || !(node.parent instanceof CodeOptimizationsTreeItem)) {
        const noItemFoundErrorMessage: string = localize('somethingWrongInsights', 'Unable to add profiler support');
        node = await ext.rgApi.pickAppResource<GenericTreeItem>({ ...context, noItemFoundErrorMessage }, {
            filter: webAppFilter,
            expectedChildContextValue: new RegExp("codeOptimizationNoResultLinux")
        });
    }
    else {
        // Retrieve the App Insights connection string from the web app's settings
        const client = await node.parent.parent.site.createClient(context);
        const settings: StringDictionary = await client.listApplicationSettings();

        const connectionString = settings?.properties?.APPLICATIONINSIGHTS_CONNECTION_STRING;

        // Build an LLM prompt that explains how to instrument the app with profiler support
        const prompt = await getPromptForAddingProfilerSupport(connectionString ?? "");

        // Open a new Copilot Chat session with the generated prompt
        context.telemetry.properties.codeOptimizationChatOpened = 'true';
        await vscode.commands.executeCommand("workbench.action.chat.newChat");
        await vscode.commands.executeCommand("workbench.action.chat.open", { query: prompt });
    }
}
