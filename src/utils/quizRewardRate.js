const QUIZ_RATE_OPTIONS = [
    { id: "light", point: 0.2, reward: 15, label: "0.2点 / 15TFT" },
    { id: "middle", point: 0.4, reward: 30, label: "0.4点 / 30TFT" },
    { id: "heavy", point: 0.8, reward: 60, label: "0.8点 / 60TFT" },
];

const TFT_PER_POINT = 75;
const MAX_TFT_PER_LECTURE = 150;
const MAX_TFT_TOTAL = 750;
const TOTAL_LECTURE_COUNT = 5;

function normalizeTftAmount(value) {
    const numericValue = Number(value || 0);
    if (!Number.isFinite(numericValue)) return 0;
    if (Math.abs(numericValue) >= 1e9) {
        return numericValue / 10 ** 18;
    }
    return numericValue;
}

function convertTftToPoint(tftAmount) {
    return normalizeTftAmount(tftAmount) / TFT_PER_POINT;
}

export {
    QUIZ_RATE_OPTIONS,
    TFT_PER_POINT,
    MAX_TFT_PER_LECTURE,
    MAX_TFT_TOTAL,
    TOTAL_LECTURE_COUNT,
    normalizeTftAmount,
    convertTftToPoint,
};
