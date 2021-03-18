/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


let locationCount: number = -1;
const locationItem: string[] = ['Australia East', 'Australia Southeast', 'Brazil South', 'Canada Central', 'Central US', 'East Asia', 'East US', 'East US 2', 'France Central', 'Japan East', 'Japan West', 'Korea Central', 'Korea South', 'North Europe', 'South Central US', 'Southeast Asia', 'UK South', 'West Europe', 'West US', 'West US 2'];
new Date().getDate() % 2 === 0 ? locationItem : locationItem.reverse();
export function getLocation(): string {
    locationCount += 1;
    return locationItem[locationCount % locationItem.length];
}

let pricingTierCount: number = -1;
const pricingTierItem: string[] = ['P1v2', 'P2v2', 'P3v2', 'B1', 'B2', 'B3', 'S1', 'S2', 'S3'];
export function getPricingTier(): string {
    pricingTierCount += 1;
    return pricingTierItem[pricingTierCount % pricingTierItem.length];
}
