module.exports = {
    manifest_version: 2,
    name: "Better Niconico Report",
    icons: {
        "48": "assets/icon.svg",
        "96": "assets/icon.svg"
    },
    background: {
        scripts: ["background.js"]
    },
    browser_action: {
        "default_icon": "assets/icon.svg",
        "default_title": "Better Niconico Report"
    },
    permissions: [
        "https://account.nicovideo.jp/*",
        "https://public.api.nicovideo.jp/*",
        "https://www.nicovideo.jp/*"
    ],
    browser_specific_settings: {
        gecko: {
            id: "better-niconico-report@cielonegro.org"
        }
    }
};
