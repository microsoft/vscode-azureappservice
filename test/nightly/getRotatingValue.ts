/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

let locationCount: number = getStartingIndex();
const locations: string[] = ['Australia East', 'Australia Southeast', 'Brazil South', 'Canada Central', 'Central US', 'East Asia', 'East US', 'East US 2', 'France Central', 'Japan East', 'Japan West', 'Korea Central', 'Korea South', 'North Europe', 'South Central US', 'Southeast Asia', 'UK South', 'West Europe', 'West US', 'West US 2'];
export function getRotatingLocation(): string {
    locationCount += 1;
    return locations[locationCount % locations.length];
}

let pricingTierCount: number = getStartingIndex();
const pricingTiers: string[] = ['P1v2', 'P2v2', 'P3v2', 'B1', 'B2', 'B3', 'S1', 'S2', 'S3'];
export function getRotatingPricingTier(): string {
    pricingTierCount += 1;
    return pricingTiers[pricingTierCount % pricingTiers.length];
}

/**
 * Adds a little more spice to the rotation
 */
function getStartingIndex(): number {
    if (process.platform === 'darwin') {
        return 0;
    } else if (process.platform === 'win32') {
        return 5;
    } else {
        return 10;
    }
}
