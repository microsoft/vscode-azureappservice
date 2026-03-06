/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type IActionContext } from "@microsoft/vscode-azext-utils";
import * as vscode from 'vscode';
import { webAppFilter } from "../constants";
import { ext } from "../extensionVariables";
import { localize } from "../localize";
import { CodeOptimizationsIssueTreeItem } from "../tree/CodeOptimizationTreeItem";
import { findBuggyFile, getInsightPromptForGenericLLM } from "../utils/fixInsightsUtils";

/**
 * Handles the "fix insight" command for a code optimization issue.
 * Locates the problematic code in the workspace, opens it in the editor,
 * and launches a Copilot Chat session pre-filled with a fix prompt.
 *
 * @param context - The action context for telemetry and user interaction.
 * @param node - The tree item representing the code optimization issue. If not provided,
 *               the user will be prompted to select one.
 */
export async function fixInsight(context: IActionContext, node?: CodeOptimizationsIssueTreeItem | undefined): Promise<void> {
    // If no tree item was passed (e.g. invoked from the command palette), prompt the user to pick one
    if (!node) {
        const noItemFoundErrorMessage: string = localize('noCodeOptimizationIssue', 'Select a code optimization issue to fix.');
        node = await ext.rgApi.pickAppResource<CodeOptimizationsIssueTreeItem>({ ...context, noItemFoundErrorMessage }, {
            filter: webAppFilter,
            expectedChildContextValue: new RegExp(CodeOptimizationsIssueTreeItem.contextValue)
        });
    }

    const dataplaneIssue = node.issue;

    // Record telemetry properties for the issue being fixed
    context.telemetry.properties.codeOptimizationIssueId = dataplaneIssue.issueId;
    context.telemetry.properties.codeOptimizationIssueCategory = dataplaneIssue.issueCategory;
    context.telemetry.properties.codeOptimizationIsFixable = String(dataplaneIssue.isFixable);

    // Search the workspace for the file and code block that matches the issue's function signatures
    const localizationInsight = await findBuggyFile(
        dataplaneIssue.function,
        dataplaneIssue.parentFunction
    );

    if (!localizationInsight) {
        context.telemetry.properties.codeOptimizationCodeFound = 'false';
        throw new Error(localize('codeNotFound', 'Could not find the code in the given workspace for the given context.'));
    }

    context.telemetry.properties.codeOptimizationCodeFound = 'true';

    // Open the file and highlight the relevant code block in the editor
    const editor = await openFile(localizationInsight.filePath, localizationInsight.codeLocation.blockStartLineNumber, localizationInsight.codeLocation.blockEndLineNumber);

    // Extract the full text of the parent method containing the issue
    const classCodeRange = new vscode.Range(
        editor.document.lineAt(localizationInsight.codeLocation.blockStartLineNumber).range.start,
        editor.document.lineAt(localizationInsight.codeLocation.blockEndLineNumber).range.end
    );

    const parentMethod = editor.document.getText(classCodeRange);

    // Build a natural-language prompt describing the issue and the surrounding code
    const prompt = await getInsightPromptForGenericLLM(dataplaneIssue, parentMethod);

    // Open a new Copilot Chat session with the generated prompt so the user can review the suggested fix
    context.telemetry.properties.codeOptimizationChatOpened = 'false';
    await vscode.commands.executeCommand("workbench.action.chat.newChat");
    await vscode.commands.executeCommand("workbench.action.chat.open", { query: prompt });
    context.telemetry.properties.codeOptimizationChatOpened = 'true';
}

/**
 * Opens a file in the editor and selects the specified line range.
 *
 * @param filePath - Absolute path to the file to open.
 * @param startLineNumber - Zero-based start line of the selection.
 * @param endLineNumber - Zero-based end line of the selection.
 * @returns The text editor instance showing the opened file.
 */
async function openFile(
    filePath: string,
    startLineNumber: number,
    endLineNumber: number
): Promise<vscode.TextEditor> {
    try {
        const fileUri = vscode.Uri.file(filePath);
        const doc = await vscode.workspace.openTextDocument(fileUri);
        const editor = await vscode.window.showTextDocument(doc);

        // Select the code block so the user can immediately see the relevant lines
        const fixStartLine = new vscode.Position(startLineNumber, 0);
        const fixEndLine = new vscode.Position(endLineNumber + 1, 0);
        editor.selections = [new vscode.Selection(fixStartLine, fixEndLine)];
        return editor;
    } catch (error) {
        throw new Error(`Could not open file: ${filePath}. Error: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
}
