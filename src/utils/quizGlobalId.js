import {
    legacy_current_route_address,
    legacy_quiz_addresses,
    quiz_address,
    routed_quiz_addresses,
} from "../contract/config";

function normalizeAddress(value = "") {
    return String(value || "").trim().toLowerCase();
}

const uniqueLegacyAddresses = (legacy_quiz_addresses || []).filter(
    (address, index, list) => {
        const normalized = normalizeAddress(address);
        return Boolean(normalized) && list.findIndex((item) => normalizeAddress(item) === normalized) === index;
    }
);

const uniqueRoutedAddresses = (routed_quiz_addresses || []).filter(
    (address, index, list) => {
        const normalized = normalizeAddress(address);
        return Boolean(normalized) && list.findIndex((item) => normalizeAddress(item) === normalized) === index;
    }
);

const BLOCKED_QUIZ_REF = { id: -1, address: "" };

export function toGlobalId(localId, sourceAddress) {
    const normAddress = normalizeAddress(sourceAddress || quiz_address);
    const numericLocalId = Number(localId);

    if (!Number.isFinite(numericLocalId) || numericLocalId < 0) {
        return String(localId ?? "");
    }

    const routedIndex = uniqueRoutedAddresses.findIndex(
        (address) => normalizeAddress(address) === normAddress
    );
    if (routedIndex >= 0) {
        return `q${routedIndex}-${numericLocalId}`;
    }

    const legacyIndex = uniqueLegacyAddresses.findIndex(
        (address) => normalizeAddress(address) === normAddress
    );
    if (legacyIndex >= 0) {
        return `l${legacyIndex}-${numericLocalId}`;
    }

    return -1;
}

export function resolveGlobalId(globalId) {
    const raw = String(globalId ?? "").trim();

    const currentMatch = raw.match(/^c-(\d+)$/i);
    if (currentMatch) {
        return legacy_current_route_address
            ? {
                address: legacy_current_route_address,
                id: Number(currentMatch[1]),
            }
            : BLOCKED_QUIZ_REF;
    }

    const routedMatch = raw.match(/^q(\d+)-(\d+)$/i);
    if (routedMatch) {
        const routedAddress = uniqueRoutedAddresses[Number(routedMatch[1])];
        if (!routedAddress) return BLOCKED_QUIZ_REF;
        return {
            address: routedAddress,
            id: Number(routedMatch[2]),
        };
    }

    const legacyMatch = raw.match(/^l(\d+)-(\d+)$/i);
    if (legacyMatch) {
        const legacyAddress = uniqueLegacyAddresses[Number(legacyMatch[1])];
        if (!legacyAddress) return BLOCKED_QUIZ_REF;
        return {
            address: legacyAddress,
            id: Number(legacyMatch[2]),
        };
    }

    const customMatch = raw.match(/^u-(0x[a-f0-9]+)-(\d+)$/i);
    if (customMatch) {
        if (normalizeAddress(customMatch[1]) !== normalizeAddress(quiz_address)) {
            return BLOCKED_QUIZ_REF;
        }
        return {
            address: customMatch[1],
            id: Number(customMatch[2]),
        };
    }

    const numericGlobalId = Number(raw);
    if (Number.isFinite(numericGlobalId) && numericGlobalId >= 0) {
        return {
            address: quiz_address,
            id: numericGlobalId,
        };
    }

    return { id: Number(raw) || 0, address: quiz_address };
}
