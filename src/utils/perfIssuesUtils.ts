/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { createHttpHeaders, createPipelineRequest } from "@azure/core-rest-pipeline";
import { createGenericClient, type AzExtPipelineResponse, type AzExtRequestPrepareOptions } from "@microsoft/vscode-azext-azureutils";
import { type ISubscriptionActionContext } from "@microsoft/vscode-azext-utils";
// eslint-disable-next-line import/no-internal-modules
import * as OPIResourcesJson from "@opi-perf/json/OPIResources.json";

export interface PerfIssue {
    permanentId: string;
    title: string;
    description: string;
    recommendation: string;
}

export interface DataplaneIssue {
    appId: string;
    correlationId: string;
    issueId: string;
    symbol: string;
    function: string;
    timestamp: string;
    key: string;
    isFixable: boolean;
    issueCategory: string;
    parentSymbol: string;
    parentFunction: string;
    value: number;
    context: string;
}

export interface FailedResponse {
    message: string;
}

export async function getPerfIssues(): Promise<PerfIssue[]> {
    const OPIResources = OPIResourcesJson as Record<string, PerfIssue>;
    return Object.values(OPIResources);
}

export async function getDataplaneIssues(
    appId: string,
    context: ISubscriptionActionContext
): Promise<DataplaneIssue[] | FailedResponse> {
    const dataplaneScope = "dataplane.diagnosticservices.azure.com";
    let authToken: string;
    try {
        const scopes = `api://${dataplaneScope}/.default`;
        const accessToken = (await (await context.createCredentialsForScopes([scopes])).getToken(scopes) as { token?: string }).token;
        authToken = `Bearer ${accessToken}`;
    } catch (error) {
        return { message: (error as Error).message } as FailedResponse;
    }

    const formattedStartTime = new Date(0).toISOString();
    const formattedEndTime = new Date().toISOString();

    const options: AzExtRequestPrepareOptions = {
        url: `https://${dataplaneScope}/api/apps/${appId}/insights/rollups?api-version=2023-11-09&startTime=${formattedStartTime}&endTime=${formattedEndTime}`,
        method: 'GET',
        headers: createHttpHeaders({
            'Authorization': authToken,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }),
    };

    const client = await createGenericClient(context, undefined);
    const result = await client.sendRequest(createPipelineRequest(options)) as AzExtPipelineResponse;
    return result.parsedBody as DataplaneIssue[];
}
