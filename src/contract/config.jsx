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

const class_room_address = "0x5238ED9e33698C9C3C984902C018ec9c54aD8085";
const quiz_address = "0xC1a6b3Ac824ed0D335573458a03ceABAAFD849Bf";
const legacy_quiz_addresses = [];
// Keep this list append-only so existing shared URLs never change target contracts.
// When a new quiz.sol is deployed:
// 1. update quiz_address to the new contract
// 2. move the previous quiz_address into legacy_quiz_addresses
// 3. append the new contract address to routed_quiz_addresses
const routed_quiz_addresses = [
    "0xC1a6b3Ac824ed0D335573458a03ceABAAFD849Bf",
];
// Backward-compatible alias for previously shared c-<id> URLs.
const legacy_current_route_address = "";
const active_quiz_min_id = 0;
const active_quiz_start_epoch = Math.floor(new Date("2026-09-24T18:55:00+09:00").getTime() / 1000);
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
    active_quiz_min_id,
    active_quiz_start_epoch,
    token_address,
    ttt_token_address,
    bootstrap_teacher_addresses,
};
