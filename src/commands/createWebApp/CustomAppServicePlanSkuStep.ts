/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createHttpHeaders, createPipelineRequest } from "@azure/core-rest-pipeline";
import { type SkuDescription } from "@azure/arm-appservice";
import { createGenericClient, type AzExtPipelineResponse, type AzExtRequestPrepareOptions } from "@microsoft/vscode-azext-azureutils";
import { AzureWizardPromptStep } from "@microsoft/vscode-azext-utils";
import { type IWebAppWizardContext } from "./IWebAppWizardContext";
import * as vscode from "vscode";

interface GeoRegion {
    id: string;
    name: string;
    properties: {
        displayName: string;
        orgDomain: string;
    };
}

interface GeoRegionsResponse {
    value: GeoRegion[];
}

/**
 * Custom AppServicePlanSkuStep that provides region-appropriate SKU recommendations
 * including Premium V4 SKUs where available and deprioritizing legacy V2 SKUs
 */
export class CustomAppServicePlanSkuStep extends AzureWizardPromptStep<IWebAppWizardContext> {
    private _supportsPV4: boolean | undefined;
    private _supportsMV4: boolean | undefined;

    public async prompt(context: IWebAppWizardContext): Promise<void> {
        // First determine region capabilities
        await this.checkRegionCapabilities(context);

        let skus = context.advancedCreation ? 
            this.getRecommendedSkus().concat(this.getAdvancedSkus()) : 
            this.getRecommendedSkus();

        // Filter based on context
        const regExp = context.planSkuFamilyFilter;
        if (regExp) {
            skus = skus.filter(s => !s.family || regExp.test(s.family));
        }

        interface PricingTierItem {
            label: string;
            description?: string;
            data?: SkuDescriptionWithMeta;
            group?: string;
            suppressPersistence?: boolean;
        }

        const pricingTiers: PricingTierItem[] = skus.map(s => {
            return {
                label: s.label || s.name || 'Unknown',
                description: s.description || s.tier,
                data: s,
                group: s.group || vscode.l10n.t('Additional Options')
            };
        });

        pricingTiers.push({ 
            label: vscode.l10n.t('$(link-external) Show pricing information...'), 
            suppressPersistence: true 
        });

        while (!context.newPlanSku) {
            const placeHolder = vscode.l10n.t('Select a pricing tier');
            context.newPlanSku = (await context.ui.showQuickPick(pricingTiers, { 
                placeHolder, 
                suppressPersistence: true, 
                enableGrouping: context.advancedCreation 
            })).data;

            if (!context.newPlanSku) {
                // Open pricing information based on OS
                if (context.newSiteOS === 'linux') {
                    await vscode.env.openExternal(vscode.Uri.parse('https://aka.ms/AA60znj'));
                } else {
                    await vscode.env.openExternal(vscode.Uri.parse('https://aka.ms/AA6202c'));
                }
            }
        }
    }

    public shouldPrompt(context: IWebAppWizardContext): boolean {
        return !context.newPlanSku;
    }

    private async checkRegionCapabilities(context: IWebAppWizardContext): Promise<void> {
        try {
            const apiVersion = '2024-11-01';
            const authToken = (await context.credentials.getToken() as { token?: string }).token;
            
            if (!authToken) {
                // Fallback to assuming no PV4 support if we can't get token
                this._supportsPV4 = false;
                this._supportsMV4 = false;
                return;
            }

            const options: AzExtRequestPrepareOptions = {
                url: `${context.environment.resourceManagerEndpointUrl}subscriptions/${context.subscriptionId}/providers/Microsoft.Web/geoRegions?api-version=${apiVersion}`,
                method: 'GET',
                headers: createHttpHeaders({
                    'Authorization': `Bearer ${authToken}`,
                }),
            };

            const client = await createGenericClient(context, undefined);
            const result = await client.sendRequest(createPipelineRequest(options)) as AzExtPipelineResponse;
            const response = result.parsedBody as GeoRegionsResponse;

            // Check if any region supports PV4 and MV4 series
            this._supportsPV4 = response.value.some(region => 
                region.properties.orgDomain && region.properties.orgDomain.includes('PV4SERIES')
            );
            this._supportsMV4 = response.value.some(region => 
                region.properties.orgDomain && region.properties.orgDomain.includes('MV4SERIES')
            );

        } catch (error) {
            // Fallback to assuming no PV4 support if API call fails
            context.telemetry.properties.regionApiError = String(error);
            this._supportsPV4 = false;
            this._supportsMV4 = false;
        }
    }

    private getRecommendedSkus(): SkuDescriptionWithMeta[] {
        const recommendedGroup = vscode.l10n.t('Recommended');
        const skus: SkuDescriptionWithMeta[] = [
            {
                name: 'F1',
                tier: 'Free',
                size: 'F1',
                family: 'F',
                capacity: 1,
                label: vscode.l10n.t('Free (F1)'),
                description: vscode.l10n.t('Try out Azure at no cost'),
                group: recommendedGroup
            },
            {
                name: 'B1',
                tier: 'Basic',
                size: 'B1',
                family: 'B',
                capacity: 1,
                label: vscode.l10n.t('Basic (B1)'),
                description: vscode.l10n.t('Develop and test'),
                group: recommendedGroup
            }
        ];

        // Add Premium V4 SKUs if supported, otherwise Premium V3
        if (this._supportsPV4) {
            skus.push(
                {
                    name: 'P0V4',
                    tier: 'Premium V4',
                    size: 'P0V4',
                    family: 'Pv4',
                    capacity: 1,
                    label: vscode.l10n.t('Premium (P0V4)'),
                    description: vscode.l10n.t('Use in production - Latest generation'),
                    group: recommendedGroup
                },
                {
                    name: 'P1V4',
                    tier: 'Premium V4',
                    size: 'P1V4',
                    family: 'Pv4',
                    capacity: 1,
                    label: vscode.l10n.t('Premium (P1V4)'),
                    description: vscode.l10n.t('Use in production - Latest generation'),
                    group: recommendedGroup
                }
            );

            if (this._supportsMV4) {
                skus.push({
                    name: 'P1MV4',
                    tier: 'Premium V4',
                    size: 'P1MV4',
                    family: 'Pv4',
                    capacity: 1,
                    label: vscode.l10n.t('Premium Memory Optimized (P1MV4)'),
                    description: vscode.l10n.t('Use in production - Memory optimized'),
                    group: recommendedGroup
                });
            }
        } else {
            // Fallback to Premium V3 for regions without V4 support
            skus.push(
                {
                    name: 'P0V3',
                    tier: 'Premium V3',
                    size: 'P0V3',
                    family: 'Pv3',
                    capacity: 1,
                    label: vscode.l10n.t('Premium (P0V3)'),
                    description: vscode.l10n.t('Use in production'),
                    group: recommendedGroup
                },
                {
                    name: 'P1V3',
                    tier: 'Premium V3',
                    size: 'P1V3',
                    family: 'Pv3',
                    capacity: 1,
                    label: vscode.l10n.t('Premium (P1V3)'),
                    description: vscode.l10n.t('Use in production'),
                    group: recommendedGroup
                },
                {
                    name: 'P1MV3',
                    tier: 'Premium V3',
                    size: 'P1MV3',
                    family: 'Pv3',
                    capacity: 1,
                    label: vscode.l10n.t('Premium Memory Optimized (P1MV3)'),
                    description: vscode.l10n.t('Use in production - Memory optimized'),
                    group: recommendedGroup
                }
            );
        }

        return skus;
    }

    private getAdvancedSkus(): SkuDescriptionWithMeta[] {
        const advancedSkus: SkuDescriptionWithMeta[] = [
            // Basic tiers
            {
                name: 'B2',
                tier: 'Basic',
                size: 'B2',
                family: 'B',
                capacity: 1
            },
            {
                name: 'B3',
                tier: 'Basic',
                size: 'B3',
                family: 'B',
                capacity: 1
            },
            // Standard tiers
            {
                name: 'S1',
                tier: 'Standard',
                size: 'S1',
                family: 'S',
                capacity: 1
            },
            {
                name: 'S2',
                tier: 'Standard',
                size: 'S2',
                family: 'S',
                capacity: 1
            },
            {
                name: 'S3',
                tier: 'Standard',
                size: 'S3',
                family: 'S',
                capacity: 1
            }
        ];

        // Add Premium V3 additional tiers
        if (!this._supportsPV4) {
            // If no V4 support, add remaining V3 options
            advancedSkus.push(
                {
                    name: 'P2V3',
                    tier: 'Premium V3',
                    size: 'P2V3',
                    family: 'Pv3',
                    capacity: 1
                },
                {
                    name: 'P3V3',
                    tier: 'Premium V3',
                    size: 'P3V3',
                    family: 'Pv3',
                    capacity: 1
                }
            );
        } else {
            // If V4 is supported, add remaining V4 options and all V3 options
            advancedSkus.push(
                {
                    name: 'P2V4',
                    tier: 'Premium V4',
                    size: 'P2V4',
                    family: 'Pv4',
                    capacity: 1
                },
                {
                    name: 'P3V4',
                    tier: 'Premium V4',
                    size: 'P3V4',
                    family: 'Pv4',
                    capacity: 1
                },
                // V3 options as alternatives
                {
                    name: 'P0V3',
                    tier: 'Premium V3',
                    size: 'P0V3',
                    family: 'Pv3',
                    capacity: 1
                },
                {
                    name: 'P1V3',
                    tier: 'Premium V3',
                    size: 'P1V3',
                    family: 'Pv3',
                    capacity: 1
                },
                {
                    name: 'P2V3',
                    tier: 'Premium V3',
                    size: 'P2V3',
                    family: 'Pv3',
                    capacity: 1
                },
                {
                    name: 'P3V3',
                    tier: 'Premium V3',
                    size: 'P3V3',
                    family: 'Pv3',
                    capacity: 1
                }
            );

            if (this._supportsMV4) {
                advancedSkus.push(
                    {
                        name: 'P2MV4',
                        tier: 'Premium V4',
                        size: 'P2MV4',
                        family: 'Pv4',
                        capacity: 1
                    },
                    {
                        name: 'P3MV4',
                        tier: 'Premium V4',
                        size: 'P3MV4',
                        family: 'Pv4',
                        capacity: 1
                    }
                );
            }

            // Add V3 memory optimized options
            advancedSkus.push(
                {
                    name: 'P1MV3',
                    tier: 'Premium V3',
                    size: 'P1MV3',
                    family: 'Pv3',
                    capacity: 1
                },
                {
                    name: 'P2MV3',
                    tier: 'Premium V3',
                    size: 'P2MV3',
                    family: 'Pv3',
                    capacity: 1
                },
                {
                    name: 'P3MV3',
                    tier: 'Premium V3',
                    size: 'P3MV3',
                    family: 'Pv3',
                    capacity: 1
                }
            );
        }

        // Legacy PV2 SKUs - moved to advanced (deprioritized)
        advancedSkus.push(
            {
                name: 'P1v2',
                tier: 'Premium V2',
                size: 'P1v2',
                family: 'Pv2',
                capacity: 1
            },
            {
                name: 'P2v2',
                tier: 'Premium V2',
                size: 'P2v2',
                family: 'Pv2',
                capacity: 1
            },
            {
                name: 'P3v2',
                tier: 'Premium V2',
                size: 'P3v2',
                family: 'Pv2',
                capacity: 1
            }
        );

        return advancedSkus;
    }
}

type SkuDescriptionWithMeta = SkuDescription & {
    label?: string;
    description?: string;
    group?: string;
};