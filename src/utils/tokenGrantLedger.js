import { fetchLiveSignalJson } from "./liveSignalApi";

const STORAGE_KEY = "web3_quiz_token_grant_ledger_v1";
const PENDING_GRANT_TTL_MS = 10 * 60 * 1000;

const TOKEN_GRANT_KEYS = {
    POL: "answer_pol",
    TFT: "answer_thanks_tft",
    TTT: "board_ttt",
};

const TOKEN_GRANT_COURSES = {
    APPLIED_MATH: {
        key: "applied_math_2026",
        label: "応用数学",
        legacy: true,
    },
    INFORMATION_THEORY: {
        key: "information_theory_2026",
        label: "情報理論",
        legacy: false,
    },
};

const LEGACY_TOKEN_GRANT_COURSE_KEY = TOKEN_GRANT_COURSES.APPLIED_MATH.key;
const LEGACY_TOKEN_GRANT_COURSE_LABEL = TOKEN_GRANT_COURSES.APPLIED_MATH.label;
const CURRENT_TOKEN_GRANT_COURSE_KEY = TOKEN_GRANT_COURSES.INFORMATION_THEORY.key;
const CURRENT_TOKEN_GRANT_COURSE_LABEL = TOKEN_GRANT_COURSES.INFORMATION_THEORY.label;

function normalizeAddress(address) {
    return String(address || "").toLowerCase();
}

function normalizeCourseKey(courseKey = "") {
    return String(courseKey || LEGACY_TOKEN_GRANT_COURSE_KEY)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "_")
        .replace(/^_+|_+$/g, "") || LEGACY_TOKEN_GRANT_COURSE_KEY;
}

function getCourseLabel(courseKey = "", fallbackLabel = "") {
    const normalizedCourseKey = normalizeCourseKey(courseKey);
    const matched = Object.values(TOKEN_GRANT_COURSES).find((course) => course.key === normalizedCourseKey);
    return String(fallbackLabel || matched?.label || normalizedCourseKey);
}

function inferHistoryType(record = {}) {
    const source = String(record?.source || "");
    if (source.includes("clear_manual_mark")) return "clear";
    if (source.includes("manual_mark")) return "manual_mark";
    return "grant";
}

function normalizeHistoryEntry(entry = {}) {
    const courseKey = normalizeCourseKey(entry?.courseKey || entry?.lectureKey || entry?.course || LEGACY_TOKEN_GRANT_COURSE_KEY);
    return {
        type: entry?.type || inferHistoryType(entry),
        at: entry?.at || entry?.grantedAt || new Date().toISOString(),
        amount: entry?.amount ?? null,
        txHash: entry?.txHash || "",
        source: entry?.source || "",
        confirmed: entry?.confirmed !== false,
        active: entry?.active !== false,
        courseKey,
        courseLabel: getCourseLabel(courseKey, entry?.courseLabel || entry?.lectureLabel),
    };
}

function normalizeGrantRecord(record = null) {
    if (!record || typeof record !== "object") return null;

    const history = Array.isArray(record.history) && record.history.length > 0
        ? record.history.map((entry) => normalizeHistoryEntry(entry))
        : [normalizeHistoryEntry(record)];

    return {
        grantedAt: record.grantedAt || history[history.length - 1]?.at || "",
        amount: record.amount ?? null,
        txHash: record.txHash || "",
        source: record.source || "",
        confirmed: record.confirmed !== false,
        active: record.active !== false,
        courseKey: normalizeCourseKey(record.courseKey || history[history.length - 1]?.courseKey || LEGACY_TOKEN_GRANT_COURSE_KEY),
        courseLabel: getCourseLabel(record.courseKey || history[history.length - 1]?.courseKey, record.courseLabel || history[history.length - 1]?.courseLabel),
        history,
    };
}

function getGrantRecordForCourse(record = null, courseKey = CURRENT_TOKEN_GRANT_COURSE_KEY) {
    const normalizedRecord = normalizeGrantRecord(record);
    if (!normalizedRecord) return null;
    const normalizedCourseKey = normalizeCourseKey(courseKey);
    const courseHistory = (normalizedRecord.history || [])
        .filter((entry) => normalizeCourseKey(entry?.courseKey) === normalizedCourseKey)
        .map((entry) => normalizeHistoryEntry(entry));
    if (courseHistory.length === 0) return null;

    const history = courseHistory.sort((left, right) => String(left.at).localeCompare(String(right.at)));
    const latestEntry = history[history.length - 1];
    const latestTxEntry = [...history].reverse().find((entry) => entry.txHash);
    return {
        grantedAt: latestEntry.at || "",
        amount: latestEntry.amount ?? null,
        txHash: latestEntry.txHash || latestTxEntry?.txHash || "",
        source: latestEntry.source || "",
        confirmed: latestEntry.confirmed !== false,
        active: latestEntry.active !== false,
        courseKey: normalizedCourseKey,
        courseLabel: getCourseLabel(normalizedCourseKey, latestEntry.courseLabel),
        history,
    };
}

function getRecordTimestamp(record) {
    if (!record?.grantedAt) return 0;
    const timestamp = new Date(record.grantedAt).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeLedger(rawLedger = {}) {
    const nextLedger = {};
    Object.entries(rawLedger || {}).forEach(([address, status]) => {
        const normalizedAddress = normalizeAddress(address);
        const normalizedStatus = {};
        Object.values(TOKEN_GRANT_KEYS).forEach((assetKey) => {
            const normalizedRecord = normalizeGrantRecord(status?.[assetKey]);
            if (normalizedRecord) {
                normalizedStatus[assetKey] = normalizedRecord;
            }
        });
        if (Object.keys(normalizedStatus).length > 0) {
            nextLedger[normalizedAddress] = normalizedStatus;
        }
    });
    return nextLedger;
}

function readGrantLedger() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return normalizeLedger(parsed);
    } catch (error) {
        console.error("Failed to read token grant ledger", error);
        return {};
    }
}

function writeGrantLedger(nextLedger) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeLedger(nextLedger)));
}

function getAddressGrantStatus(address, courseKey = "") {
    const ledger = readGrantLedger();
    const status = ledger[normalizeAddress(address)] || {};
    if (!courseKey) return status;

    return Object.fromEntries(
        Object.values(TOKEN_GRANT_KEYS)
            .map((assetKey) => [assetKey, getGrantRecordForCourse(status?.[assetKey], courseKey)])
            .filter(([, record]) => Boolean(record))
    );
}

function mergeGrantRecord(currentRecord, nextRecord) {
    const current = normalizeGrantRecord(currentRecord);
    const next = normalizeGrantRecord(nextRecord);
    if (!current) return next;
    if (!next) return current;

    const historyMap = new Map();
    [...(current.history || []), ...(next.history || [])].forEach((entry) => {
        const normalizedEntry = normalizeHistoryEntry(entry);
        const key = [
            normalizedEntry.type,
            normalizedEntry.at,
            normalizedEntry.txHash,
            normalizedEntry.amount,
            normalizedEntry.source,
            normalizedEntry.active,
        ].join("|");
        historyMap.set(key, normalizedEntry);
    });

    const history = Array.from(historyMap.values()).sort((left, right) => String(left.at).localeCompare(String(right.at)));
    const latestEntry = history[history.length - 1] || normalizeHistoryEntry({});
    const latestConfirmedTx = [...history].reverse().find((entry) => entry.txHash);

    return {
        grantedAt: latestEntry.at || next.grantedAt || current.grantedAt || "",
        amount: latestEntry.amount ?? next.amount ?? current.amount ?? null,
        txHash: latestEntry.txHash || latestConfirmedTx?.txHash || next.txHash || current.txHash || "",
        source: latestEntry.source || next.source || current.source || "",
        confirmed: latestEntry.confirmed !== false,
        active: latestEntry.active !== false,
        history,
    };
}

function mergeGrantLedger(baseLedger = {}, nextLedger = {}) {
    const base = normalizeLedger(baseLedger);
    const next = normalizeLedger(nextLedger);
    const merged = { ...base };

    Object.entries(next).forEach(([address, status]) => {
        const normalizedAddress = normalizeAddress(address);
        const currentStatus = merged[normalizedAddress] || {};
        const nextStatus = status && typeof status === "object" ? status : {};
        const mergedStatus = {};

        Object.values(TOKEN_GRANT_KEYS).forEach((assetKey) => {
            const mergedRecord = mergeGrantRecord(currentStatus[assetKey], nextStatus[assetKey]);
            if (mergedRecord) {
                mergedStatus[assetKey] = mergedRecord;
            }
        });

        if (Object.keys(mergedStatus).length > 0) {
            merged[normalizedAddress] = mergedStatus;
        }
    });

    return normalizeLedger(merged);
}

async function syncGrantLedgerFromServer() {
    const localLedger = readGrantLedger();
    const response = await fetchLiveSignalJson("/token-grants", { method: "GET" });
    const serverLedger = response?.ledger && typeof response.ledger === "object" ? response.ledger : {};
    const ledger = mergeGrantLedger(localLedger, serverLedger);
    writeGrantLedger(ledger);
    return ledger;
}

async function persistGrantRecordToServer(address, assetKey, payload = {}) {
    const response = await fetchLiveSignalJson("/token-grants", {
        method: "POST",
        body: JSON.stringify({
            address: normalizeAddress(address),
            assetKey,
            payload,
        }),
    });
    const serverLedger = response?.ledger && typeof response.ledger === "object" ? response.ledger : {};
    const ledger = mergeGrantLedger(readGrantLedger(), serverLedger);
    writeGrantLedger(ledger);
    return ledger;
}

async function removeGrantRecordFromServer(address, assetKey, payload = {}) {
    const response = await fetchLiveSignalJson("/token-grants", {
        method: "POST",
        body: JSON.stringify({
            address: normalizeAddress(address),
            assetKey,
            remove: true,
            payload,
        }),
    });
    const serverLedger = response?.ledger && typeof response.ledger === "object" ? response.ledger : {};
    const ledger = mergeGrantLedger(readGrantLedger(), serverLedger);
    writeGrantLedger(ledger);
    return ledger;
}

function isGrantActive(record) {
    return Boolean(record?.active !== false && record?.confirmed !== false && record?.grantedAt);
}

function isGrantPending(record) {
    if (!record || record?.active === false || record?.confirmed !== false || !record?.grantedAt) {
        return false;
    }
    const grantedAt = getRecordTimestamp(record);
    if (!grantedAt) return false;
    return (Date.now() - grantedAt) <= PENDING_GRANT_TTL_MS;
}

function isGrantReserved(record) {
    return Boolean(isGrantActive(record) || isGrantPending(record));
}

function hasGrantedToken(address, assetKey, courseKey = "") {
    const status = getAddressGrantStatus(address, courseKey);
    return isGrantReserved(status?.[assetKey]);
}

function markGrantedToken(address, assetKey, payload = {}) {
    const ledger = readGrantLedger();
    const normalizedAddress = normalizeAddress(address);
    const current = ledger[normalizedAddress] || {};
    const currentRecord = normalizeGrantRecord(current[assetKey]);
    const history = [...(currentRecord?.history || [])];
    const nextEntry = normalizeHistoryEntry({
        type: inferHistoryType(payload),
        at: payload.grantedAt || new Date().toISOString(),
        amount: payload.amount ?? null,
        txHash: payload.txHash || "",
        source: payload.source || "",
        confirmed: payload.confirmed !== false,
        active: true,
        courseKey: payload.courseKey || CURRENT_TOKEN_GRANT_COURSE_KEY,
        courseLabel: payload.courseLabel || CURRENT_TOKEN_GRANT_COURSE_LABEL,
    });
    history.push(nextEntry);

    ledger[normalizedAddress] = {
        ...current,
        [assetKey]: {
            grantedAt: nextEntry.at,
            amount: nextEntry.amount,
            txHash: nextEntry.txHash || currentRecord?.txHash || "",
            source: nextEntry.source,
            confirmed: nextEntry.confirmed,
            active: true,
            courseKey: nextEntry.courseKey,
            courseLabel: nextEntry.courseLabel,
            history,
        },
    };

    writeGrantLedger(ledger);
    return ledger[normalizedAddress];
}

function clearGrantedToken(address, assetKey, payload = {}) {
    const ledger = readGrantLedger();
    const normalizedAddress = normalizeAddress(address);
    const current = ledger[normalizedAddress];
    const currentRecord = normalizeGrantRecord(current?.[assetKey]);
    if (!currentRecord) return ledger;

    const history = [...(currentRecord.history || [])];
    const nextEntry = normalizeHistoryEntry({
        type: "clear",
        at: payload.grantedAt || new Date().toISOString(),
        amount: payload.amount ?? currentRecord.amount ?? null,
        txHash: "",
        source: payload.source || "manual_clear",
        confirmed: true,
        active: false,
        courseKey: payload.courseKey || CURRENT_TOKEN_GRANT_COURSE_KEY,
        courseLabel: payload.courseLabel || CURRENT_TOKEN_GRANT_COURSE_LABEL,
    });
    history.push(nextEntry);

    ledger[normalizedAddress] = {
        ...current,
        [assetKey]: {
            grantedAt: nextEntry.at,
            amount: currentRecord.amount ?? null,
            txHash: currentRecord.txHash || "",
            source: nextEntry.source,
            confirmed: true,
            active: false,
            courseKey: nextEntry.courseKey,
            courseLabel: nextEntry.courseLabel,
            history,
        },
    };

    writeGrantLedger(ledger);
    return ledger;
}

function getGrantLedgerEntries(courseKey = "") {
    const ledger = readGrantLedger();
    return Object.entries(ledger)
        .map(([address, status]) => ({
            address,
            status: courseKey
                ? Object.fromEntries(
                    Object.values(TOKEN_GRANT_KEYS)
                        .map((assetKey) => [assetKey, getGrantRecordForCourse(status?.[assetKey], courseKey)])
                        .filter(([, record]) => Boolean(record))
                )
                : (status || {}),
        }))
        .filter((entry) => !courseKey || Object.keys(entry.status || {}).length > 0);
}

export {
    CURRENT_TOKEN_GRANT_COURSE_KEY,
    CURRENT_TOKEN_GRANT_COURSE_LABEL,
    LEGACY_TOKEN_GRANT_COURSE_KEY,
    LEGACY_TOKEN_GRANT_COURSE_LABEL,
    TOKEN_GRANT_COURSES,
    TOKEN_GRANT_KEYS,
    readGrantLedger,
    getAddressGrantStatus,
    getGrantRecordForCourse,
    hasGrantedToken,
    isGrantActive,
    isGrantReserved,
    markGrantedToken,
    clearGrantedToken,
    getGrantLedgerEntries,
    syncGrantLedgerFromServer,
    persistGrantRecordToServer,
    removeGrantRecordFromServer,
    mergeGrantLedger,
    normalizeGrantRecord,
    normalizeCourseKey,
};
