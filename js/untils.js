
window.UNTILS = {
    async gotoSearchPage(searchValue, gatherId) {
        chrome.runtime.sendMessage({ action: "gotoSearchPage", searchValue, gatherId });
    }
}