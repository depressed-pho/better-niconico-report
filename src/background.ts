/* Handle the click event on the navigation bar icon.
 */
function navbarIconClicked() {
    console.log("clicked!");
}
browser.browserAction.onClicked.addListener(navbarIconClicked);
