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
    options_ui: {
        "page": "assets/pages/config/config.html"
    },
    permissions: [
        // To perform an authentication and also follow a redirection
        // on a failed authentication.
        "https://account.nicovideo.jp/*",
        // To follow a redirection on a successful authentication.
        "https://www.nicovideo.jp/*",
        // To access the report API.
        "https://public.api.nicovideo.jp/*"
    ],
    browser_specific_settings: {
        gecko: {
            id: "better-niconico-report@cielonegro.org"
        }
    }
};
