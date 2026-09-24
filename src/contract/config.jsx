//const chainId = "0x13881"; // (required) chainId to be used
//const rpc = "https://rpc-mumbai.maticvigil.com/"; // (required for Ethereum) JSON RPC endpoint

const chainId = "0x13882"; // (required) chainId to be used
const rpc_urls = [
    "https://polygon-amoy-bor-rpc.publicnode.com",
    "https://polygon-amoy.drpc.org",
    "https://rpc-amoy.polygon.technology",
    "https://polygon-amoy.blockpi.network/v1/rpc/public",
    "https://api.zan.top/polygon-amoy",
];
const rpc = rpc_urls[0]; // default RPC endpoint

//const quiz_address = "0xB80f73B6be80f39b30bd8624368cDd57E0db3ff5";
//const token_address = "0x1ceA098E584e46c7659f8460d3c13Cec2D0B22F4";

//const quiz_address = "0x681913855E68BBF88962A40E4f3f48cB78fc9603";
//const quiz_address = "0xAb3Ec4a039fb6aBb66Cf00460d27839a9C196B94";//応用数学一回目
//const quiz_address = "0x5d12efccbd81c60c80e5e2caffa480f2cf80a813"//test10

const class_room_address = "0x5238ED9e33698C9C3C984902C018ec9c54aD8085";
const quiz_address = "0xC1a6b3Ac824ed0D335573458a03ceABAAFD849Bf";
const legacy_quiz_addresses = [
    "0xeb196c161EFA30939f78170694bb908E17fd1479",
    "0x55B3977C7B7b913eaf175A7364c8375732d22241",
    "0xEbBD4E3276bcb847838E18DDA7585Ac8925a5eA6",
    "0x2DfaC485A476FdFbF33411C88A126D74fbfbD0Ee",
    "0x49576E6B1a9D81075767D61dAE3AdcB0b30B00d4",
];
// Keep this list append-only so existing shared URLs never change target contracts.
// When a new quiz.sol is deployed:
// 1. update quiz_address to the new contract
// 2. move the previous quiz_address into legacy_quiz_addresses
// 3. append the new contract address to routed_quiz_addresses
const routed_quiz_addresses = [
    "0xC1a6b3Ac824ed0D335573458a03ceABAAFD849Bf",
    "0xeb196c161EFA30939f78170694bb908E17fd1479",
    "0x55B3977C7B7b913eaf175A7364c8375732d22241",
    "0xEbBD4E3276bcb847838E18DDA7585Ac8925a5eA6",
    "0x2DfaC485A476FdFbF33411C88A126D74fbfbD0Ee",
    "0x49576E6B1a9D81075767D61dAE3AdcB0b30B00d4",
];
// Backward-compatible alias for previously shared c-<id> URLs.
const legacy_current_route_address = "0x55B3977C7B7b913eaf175A7364c8375732d22241";
const token_address = "0x021e416bb6bfA1e76Aa4E280828b1d55F2d5f2F0";
const ttt_token_address = "0x22b6457aC35b2A839EE6eb47c91f0941E1b21476";
const bootstrap_teacher_addresses = [];

export {
    chainId,
    rpc,
    rpc_urls,
    class_room_address,
    quiz_address,
    legacy_quiz_addresses,
    routed_quiz_addresses,
    legacy_current_route_address,
    token_address,
    ttt_token_address,
    bootstrap_teacher_addresses,
};
