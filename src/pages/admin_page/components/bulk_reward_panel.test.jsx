import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Bulk_reward_panel from "./bulk_reward_panel";
import { useAccessControl } from "../../../utils/accessControl";
import { getRewardPayoutEntries, syncRewardPayoutLedgerFromServer } from "../../../utils/rewardPayoutLedger";

jest.mock("../../../utils/accessControl", () => ({
    useAccessControl: jest.fn(),
}));

jest.mock("../../../utils/rewardPayoutLedger", () => ({
    getRewardPayoutEntries: jest.fn(() => []),
    persistRewardPayoutEntriesToServer: jest.fn(async () => []),
    syncRewardPayoutLedgerFromServer: jest.fn(async () => []),
}));

describe("Bulk_reward_panel", () => {
    const confirmSpy = jest.spyOn(window, "confirm").mockImplementation(() => true);
    const mockContract = {
        get_student_list: jest.fn(),
        get_user_data: jest.fn(),
        get_all_quiz_simple_list: jest.fn(),
        get_revealed_correct_answer: jest.fn(),
        get_student_answer_detail: jest.fn(),
        get_transaction_receipt_status: jest.fn(),
        settle_quiz_rewards_auto_existing: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        confirmSpy.mockImplementation(() => true);
        useAccessControl.mockReturnValue({
            isLoading: false,
            isTeacher: true,
            address: "0x1111111111111111111111111111111111111111",
        });
        getRewardPayoutEntries.mockReturnValue([]);
        syncRewardPayoutLedgerFromServer.mockResolvedValue([]);

        mockContract.get_student_list.mockResolvedValue([
            "0x1111111111111111111111111111111111111111",
        ]);
        mockContract.get_user_data.mockResolvedValue(["学生A"]);
        mockContract.get_all_quiz_simple_list.mockResolvedValue([
            [
                5,
                "0xteacher",
                "応用数学第四回演習問題(5)",
                "",
                "",
                0,
                0,
                50000000000000000000n,
                1,
                10,
                0,
                false,
                "0x55B3977C7B7b913eaf175A7364c8375732d22241",
            ],
        ]);
        mockContract.get_revealed_correct_answer.mockResolvedValue("1/6");
        mockContract.get_student_answer_detail.mockResolvedValue({
            submitted: true,
            state: 3,
            answerText: "1/6",
            reward: 0,
        });
        mockContract.get_transaction_receipt_status.mockResolvedValue("success");
        mockContract.settle_quiz_rewards_auto_existing.mockResolvedValue({
            payoutChunks: [
                {
                    correctStudents: ["0x1111111111111111111111111111111111111111"],
                    incorrectStudents: [],
                },
            ],
            payoutReceipts: [
                {
                    transactionHash: "0xfeed1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
                    status: "success",
                },
            ],
        });
    });

    afterAll(() => {
        confirmSpy.mockRestore();
    });

    test("loads eligible quizzes and exposes bulk payout controls", async () => {
        render(<Bulk_reward_panel cont={mockContract} />);

        expect(await screen.findByText("💸 全問題一括報酬配布")).toBeInTheDocument();
        expect(await screen.findByText(/応用数学第四回演習問題\(5\)/)).toBeInTheDocument();
        expect(screen.getByText("旧コントラクト")).toBeInTheDocument();
        expect(screen.getByText("未完了 1 問 / 配布完了 0 問 / 全 1 問")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "全対象問題を一括配布" })).toBeEnabled();

        fireEvent.click(screen.getByRole("button", { name: "対象を全選択" }));

        await waitFor(() => {
            expect(screen.getByRole("button", { name: "選択した問題を一括配布" })).toBeEnabled();
        });
    });

    test("shows payout transaction links for already completed quizzes from the payout ledger", async () => {
        const payoutEntries = [
            {
                quizId: 5,
                sourceAddress: "0x55B3977C7B7b913eaf175A7364c8375732d22241",
                studentAddress: "0x1111111111111111111111111111111111111111",
                txHash: "0xfeed1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
                confirmed: true,
            },
        ];
        getRewardPayoutEntries.mockReturnValue(payoutEntries);
        syncRewardPayoutLedgerFromServer.mockResolvedValue(payoutEntries);
        mockContract.get_student_answer_detail.mockResolvedValue({
            submitted: true,
            state: 2,
            answerText: "1/6",
            reward: 50000000000000000000n,
        });

        render(<Bulk_reward_panel cont={mockContract} />);

        expect(await screen.findByText("報酬配布が完了した問題")).toBeInTheDocument();
        const payoutLink = await screen.findByRole("link", { name: /0xfeed1234/i });
        expect(payoutLink).toHaveAttribute("href", "https://amoy.polygonscan.com/tx/0xfeed1234567890abcdef1234567890abcdef1234567890abcdef1234567890");
    });

    test("keeps wrong pending answers eligible so they can be finalized as incorrect", async () => {
        mockContract.get_student_answer_detail.mockResolvedValue({
            submitted: true,
            state: 3,
            answerText: "13/36",
            reward: 0,
        });

        render(<Bulk_reward_panel cont={mockContract} />);

        expect(await screen.findByText("未完了 1 問 / 配布完了 0 問 / 全 1 問")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "全対象問題を一括配布" })).toBeEnabled();
    });

    test("sends all pending submitted students so correct and incorrect answers are finalized together", async () => {
        mockContract.get_student_list.mockResolvedValue([
            "0x1111111111111111111111111111111111111111",
            "0x2222222222222222222222222222222222222222",
        ]);
        mockContract.get_student_answer_detail
            .mockResolvedValueOnce({
                submitted: true,
                state: 3,
                answerText: "1/6",
                reward: 0,
            })
            .mockResolvedValueOnce({
                submitted: true,
                state: 3,
                answerText: "13/36",
                reward: 0,
            })
            .mockResolvedValueOnce({
                submitted: true,
                state: 3,
                answerText: "1/6",
                reward: 0,
            })
            .mockResolvedValueOnce({
                submitted: true,
                state: 3,
                answerText: "13/36",
                reward: 0,
            })
            .mockResolvedValue({
                submitted: true,
                state: 2,
                answerText: "1/6",
                reward: 50000000000000000000n,
            });

        render(<Bulk_reward_panel cont={mockContract} />);

        expect(await screen.findByText("未完了 1 問 / 配布完了 0 問 / 全 1 問")).toBeInTheDocument();
        const executeButton = screen.getByRole("button", { name: "全対象問題を一括配布" });
        await waitFor(() => {
            expect(executeButton).toBeEnabled();
        });
        fireEvent.click(executeButton);

        await waitFor(() => {
            expect(mockContract.settle_quiz_rewards_auto_existing).toHaveBeenCalledWith(
                5,
                "1/6",
                [
                    "0x1111111111111111111111111111111111111111",
                    "0x2222222222222222222222222222222222222222",
                ],
                "0x55B3977C7B7b913eaf175A7364c8375732d22241"
            );
        });
    });

    test("treats state 3 correct answers with confirmed payout tx as completed", async () => {
        const payoutEntries = [
            {
                quizId: 5,
                sourceAddress: "0x55B3977C7B7b913eaf175A7364c8375732d22241",
                studentAddress: "0x1111111111111111111111111111111111111111",
                txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                resultState: "correct",
                confirmed: true,
            },
        ];
        getRewardPayoutEntries.mockReturnValue(payoutEntries);
        syncRewardPayoutLedgerFromServer.mockResolvedValue(payoutEntries);
        mockContract.get_student_answer_detail.mockResolvedValue({
            submitted: true,
            state: 3,
            answerText: "1/6",
            reward: 0,
        });

        render(<Bulk_reward_panel cont={mockContract} />);

        expect(await screen.findByText("未完了 0 問 / 配布完了 1 問 / 全 1 問")).toBeInTheDocument();
        const payoutLink = await screen.findByRole("link", { name: /0x12345678/i });
        expect(payoutLink).toHaveAttribute("href", "https://amoy.polygonscan.com/tx/0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");
    });

    test("keeps failed payout transactions out of completed rows", async () => {
        const payoutEntries = [
            {
                quizId: 5,
                sourceAddress: "0x55B3977C7B7b913eaf175A7364c8375732d22241",
                studentAddress: "0x1111111111111111111111111111111111111111",
                txHash: "0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678",
                resultState: "correct",
                confirmed: true,
            },
        ];
        getRewardPayoutEntries.mockReturnValue(payoutEntries);
        syncRewardPayoutLedgerFromServer.mockResolvedValue(payoutEntries);
        mockContract.get_transaction_receipt_status.mockResolvedValue("reverted");
        mockContract.get_student_answer_detail.mockResolvedValue({
            submitted: true,
            state: 3,
            answerText: "1/6",
            reward: 0,
        });

        render(<Bulk_reward_panel cont={mockContract} />);

        expect(await screen.findByText("未完了 1 問 / 配布完了 0 問 / 全 1 問")).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /0xdeadbeef/i })).not.toBeInTheDocument();
    });
});
