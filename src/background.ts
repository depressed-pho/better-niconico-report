/* Handle the click event on the navigation bar icon. Open the report
 * page in a new tab if it's not already open, otherwise activate an
 * existing one.
 */
async function navbarIconClicked() {
    const URL    = browser.runtime.getURL("/assets/pages/report/report.html");
    const result = await browser.tabs.query({
        currentWindow: true,
        url: URL
    });
    if (result.length > 0) {
        await browser.tabs.update(result[0].id, {active: true});
    }
    else {
        await browser.tabs.create({
            url: URL
        });
    }
}
browser.runtime.onInstalled.addListener(() => {
    browser.browserAction.onClicked.addListener(navbarIconClicked);
});
