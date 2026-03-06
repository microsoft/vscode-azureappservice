/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { getPerfIssues, type DataplaneIssue } from "./perfIssuesUtils";

export async function getInsightPromptForGenericLLM(
    dataplaneIssue: DataplaneIssue,
    codeToFix: string
): Promise<string> {
    const perfIssues = await getPerfIssues();
    const filteredPerfIssues = perfIssues.filter(
        (perfIssue) => perfIssue.permanentId === dataplaneIssue.issueId
    );
    const filteredPerfIssue = filteredPerfIssues[0];

    const issueImpact = dataplaneIssue.value.toFixed(1);
    const issueFunction = dataplaneIssue.function;
    const issueParentFunction = dataplaneIssue.parentFunction;
    const issueCategory = dataplaneIssue.issueCategory;
    let issueTitle, issueRecommendation;

    if (filteredPerfIssue) {
        issueTitle = filteredPerfIssue.title;
        issueRecommendation = filteredPerfIssue.recommendation;
    } else {
        issueTitle = `\`${issueFunction}\` is causing high ${issueCategory} usage.`;
        issueRecommendation = `Consider investigating why \`${issueFunction}\` is causing higher than expected ${issueCategory} usage.\r\n`;
    }

    let prompt = `I have an issue with my C# code.\n`;
    prompt += `Problem: ${issueTitle}, impact: ${issueImpact}% on \`${issueFunction}\`, called by \`${issueParentFunction}\`.\n`;
    prompt += `I was given the following recommendation: "${issueRecommendation}".\n`;
    prompt += `This issue was detected by a performance analysis tool using the following stack trace:\n`;
    prompt += `${dataplaneIssue.context}\n\n`;
    prompt += `The problematic function call is ${dataplaneIssue.function}, which is called by ${dataplaneIssue.parentFunction}.\n`;
    prompt += `Please provide a fix for this issue in ${dataplaneIssue.parentFunction}.\n`;
    prompt += `Please keep the code changes limited to within the method only.\n`;
    prompt += `\n\nHere is the code:\n`;
    prompt += `${codeToFix}\n\n`;

    return prompt;
}

export interface CodeLocation {
    blockStartLineNumber: number,
    blockEndLineNumber: number,
    bottleneckFunctionCall: string,
    parentFunctionSignature: string
}

export interface InsightLocalization {
    filePath: string,
    function: string,
    codeLocation: CodeLocation
}

export async function findBuggyFile(
    symbol: string,
    parentSymbol: string
): Promise<InsightLocalization | undefined> {
    const parentFunction = parentSymbol.split(".").slice(-1)[0];
    const className = parentSymbol.split(".").slice(-2)[0];

    // Determine the best search term based on the parent symbol type
    const localFuncMatch = isLocalFuncOrLambaExp(parentFunction);
    let searchTerm: string;
    if (parentFunction.toLowerCase() === "ctor") {
        searchTerm = className;
    } else if (localFuncMatch) {
        searchTerm = localFuncMatch[1];
    } else {
        searchTerm = parentFunction;
    }

    // Use the workspace symbol provider to find matching symbols
    const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
        'vscode.executeWorkspaceSymbolProvider',
        searchTerm
    );

    if (!symbols || symbols.length === 0) {
        return undefined;
    }

    // Filter to C# files with relevant symbol kinds
    const matchingSymbols = symbols.filter(s =>
        s.location.uri.path.endsWith('.cs') &&
        (s.kind === vscode.SymbolKind.Method ||
            s.kind === vscode.SymbolKind.Constructor ||
            s.kind === vscode.SymbolKind.Function ||
            s.kind === vscode.SymbolKind.Class)
    );

    // Deduplicate files to avoid opening the same document multiple times
    const uniqueFileUris = [...new Set(matchingSymbols.map(s => s.location.uri.toString()))];

    // First pass: try to match both the parent function and the bottleneck call
    for (const fileUri of uniqueFileUris) {
        const uri = vscode.Uri.parse(fileUri);
        const doc = await vscode.workspace.openTextDocument(uri);
        const code = doc.getText();
        const fileName = uri.path.split("/").pop()?.replace(".cs", "") ?? "";
        const codeLocation = findBugLocationInCode(code, fileName, symbol, parentSymbol);
        if (codeLocation) {
            return {
                filePath: decodeURIComponent(fileUri.toString().replace("file://", "")),
                function: symbol.split(".").slice(-1)[0],
                codeLocation: codeLocation
            };
        }
    }

    // Second pass: ignore the bottleneck function and just locate the parent function
    for (const fileUri of uniqueFileUris) {
        const uri = vscode.Uri.parse(fileUri);
        const doc = await vscode.workspace.openTextDocument(uri);
        const code = doc.getText();
        const fileName = uri.path.split("/").pop()?.replace(".cs", "") ?? "";
        const codeLocation = findBugLocationInCode(code, fileName, symbol, parentSymbol, true);
        if (codeLocation) {
            return {
                filePath: decodeURIComponent(fileUri.toString().replace("file://", "")),
                function: symbol.split(".").slice(-1)[0],
                codeLocation: codeLocation
            };
        }
    }

    return undefined;
}

export function findBugLocationInCode(
    code: string,
    fileName: string,
    symbolToFind: string,
    parentSymbol: string,
    ignoreBottleneck: boolean = false
): CodeLocation | undefined {

    const parentFunction: string = parentSymbol.split(".").slice(-1)[0];
    //'List.Enumerable::ToList'
    //const bottleneckFunction: string = symbolToFind.split(".").slice(-1)[0];
    const bottleneckFunction: string = symbolToFind.split("::").slice(-1)[0];

    let parentFunctionSignature = "";
    let bottleneckFunctionCall = "";

    // Calculate Parent Function Signature
    const localFuncOrLambaExpMatch = isLocalFuncOrLambaExp(parentFunction);
    if (parentFunction.toLowerCase() === "ctor") {
        // This is the constructor, replace "ctor" with fileName, which
        // is usually the class name and thus the constructor name.
        parentFunctionSignature = `${fileName}`;
    } else if (localFuncOrLambaExpMatch) {
        // The signature can be extracted from the match
        parentFunctionSignature = `${localFuncOrLambaExpMatch[1]}`;
    } else {
        parentFunctionSignature = `${parentFunction}`;
    }

    // Calculate Bottleneck Function Call
    const localFuncOrLambaExpMatch2 = isLocalFuncOrLambaExp(bottleneckFunction);
    if (bottleneckFunction.toLowerCase() === "ctor") {
        // This is a constructor call, and usually the class name comes just before it
        const classBeingConstructed = symbolToFind.split(".").slice(-2)[0];
        bottleneckFunctionCall = `new ${classBeingConstructed}`;
    } else if (localFuncOrLambaExpMatch2) {
        // The signature can be extracted from the match
        bottleneckFunctionCall = `${localFuncOrLambaExpMatch2[1]}`;
    } else {
        bottleneckFunctionCall = `${bottleneckFunction}`;
    }

    const possibleStarts = findAllOccurrences(code, `${parentFunctionSignature}(`);

    for (let i = 0; i < possibleStarts.length; i++) {
        const start = possibleStarts[i];
        const end = getBalancedEndIndex(code.substring(start));

        // It's not a valid function declaration; most likely a function call instead.
        if (end === -1) continue;

        const block = code.substring(start, start + end);

        if (block.includes(`${bottleneckFunctionCall}(`)) {
            const bugStarts = findAllOccurrences(block, `${bottleneckFunctionCall}(`);

            if (bugStarts.length > 0) {
                const blockStartLineNumber = code.substring(0, start).split("\n").length;
                const blockEndLineNumber = code
                    .substring(0, start + end)
                    .split("\n").length;

                return {
                    blockStartLineNumber: blockStartLineNumber - 1,
                    blockEndLineNumber: blockEndLineNumber - 1,
                    bottleneckFunctionCall: bottleneckFunctionCall,
                    parentFunctionSignature: parentFunctionSignature
                } as CodeLocation;
            }
        }
    }

    // The bottleneck function was not found in the code. This could be due to many reasons:
    // - Stack trace uses internal function names (e.g. String.ReplaceCore instead of String.Replace)
    // - The bottleneck function is not from the repo (e.g. coreclr.WKS::gc_heap::garbage_collect)
    // - The constructor mismatches the class name (e.g. String vs string)
    // - Etc...
    // Alternatively, we can locate the whole parent function and hope that the LLM can figure out the issue.
    // For this, we return the original symbol for the LLM to have better context.
    if (ignoreBottleneck) {
        for (let i = 0; i < possibleStarts.length; i++) {
            const start = possibleStarts[i];
            const end = getBalancedEndIndex(code.substring(start));

            // It's not a valid function declaration; most likely a function call instead.
            if (end === -1) continue;

            const blockStartLineNumber = code.substring(0, start).split("\n").length;
            const blockEndLineNumber = code
                .substring(0, start + end)
                .split("\n").length;

            return {
                blockStartLineNumber: blockStartLineNumber - 1,
                blockEndLineNumber: blockEndLineNumber - 1,
                bottleneckFunctionCall: bottleneckFunctionCall,
                parentFunctionSignature: parentFunction
            } as CodeLocation;
        }
    }

    return undefined;
}

const localFuncOrLambaExp = /<(\w+)>g__(\w+)\|\d+_\d+/;
export function isLocalFuncOrLambaExp(symbol: string): RegExpMatchArray | null {
    return symbol.match(localFuncOrLambaExp);
}

function findAllOccurrences(str: string, substr: string) {
    const result = [];
    let idx = str.indexOf(substr);
    while (idx !== -1) {
        result.push(idx);
        idx = str.indexOf(substr, idx + 1);
    }
    return result;
}

function getBalancedEndIndex(code: string) {
    let openCount = 0;
    let index = 0;
    while (index < code.length) {
        const ch = code[index];
        if (ch === "{") {
            openCount += 1;
        } else if (ch === "}") {
            if (openCount === 0) {
                // This means we have an unmatched "}".
                // Most likely because it's not the method declaration,
                // but instead only a reference to the searched method.
                return -1;
            }
            openCount -= 1;
            if (openCount === 0) {
                return index;
            }
        }
        index += 1;
    }
    return -1; // No balanced end found
}
