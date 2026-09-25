import React, { useEffect, useMemo, useState } from "react";
import { Form } from "react-bootstrap";
import { ACTION_TYPES, appendActivityLog } from "../../../utils/activityLog";
import {
    getCourseStudents,
    persistCourseStudentsToServer,
    syncCourseStudentsFromServer,
} from "../../../utils/courseStudentRoster";
import {
    CURRENT_TOKEN_GRANT_COURSE_KEY,
    CURRENT_TOKEN_GRANT_COURSE_LABEL,
} from "../../../utils/tokenGrantLedger";

function formatInternalId(prefix, index) {
    return `${prefix}-${String(index + 1).padStart(3, "0")}`;
}

function Add_students(props) {
    const [addStudent, setAddStudent] = useState("");
    const [students, setStudents] = useState([]);
    const [courseStudents, setCourseStudents] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [submitError, setSubmitError] = useState("");
    const addStudent_list = useMemo(
        () => addStudent.split("\n").map((item) => item.trim()).filter(Boolean),
        [addStudent]
    );
    const normalizedCandidates = useMemo(
        () => props.cont.normalizeAddressList(addStudent_list),
        [addStudent_list, props.cont]
    );
    const registeredAddressSet = useMemo(
        () => new Set([...(students || []), ...(teachers || [])].map((item) => props.cont.normalizeAddress(item))),
        [students, teachers, props.cont]
    );
    const teacherAddressSet = useMemo(
        () => new Set((teachers || []).map((item) => props.cont.normalizeAddress(item))),
        [teachers, props.cont]
    );
    const globalStudentAddressSet = useMemo(
        () => new Set((students || []).map((item) => props.cont.normalizeAddress(item))),
        [students, props.cont]
    );
    const courseStudentAddressSet = useMemo(
        () => new Set((courseStudents || []).map((item) => props.cont.normalizeAddress(item))),
        [courseStudents, props.cont]
    );
    const duplicateRegisteredAddresses = useMemo(
        () => normalizedCandidates.filter((item) => registeredAddressSet.has(props.cont.normalizeAddress(item))),
        [normalizedCandidates, registeredAddressSet, props.cont]
    );
    const alreadyInCourseAddresses = useMemo(
        () => normalizedCandidates.filter((item) => courseStudentAddressSet.has(props.cont.normalizeAddress(item))),
        [normalizedCandidates, courseStudentAddressSet, props.cont]
    );
    const teacherAddresses = useMemo(
        () => normalizedCandidates.filter((item) => teacherAddressSet.has(props.cont.normalizeAddress(item))),
        [normalizedCandidates, teacherAddressSet, props.cont]
    );
    const duplicateRegisteredDetails = useMemo(
        () => duplicateRegisteredAddresses.map((address) => {
            const normalized = props.cont.normalizeAddress(address);
            const teacherIndex = (teachers || []).findIndex((item) => props.cont.normalizeAddress(item) === normalized);
            if (teacherIndex >= 0) {
                return {
                    address,
                    roleLabel: "教員",
                    internalId: formatInternalId("STAFF", teacherIndex),
                };
            }
            const studentIndex = (students || []).findIndex((item) => props.cont.normalizeAddress(item) === normalized);
            if (studentIndex >= 0) {
                return {
                    address,
                    roleLabel: "学生",
                    internalId: formatInternalId("USER", studentIndex),
                };
            }
            return {
                address,
                roleLabel: "登録済みユーザー",
                internalId: "-",
            };
        }),
        [duplicateRegisteredAddresses, teachers, students, props.cont]
    );
    const newStudentTargets = useMemo(
        () => normalizedCandidates.filter((item) => {
            const normalized = props.cont.normalizeAddress(item);
            return !teacherAddressSet.has(normalized) && !courseStudentAddressSet.has(normalized);
        }),
        [normalizedCandidates, teacherAddressSet, courseStudentAddressSet, props.cont]
    );
    const onChainRegisterTargets = useMemo(
        () => newStudentTargets.filter((item) => !globalStudentAddressSet.has(props.cont.normalizeAddress(item))),
        [newStudentTargets, globalStudentAddressSet, props.cont]
    );
    const existingStudentCourseTargets = useMemo(
        () => newStudentTargets.filter((item) => globalStudentAddressSet.has(props.cont.normalizeAddress(item))),
        [newStudentTargets, globalStudentAddressSet, props.cont]
    );

    const loadStudents = async () => {
        try {
            const [studentResult, teacherResult] = await Promise.all([
                props.cont.get_student_list(),
                props.cont.get_teachers(),
            ]);
            setStudents(Array.isArray(studentResult) ? studentResult : []);
            setTeachers(Array.isArray(teacherResult) ? teacherResult : []);
            try {
                await syncCourseStudentsFromServer();
            } catch (syncError) {
                console.error("Failed to sync course students", syncError);
            }
            setCourseStudents(getCourseStudents(CURRENT_TOKEN_GRANT_COURSE_KEY));
        } catch (error) {
            console.error("Failed to load registered students", error);
            setStudents([]);
            setCourseStudents(getCourseStudents(CURRENT_TOKEN_GRANT_COURSE_KEY));
            setTeachers([]);
        }
    };

    const add_student = async () => {
        if (!addStudent_list.length) return;
        if (!newStudentTargets.length) {
            setSubmitError(`入力したアドレスはすべて ${CURRENT_TOKEN_GRANT_COURSE_LABEL} に登録済み、または教員として登録済みです。`);
            return;
        }
        try {
            setSubmitError("");
            if (onChainRegisterTargets.length > 0) {
                await props.cont.add_student(onChainRegisterTargets);
            }
            const actorAddress = props.cont.normalizeAddress(await props.cont.get_address().catch(() => ""));
            await persistCourseStudentsToServer(CURRENT_TOKEN_GRANT_COURSE_KEY, newStudentTargets, {
                courseLabel: CURRENT_TOKEN_GRANT_COURSE_LABEL,
                addedAt: new Date().toISOString(),
                source: "admin_add_student",
                actorAddress,
            });
            appendActivityLog(ACTION_TYPES.ADMIN_ADD_STUDENT, {
                page: "admin",
                courseKey: CURRENT_TOKEN_GRANT_COURSE_KEY,
                courseLabel: CURRENT_TOKEN_GRANT_COURSE_LABEL,
                count: newStudentTargets.length,
                onChainCount: onChainRegisterTargets.length,
                existingStudentCount: existingStudentCourseTargets.length,
                skippedCount: alreadyInCourseAddresses.length + teacherAddresses.length,
            });
            setAddStudent("");
            await loadStudents();
        } catch (error) {
            console.error("Failed to add students", error);
            setSubmitError(error?.message || "学生の追加に失敗しました。");
        }
    };

    useEffect(() => {
        loadStudents();
    }, [props.cont]);

    return (
        <div>
            <h3 className="section-title">学生を追加</h3>
            <p className="section-desc">
                {CURRENT_TOKEN_GRANT_COURSE_LABEL} に参加する学生のウォレットアドレスを改行区切りで入力してください。
                応用数学で登録済みの学生も、この講義の名簿へ追加できます。
            </p>

            <Form.Group style={{ textAlign: "left", marginBottom: "var(--space-4)" }}>
                <Form.Label>ウォレットアドレス一覧</Form.Label>
                <Form.Control
                    as="textarea"
                    rows={Math.max(addStudent.split("\n").length + 3, 6)}
                    value={addStudent}
                    onChange={(event) => setAddStudent(event.target.value)}
                    placeholder={"0x1234...\n0x5678..."}
                />
            </Form.Group>

            {addStudent_list.length > 0 && (
                <div className="address-list">
                    <div className="address-list-title">入力アドレス ({normalizedCandidates.length}件)</div>
                    {normalizedCandidates.map((item, index) => (
                        <div key={`${item}-${index}`} className="address-item">{item}</div>
                    ))}
                </div>
            )}

            {duplicateRegisteredAddresses.length > 0 && (
                <div className="address-list" style={{ marginTop: "var(--space-4)" }}>
                    <div className="address-list-title">オンチェーン登録済みのアドレス ({duplicateRegisteredAddresses.length}件)</div>
                    {duplicateRegisteredDetails.map((item, index) => (
                        <div key={`${item.address}-duplicate-${index}`} className="address-item">
                            <div className="address-item-id">{item.internalId}</div>
                            <div>
                                <div>{item.address}</div>
                                <div style={{ color: "var(--text-secondary)", fontSize: "var(--font-size-xs)" }}>
                                    既登録: {item.roleLabel}
                                    {item.roleLabel === "学生" && !courseStudentAddressSet.has(props.cont.normalizeAddress(item.address))
                                        ? ` / ${CURRENT_TOKEN_GRANT_COURSE_LABEL} 名簿には追加できます`
                                        : ""}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {alreadyInCourseAddresses.length > 0 && (
                <div className="address-list" style={{ marginTop: "var(--space-4)" }}>
                    <div className="address-list-title">{CURRENT_TOKEN_GRANT_COURSE_LABEL} に登録済みのため追加しないアドレス ({alreadyInCourseAddresses.length}件)</div>
                    {alreadyInCourseAddresses.map((item, index) => (
                        <div key={`${item}-course-duplicate-${index}`} className="address-item">{item}</div>
                    ))}
                </div>
            )}

            {submitError && (
                <div className="address-item" style={{ borderLeftColor: "#ff7b72", color: "#ffd7d7", marginTop: "var(--space-4)" }}>
                    {submitError}
                </div>
            )}

            <button className="btn-action" onClick={add_student}>
                学生をコントラクトに追加
            </button>

            <div className="address-list" style={{ marginTop: "var(--space-8)" }}>
                <div className="address-list-title">{CURRENT_TOKEN_GRANT_COURSE_LABEL} 登録済み学生 ({courseStudents.length}件)</div>
                {courseStudents.length === 0 ? (
                    <div className="address-item">{CURRENT_TOKEN_GRANT_COURSE_LABEL} の登録済み学生はまだありません。</div>
                ) : (
                    courseStudents.map((item, index) => (
                        <div key={`${item}-${index}`} className="address-item">
                            <div className="address-item-id">{formatInternalId("USER", index)}</div>
                            <div>{item}</div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default Add_students;
