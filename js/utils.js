
window.UTILS = {
    async gotoSearchPage(searchValue, inquiryId) {
        chrome.runtime.sendMessage({ action: "gotoSearchPage", searchValue, inquiryId });
    }
}