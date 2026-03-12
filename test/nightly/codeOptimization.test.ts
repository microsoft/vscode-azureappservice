/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import * as assert from 'assert';
import { runWithTestActionContext } from 'node_modules/@microsoft/vscode-azext-utils';
import { fixInsight } from '../../src/commands/fixInsight';
import { findBuggyFile } from '../../src/utils/fixInsightsUtils';
import { DataplaneIssue } from '../../src/utils/perfIssuesUtils';
import * as vscode from 'vscode';

/**
 * Build a mock DataplaneIssue with the required fields.
 * Only `function`, `parentFunction`, `issueCategory`, `isFixable`, `issueId`, `value`,
 * and `context` are used by findBuggyFile / fixInsight / getInsightPromptForGenericLLM.
 */
function makeMockIssue(overrides: Partial<DataplaneIssue> & Pick<DataplaneIssue, 'function' | 'parentFunction'>): DataplaneIssue {
    return {
        appId: 'test-app-id',
        correlationId: 'test-correlation-id',
        issueId: '',
        symbol: '',
        timestamp: new Date().toISOString(),
        key: 'test-key',
        isFixable: true,
        issueCategory: 'CPU',
        parentSymbol: '',
        value: 5.0,
        context: '[]',
        ...overrides,
    };
}

// Mock dataplane issues derived from real dataplane API responses.
// These mirror the data returned by the Code Optimizations dataplane for the
// code-optimization-example app in test/nightly/testFolder/.
const mockIssues = {
    toListInStringValidation: makeMockIssue({
        function: 'Enumerable.ToList',
        parentFunction: 'Store.Reviews.ReviewValidation.StringValidation',
        issueCategory: 'Memory',
        isFixable: true,
        issueId: '2efbfd50-159a-42f7-88b9-4e5ad37de914',
        value: 73.1,
        context: '["system.linq.il!System.Linq.Enumerable.ToList","store!Store.Reviews.ReviewValidation.StringValidation","store!Store.Reviews.BackgroundReviewValidation+<ExecuteAsync>d__0.MoveNext()"]',
    }),
    replaceInStringValidation: makeMockIssue({
        function: 'String.ReplaceCore',
        parentFunction: 'Store.Reviews.ReviewValidation.StringValidation',
        issueCategory: 'CPU',
        isFixable: false,
        value: 3.8,
        context: '["system.private.corelib.il!System.String.ReplaceCore","store!Store.Reviews.ReviewValidation.StringValidation"]',
    }),
    randomNextInDeserializeLocalizedTerm: makeMockIssue({
        function: 'Random.Next',
        parentFunction: 'ReviewHelper.<LoadDisallowedWords>g__DeserializeLocalizedTerm|0_0',
        issueCategory: 'CPU',
        isFixable: true,
        value: 2.0,
        context: '["system.private.corelib.il!System.Random.Next","store!ReviewHelper.<LoadDisallowedWords>g__DeserializeLocalizedTerm|0_0()"]',
    }),
    stringValidationInExecuteAsync: makeMockIssue({
        function: 'Store.Reviews.ReviewValidation.StringValidation',
        parentFunction: 'Store.Reviews.BackgroundReviewValidation.ExecuteAsync',
        issueCategory: 'CPU',
        isFixable: true,
        value: 11.4,
        context: '["store!Store.Reviews.ReviewValidation.StringValidation","store!Store.Reviews.BackgroundReviewValidation+<ExecuteAsync>d__0.MoveNext()"]',
    }),
};

suite('Code Optimization - fixInsight end-to-end', function (this: Mocha.Suite): void {
    this.timeout(120_000);

    let hasWorkspaceSymbolSupport: boolean;

    suiteSetup(async function (this: Mocha.Context): Promise<void> {
        // The C# language server (OmniSharp / C# Dev Kit) needs time to start
        // and index the workspace before vscode.executeWorkspaceSymbolProvider
        // can return results. Retry a few times with increasing delays.
        hasWorkspaceSymbolSupport = false;
        const maxAttempts = 10;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
                'vscode.executeWorkspaceSymbolProvider', 'StringValidation'
            );
            if (symbols && symbols.some(s => s.location.uri.path.endsWith('.cs'))) {
                hasWorkspaceSymbolSupport = true;
                break;
            }
            if (attempt < maxAttempts) {
                // Wait progressively longer: 2s, 4s, 6s, …
                await new Promise(resolve => setTimeout(resolve, attempt * 2000));
            }
        }

        if (!hasWorkspaceSymbolSupport) {
            console.warn(
                '[Code Optimization Tests] Workspace symbol provider did not return C# symbols.\n' +
                'Make sure the C# extension (ms-dotnettools.csharp) is installed and that\n' +
                'test/test.code-workspace includes the code-optimization-example folder.\n' +
                'All tests in this suite will be skipped.'
            );
        }
    });

    function skipWithoutSymbols(ctx: Mocha.Context): void {
        if (!hasWorkspaceSymbolSupport) {
            ctx.skip();
        }
    }

    // -----------------------------------------------------------------------
    // findBuggyFile – exercises real VS Code workspace symbol provider
    // -----------------------------------------------------------------------

    test('findBuggyFile locates ReviewValidation.cs for ToList issue', async function () {
        skipWithoutSymbols(this);

        const issue = mockIssues.toListInStringValidation;
        const result = await findBuggyFile(issue.function, issue.parentFunction);

        assert.ok(result, 'findBuggyFile should locate the file');
        assert.ok(result!.filePath.endsWith('ReviewValidation.cs'),
            `Expected ReviewValidation.cs, got ${result!.filePath}`);
        assert.strictEqual(result!.codeLocation.parentFunctionSignature, 'StringValidation');
    });

    test('findBuggyFile locates ReviewHelper.cs for Random.Next local function issue', async function () {
        skipWithoutSymbols(this);

        const issue = mockIssues.randomNextInDeserializeLocalizedTerm;
        const result = await findBuggyFile(issue.function, issue.parentFunction);

        assert.ok(result, 'findBuggyFile should locate the file');
        assert.ok(result!.filePath.endsWith('ReviewHelper.cs'),
            `Expected ReviewHelper.cs, got ${result!.filePath}`);
        assert.strictEqual(result!.codeLocation.parentFunctionSignature, '<LoadDisallowedWords>g__DeserializeLocalizedTerm|0_0');
    });

    test('findBuggyFile locates BackgroudReviewValidation.cs for StringValidation in ExecuteAsync', async function () {
        skipWithoutSymbols(this);

        const issue = mockIssues.stringValidationInExecuteAsync;
        const result = await findBuggyFile(issue.function, issue.parentFunction);

        assert.ok(result, 'findBuggyFile should locate the file');
        assert.ok(result!.filePath.endsWith('BackgroudReviewValidation.cs'),
            `Expected BackgroudReviewValidation.cs, got ${result!.filePath}`);
        assert.strictEqual(result!.codeLocation.parentFunctionSignature, 'ExecuteAsync');
        assert.strictEqual(result!.codeLocation.bottleneckFunctionCall, 'Store.Reviews.ReviewValidation.StringValidation');
    });

    test('findBuggyFile returns undefined for non-existent parent function', async function () {
        skipWithoutSymbols(this);

        const result = await findBuggyFile('SomeCall', 'Namespace.NonExistentClass.NonExistentMethod');
        assert.strictEqual(result, undefined);
    });

    // -----------------------------------------------------------------------
    // fixInsight – full command flow with mock dataplane node
    // -----------------------------------------------------------------------

    test('fixInsight opens ReviewValidation.cs and sets telemetry for ToList issue', async function () {
        skipWithoutSymbols(this);

        const issue = mockIssues.toListInStringValidation;
        const mockNode = { issue } as any;

        await runWithTestActionContext('appService.fixCodeOptimization', async context => {
            try {
                await fixInsight(context, mockNode);
            } catch (err) {
                // Chat commands will fail if GitHub Copilot Chat is not installed.
                // That's fine – we still verify everything up to that point.
                const msg = String(err);
                if (!msg.includes('chat') && !msg.includes('workbench.action.chat')) {
                    throw err;
                }
            }

            // Telemetry should reflect the issue was found
            assert.strictEqual(context.telemetry.properties.codeOptimizationCodeFound, 'true');
            assert.strictEqual(context.telemetry.properties.codeOptimizationIssueCategory, 'Memory');
            assert.strictEqual(context.telemetry.properties.codeOptimizationIsFixable, 'true');

            // The correct file should be open in the active editor
            const editor = vscode.window.activeTextEditor;
            assert.ok(editor, 'An editor should be open');
            assert.ok(editor!.document.uri.fsPath.endsWith('ReviewValidation.cs'),
                `Expected ReviewValidation.cs, got ${editor!.document.uri.fsPath}`);

            // The editor should contain the StringValidation method
            const selectedText = editor!.document.getText(editor!.selection);
            if (selectedText.length > 0) {
                assert.ok(selectedText.includes('StringValidation') || selectedText.includes('.ToList()'),
                    'Selection should cover the StringValidation method');
            }
        });
    });

    test('fixInsight opens BackgroudReviewValidation.cs for StringValidation in ExecuteAsync', async function () {
        skipWithoutSymbols(this);

        const issue = mockIssues.stringValidationInExecuteAsync;
        const mockNode = { issue } as any;

        await runWithTestActionContext('appService.fixCodeOptimization', async context => {
            try {
                await fixInsight(context, mockNode);
            } catch (err) {
                const msg = String(err);
                if (!msg.includes('chat') && !msg.includes('workbench.action.chat')) {
                    throw err;
                }
            }

            assert.strictEqual(context.telemetry.properties.codeOptimizationCodeFound, 'true');

            const editor = vscode.window.activeTextEditor;
            assert.ok(editor, 'An editor should be open');
            assert.ok(editor!.document.uri.fsPath.endsWith('BackgroudReviewValidation.cs'),
                `Expected BackgroudReviewValidation.cs, got ${editor!.document.uri.fsPath}`);
        });
    });

    test('fixInsight sets codeOptimizationCodeFound=false when code cannot be located', async function () {
        skipWithoutSymbols(this);

        const issue = makeMockIssue({
            function: 'NonExistent.Method',
            parentFunction: 'Fake.Namespace.NoSuchClass.NoSuchMethod',
        });
        const mockNode = { issue } as any;

        await runWithTestActionContext('appService.fixCodeOptimization', async context => {
            await assert.rejects(
                async () => fixInsight(context, mockNode),
                /Could not find the code/,
                'fixInsight should throw when the code cannot be located'
            );

            assert.strictEqual(context.telemetry.properties.codeOptimizationCodeFound, 'false');
        });
    });

    // -----------------------------------------------------------------------
    // Copilot Chat availability check
    // -----------------------------------------------------------------------

    test('fixInsight invokes Copilot Chat when available', async function () {
        skipWithoutSymbols(this);

        // Check if chat commands are registered
        const allCommands = await vscode.commands.getCommands(true);
        const hasChatOpen = allCommands.includes('workbench.action.chat.open');
        const hasChatNew = allCommands.includes('workbench.action.chat.newChat');

        if (!hasChatOpen || !hasChatNew) {
            // Copilot Chat is not installed – skip this test
            this.skip();
        }

        const issue = mockIssues.toListInStringValidation;
        const mockNode = { issue } as any;

        await runWithTestActionContext('appService.fixCodeOptimization', async context => {
            // Should complete without error when Copilot Chat is installed
            await fixInsight(context, mockNode);

            assert.strictEqual(context.telemetry.properties.codeOptimizationChatOpened, 'true');
            assert.strictEqual(context.telemetry.properties.codeOptimizationCodeFound, 'true');
        });
    });
});
