
window.UTILS = {
    async gotoSearchPage(inquiry_record_id, inquiryMaterialId, searchValue, companyId) {
        chrome.runtime.sendMessage({ action: "gotoSearchPage", inquiry_record_id, inquiryMaterialId, searchValue, companyId });
    }
}