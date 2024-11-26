
window.UTILS = {
    async gotoSearchPage(inquiry_record_id, inquiryMaterialId, searchValue) {
        chrome.runtime.sendMessage({ action: "gotoSearchPage", inquiry_record_id, inquiryMaterialId, searchValue });
    }
}