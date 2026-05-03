/**
 * Common spelling / official-name variants for Indian cities (service-area matching).
 * Keeps admin-configured city strings (e.g. "Bangalore") aligned with checkout/OSM (e.g. "Bengaluru").
 */
const ALIAS_GROUPS: string[][] = [
    ['bangalore', 'bengaluru', 'banglore', 'bengalore', 'bengalooru', 'bbmp', 'bangalore urban', 'bengaluru urban'],
    ['mumbai', 'bombay'],
    ['kolkata', 'calcutta'],
    ['chennai', 'madras'],
    ['kochi', 'cochin'],
    ['thiruvananthapuram', 'trivandrum'],
    ['gurugram', 'gurgaon'],
    ['bhubaneswar', 'bhubaneshwar'],
];

function normalizeCityToken(s: string): string {
    return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function cityMatchesAlias(normalized: string, alias: string): boolean {
    if (normalized === alias) return true;
    if (normalized.startsWith(`${alias} `)) return true;
    if (normalized.endsWith(` ${alias}`)) return true;
    if (normalized.includes(` ${alias} `)) return true;
    return false;
}

function inAliasGroup(normalized: string, group: string[]): boolean {
    return group.some((alias) => cityMatchesAlias(normalized, alias));
}

/** True if both names refer to the same Indian city (handles Bangalore/Bengaluru, etc.). */
export function indianCitiesEquivalent(a: string, b: string): boolean {
    const na = normalizeCityToken(a);
    const nb = normalizeCityToken(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    for (const group of ALIAS_GROUPS) {
        if (inAliasGroup(na, group) && inAliasGroup(nb, group)) return true;
    }
    return false;
}

/** True if user-supplied city matches any configured serviceable city string. */
export function userCityMatchesServiceList(userCity: string, serviceableCities: string[]): boolean {
    const u = userCity.trim();
    if (!u) return false;
    return serviceableCities.some((listed) => indianCitiesEquivalent(u, listed));
}
