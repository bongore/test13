export const amoy = {
    id: 80002,
    name: "Polygon Amoy Testnet",
    network: "polygon-amoy",
    iconUrl: "",
    iconBackground: "#000000",
    nativeCurrency: {
        decimals: 18,
        name: "POL",
        symbol: "POL",
    },
    rpcUrls: {
        default: {
            http: [
                "https://polygon-amoy-bor-rpc.publicnode.com",
                "https://polygon-amoy.drpc.org",
                "https://rpc-amoy.polygon.technology",
                "https://polygon-amoy.blockpi.network/v1/rpc/public",
                "https://api.zan.top/polygon-amoy",
            ],
        },
    },
    blockExplorers: {
        default: {
            name: "PolygonScan",
            url: "https://amoy.polygonscan.com/",
        },
    },
};
