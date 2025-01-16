
window.UTILS = {
    async gotoJywSearchPage(inquiry_record_id, inquiryMaterialId, searchValue, companyId) {
        chrome.runtime.sendMessage({ action: "gotoJywSearchPage", inquiry_record_id, inquiryMaterialId, searchValue, companyId });
    }
}