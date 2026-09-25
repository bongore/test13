import { fetchLiveSignalJson } from "./liveSignalApi";
import {
    CURRENT_TOKEN_GRANT_COURSE_KEY,
    CURRENT_TOKEN_GRANT_COURSE_LABEL,
    LEGACY_TOKEN_GRANT_COURSE_KEY,
    LEGACY_TOKEN_GRANT_COURSE_LABEL,
    normalizeCourseKey,
} from "./tokenGrantLedger";

const COURSE_STUDENT_ROSTER_STORAGE_KEY = "web3_quiz_course_student_roster_v1";

function normalizeAddress(address = "") {
    return String(address || "").trim().toLowerCase();
}

function getCourseLabel(courseKey = "") {
    const normalizedCourseKey = normalizeCourseKey(courseKey);
    if (normalizedCourseKey === CURRENT_TOKEN_GRANT_COURSE_KEY) return CURRENT_TOKEN_GRANT_COURSE_LABEL;
    if (normalizedCourseKey === LEGACY_TOKEN_GRANT_COURSE_KEY) return LEGACY_TOKEN_GRANT_COURSE_LABEL;
    return normalizedCourseKey;
}

function normalizeRosterEntry(entry = {}, fallbackCourseKey = CURRENT_TOKEN_GRANT_COURSE_KEY) {
    const address = normalizeAddress(entry?.address || entry);
    const courseKey = normalizeCourseKey(entry?.courseKey || fallbackCourseKey);
    if (!address) return null;
    return {
        address,
        courseKey,
        courseLabel: entry?.courseLabel || getCourseLabel(courseKey),
        addedAt: entry?.addedAt || new Date().toISOString(),
        source: entry?.source || "admin_add_student",
        actorAddress: normalizeAddress(entry?.actorAddress || ""),
    };
}

function normalizeRosterMap(rawMap = {}) {
    const normalized = {};
    Object.entries(rawMap || {}).forEach(([courseKey, entries]) => {
        const normalizedCourseKey = normalizeCourseKey(courseKey);
        const entryList = Array.isArray(entries)
            ? entries
            : Object.values(entries || {});
        const deduped = new Map();
        entryList.forEach((entry) => {
            const normalizedEntry = normalizeRosterEntry(entry, normalizedCourseKey);
            if (!normalizedEntry) return;
            deduped.set(normalizedEntry.address, normalizedEntry);
        });
        normalized[normalizedCourseKey] = Array.from(deduped.values())
            .sort((left, right) => String(left.addedAt).localeCompare(String(right.addedAt)));
    });
    return normalized;
}

function readCourseStudentRoster() {
    try {
        if (typeof localStorage === "undefined") return {};
        return normalizeRosterMap(JSON.parse(localStorage.getItem(COURSE_STUDENT_ROSTER_STORAGE_KEY) || "{}"));
    } catch (error) {
        console.error("Failed to read course student roster", error);
        return {};
    }
}

function writeCourseStudentRoster(nextRoster = {}) {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(COURSE_STUDENT_ROSTER_STORAGE_KEY, JSON.stringify(normalizeRosterMap(nextRoster)));
}

function mergeCourseStudentRoster(baseRoster = {}, nextRoster = {}) {
    const base = normalizeRosterMap(baseRoster);
    const next = normalizeRosterMap(nextRoster);
    const merged = { ...base };
    Object.entries(next).forEach(([courseKey, entries]) => {
        const deduped = new Map((merged[courseKey] || []).map((entry) => [entry.address, entry]));
        entries.forEach((entry) => deduped.set(entry.address, entry));
        merged[courseKey] = Array.from(deduped.values())
            .sort((left, right) => String(left.addedAt).localeCompare(String(right.addedAt)));
    });
    return normalizeRosterMap(merged);
}

function getCourseStudentEntries(courseKey = CURRENT_TOKEN_GRANT_COURSE_KEY) {
    return readCourseStudentRoster()[normalizeCourseKey(courseKey)] || [];
}

function getCourseStudents(courseKey = CURRENT_TOKEN_GRANT_COURSE_KEY) {
    return getCourseStudentEntries(courseKey).map((entry) => entry.address);
}

function saveCourseStudents(courseKey = CURRENT_TOKEN_GRANT_COURSE_KEY, addresses = [], payload = {}) {
    const normalizedCourseKey = normalizeCourseKey(courseKey);
    const currentRoster = readCourseStudentRoster();
    const currentEntries = currentRoster[normalizedCourseKey] || [];
    const deduped = new Map(currentEntries.map((entry) => [entry.address, entry]));
    (Array.isArray(addresses) ? addresses : [addresses]).forEach((address) => {
        const normalizedEntry = normalizeRosterEntry({
            address,
            ...payload,
            courseKey: normalizedCourseKey,
            courseLabel: payload.courseLabel || getCourseLabel(normalizedCourseKey),
        }, normalizedCourseKey);
        if (!normalizedEntry) return;
        deduped.set(normalizedEntry.address, normalizedEntry);
    });
    const nextRoster = {
        ...currentRoster,
        [normalizedCourseKey]: Array.from(deduped.values()),
    };
    writeCourseStudentRoster(nextRoster);
    return nextRoster[normalizedCourseKey] || [];
}

async function syncCourseStudentsFromServer() {
    const localRoster = readCourseStudentRoster();
    const response = await fetchLiveSignalJson("/course-students", { method: "GET" });
    const serverRoster = normalizeRosterMap(response?.courseStudents || {});
    const mergedRoster = mergeCourseStudentRoster(localRoster, serverRoster);
    writeCourseStudentRoster(mergedRoster);
    return mergedRoster;
}

async function persistCourseStudentsToServer(courseKey = CURRENT_TOKEN_GRANT_COURSE_KEY, addresses = [], payload = {}) {
    const normalizedCourseKey = normalizeCourseKey(courseKey);
    saveCourseStudents(normalizedCourseKey, addresses, payload);
    const response = await fetchLiveSignalJson("/course-students", {
        method: "POST",
        body: JSON.stringify({
            courseKey: normalizedCourseKey,
            addresses,
            payload,
        }),
    });
    const mergedRoster = mergeCourseStudentRoster(readCourseStudentRoster(), response?.courseStudents || {});
    writeCourseStudentRoster(mergedRoster);
    return mergedRoster;
}

export {
    COURSE_STUDENT_ROSTER_STORAGE_KEY,
    getCourseStudentEntries,
    getCourseStudents,
    mergeCourseStudentRoster,
    normalizeRosterMap,
    persistCourseStudentsToServer,
    readCourseStudentRoster,
    saveCourseStudents,
    syncCourseStudentsFromServer,
    writeCourseStudentRoster,
};
