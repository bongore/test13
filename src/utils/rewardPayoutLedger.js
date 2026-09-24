import { fetchLiveSignalJson } from "./liveSignalApi";

const STORAGE_KEY = "web3_quiz_reward_payout_ledger_v1";

function normalizeAddress(address) {
    return String(address || "").trim().toLowerCase();
}

function normalizeEntry(entry = {}) {
    const quizId = Number(entry?.quizId || 0);
    const sourceAddress = normalizeAddress(entry?.sourceAddress || "");
    const studentAddress = normalizeAddress(entry?.studentAddress || entry?.address || "");
    const txHash = String(entry?.txHash || "");
    const paidAt = entry?.paidAt || entry?.createdAt || new Date().toISOString();
    const resultState = String(entry?.resultState || "");
    const rewardTft = Number(entry?.rewardTft || 0);
    const id = String(
        entry?.id
        || [sourceAddress, quizId, studentAddress, txHash || paidAt, resultState || rewardTft].join(":")
    );

    return {
        id,
        quizId,
        sourceAddress,
        quizTitle: String(entry?.quizTitle || ""),
        studentAddress,
        studentName: String(entry?.studentName || ""),
        studentId: String(entry?.studentId || ""),
        answerText: String(entry?.answerText || ""),
        resultState,
        rewardTft,
        rewardWei: String(entry?.rewardWei || ""),
        txHash,
        actorAddress: normalizeAddress(entry?.actorAddress || ""),
        mode: String(entry?.mode || ""),
        contractTypeLabel: String(entry?.contractTypeLabel || ""),
        paidAt,
        confirmed: entry?.confirmed !== false,
    };
}

function normalizeEntries(entries = []) {
    const deduped = new Map();
    (Array.isArray(entries) ? entries : []).forEach((entry) => {
        const normalized = normalizeEntry(entry);
        if (normalized.quizId == null || !normalized.studentAddress) return;
        deduped.set(normalized.id, normalized);
    });
    return Array.from(deduped.values()).sort(
        (left, right) => new Date(right.paidAt || 0) - new Date(left.paidAt || 0)
    );
}

function readRewardPayoutEntries() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? normalizeEntries(JSON.parse(raw)) : [];
    } catch (error) {
        console.error("Failed to read reward payout ledger", error);
        return [];
    }
}

function writeRewardPayoutEntries(entries = []) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeEntries(entries)));
}

function mergeRewardPayoutEntries(baseEntries = [], nextEntries = []) {
    return normalizeEntries([...(Array.isArray(baseEntries) ? baseEntries : []), ...(Array.isArray(nextEntries) ? nextEntries : [])]);
}

async function syncRewardPayoutLedgerFromServer() {
    const localEntries = readRewardPayoutEntries();
    const response = await fetchLiveSignalJson("/reward-payouts", { method: "GET" });
    const serverEntries = Array.isArray(response?.entries) ? response.entries : [];
    const mergedEntries = mergeRewardPayoutEntries(localEntries, serverEntries);
    writeRewardPayoutEntries(mergedEntries);
    return mergedEntries;
}

async function persistRewardPayoutEntriesToServer(entries = []) {
    const normalizedEntries = normalizeEntries(entries);
    const response = await fetchLiveSignalJson("/reward-payouts", {
        method: "POST",
        body: JSON.stringify({ entries: normalizedEntries }),
    });
    const serverEntries = Array.isArray(response?.entries) ? response.entries : [];
    const mergedEntries = mergeRewardPayoutEntries(readRewardPayoutEntries(), serverEntries);
    writeRewardPayoutEntries(mergedEntries);
    return mergedEntries;
}

function getRewardPayoutEntries(filters = {}) {
    const entries = readRewardPayoutEntries();
    const quizIdFilter = filters?.quizId != null ? Number(filters.quizId) : null;
    const sourceAddressFilter = filters?.sourceAddress ? normalizeAddress(filters.sourceAddress) : "";
    const studentAddressFilter = filters?.studentAddress ? normalizeAddress(filters.studentAddress) : "";
    return entries.filter((entry) => {
        if (quizIdFilter != null && Number(entry.quizId) !== quizIdFilter) return false;
        if (sourceAddressFilter && normalizeAddress(entry.sourceAddress) !== sourceAddressFilter) return false;
        if (studentAddressFilter && normalizeAddress(entry.studentAddress) !== studentAddressFilter) return false;
        return true;
    });
}

export {
    getRewardPayoutEntries,
    mergeRewardPayoutEntries,
    normalizeEntry as normalizeRewardPayoutEntry,
    normalizeEntries as normalizeRewardPayoutEntries,
    persistRewardPayoutEntriesToServer,
    readRewardPayoutEntries,
    syncRewardPayoutLedgerFromServer,
};
