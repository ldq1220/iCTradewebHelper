// 直接引入 poll.js
importScripts('js/poll.js');
importScripts('js/icCrmApiBackground.js');

const gatherPlan = {
    jyw: false,
    jywSuppliers: [],
    hqw: false,
    hqwSuppliers: [],
}
const sourceData = [
    {
        url: 'www.ic.net.cn',
        name: 'jyw'
    },
    {
        url: 'member.ic.net.cn',
        name: 'jyw'
    },
    {
        url: 'www.hqew.com',
        name: 'hqw'
    },
    {
        url: 's.hqew.com',
        name: 'hqw'
    }
]
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


// 监听来自popup的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggleStatus') {
        message.isEnabled ? Poll.startPolling() : Poll.stopPolling();
        sendResponse({ success: true }); // 发送响应
    }

    // 插件 登录过期的消息
    if (message.action === 'loginExpired') {
        stopTask(); // 停止当前运行的任务
        isEnabled = false; // 设置启用状态为 false
        chrome.storage.local.set({ isEnabled: false }); // 更新存储中的状态
        sendResponse({ success: true });
    }

    return true; // 保持消息通道开启
});

// 插件安装时初始化
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['isEnabled'], function (result) {
        const isEnabled = result.isEnabled !== false;
        if (isEnabled) {
            Poll.startPolling();
        }
    });
});

// 浏览器启动时初始化
chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.get(['isEnabled'], function (result) {
        const isEnabled = result.isEnabled !== false;
        if (isEnabled) {
            Poll.startPolling();
        }
    });
});

// 监听 跳转至IC交易网搜索页面
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === "gotoSearchPage") {
        const { inquiry_record_id, inquiryMaterialId, searchValue, companyId } = request;
        const params = `inquiryRecordId=${inquiry_record_id}&inquiryMaterialId=${inquiryMaterialId}&inquiryMaterialCode=${searchValue}&companyId=${companyId}`
        const url = `https://www.ic.net.cn/search/${searchValue.trim()}.html?page=1&${params}`;
        const jywTabs = await chrome.tabs.query({
            url: "*://*.ic.net.cn/*"  // 匹配目标网站的所有标签页
        });
        if (jywTabs.length) {
            await chrome.tabs.update(jywTabs[0].id, { url: url });;
        }
    }

    sendResponse({ success: true });
});

// 供应商采集结束
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === "suppliersGatherOver") {
        const {
            purchase_bot_id,
            purchase_bot_im_platform,
            suppliersResult,
            companyId,
            inquiryRecordId,
            inquiryMaterialId,
            inquiryMaterialCode,
            source,
            url,
        } = request.suppliersGatherOverData;
        const { success, data, error } = suppliersResult;
        const { inquiry_status } = await ICCRMAPI.getInquiryRecord(inquiryRecordId) // 获取 询料记录
        const sourceName = sourceData.find(item => item.url === source)?.name;

        if (sourceName === 'jyw') {
            gatherPlan.jyw = true;
            gatherPlan.jywSuppliers = data;
            console.log('交易网采集完成:', {
                success,
                suppliersCount: data?.length,
                error
            });
        } else if (sourceName === 'hqw') {
            gatherPlan.hqw = true;
            gatherPlan.hqwSuppliers = data;
            console.log('华强网采集完成:', {
                success,
                suppliersCount: data?.length,
                error
            });
        }

        console.log('gatherPlan', gatherPlan);

        if (!gatherPlan.hqw) {
            console.log('跳转至【华强网】对应物料编码的搜索页面');
            await chrome.storage.local.remove('executeGetSuppliersProcess');
            await sleep(2000)

            const url = `https://s.hqew.com/${inquiryMaterialCode.trim()}.html?inquiryRecordId=${inquiryRecordId}&inquiryMaterialId=${inquiryMaterialId}&inquiryMaterialCode=${inquiryMaterialCode}&companyId=${companyId}`;
            const newTab = await chrome.tabs.create({ url: url });
            // 等待新页面加载完成
            await new Promise(resolve => {
                chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                    if (tabId === newTab.id && info.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(listener);
                        resolve();
                    }
                });
            });
            await sleep(2000)
            await chrome.storage.local.set({ executeGetSuppliersProcess: true }); // 存储状态 等待跳转完成页面加载获取供应商数据
            await sleep(3000)

            const hqwTabs = await chrome.tabs.query({
                url: "*://*.hqew.com/*"  // 匹配目标网站的所有标签页
            });
            if (hqwTabs.length) {
                await chrome.tabs.remove(hqwTabs[0].id);
            }
        }

        if (gatherPlan.hqw && gatherPlan.jyw) {
            console.log('交易网和华强网的数据全部采集完成！！！！！！！！');
            Object.assign(gatherPlan, {
                jyw: false,
                jywSuppliers: [],
                hqw: false,
                hqwSuppliers: [],
            })
            console.log('清空数据-----------', gatherPlan);
        }


        // if (!success || !data.length) {
        //     ICCRMAPI.updateInquiryMaterial(inquiryMaterialId, { inquiry_material_status: "1", gather_error: error },); // 更新询料物料状态为 采集失败
        //     if (inquiry_status == "0") await ICCRMAPI.updateInquiryRecord(inquiryRecordId, { inquiry_status: "-1", gather_error: error }) // 更新询料任务状态为 采集失败
        // } else {
        //     await handleSupplierData(data, purchase_bot_id, purchase_bot_im_platform, companyId) // 处理供应商数据
        //     await ICCRMAPI.updateInquiryMaterial(inquiryMaterialId, { inquiry_material_status: "2" },); // 更新询料物料状态为 待询价
        //     await ICCRMAPI.updateInquiryRecord(inquiryRecordId, { inquiry_status: "1" }) // 更新询料任务状态为 待询价
        // }

        // // 处理 供应商数据
        // async function handleSupplierData(data, purchase_bot_id, purchase_bot_im_platform, companyId) {
        //     await Promise.all(data.map(async (item) => {
        //         const { companyName, companyTag, qqAccount, companyInfo } = item;
        //         const { memberYears, contacts, location, addresses, brands } = companyInfo;
        //         const { phones, mobiles, faxes } = contacts;
        //         const userCompanyId = companyId + "";
        //         const supplierResult = await ICCRMAPI.getSupplierInfo(companyName); // 获取IC CRM中 供应商信息

        //         const supplierInfo = {
        //             company_name: companyName,
        //             company_tag: companyTag,
        //             qq_account: qqAccount,
        //             member_years: memberYears,
        //             phones: phones,
        //             mobiles: mobiles.join(' '),
        //             faxes: faxes.join(' '),
        //             location,
        //             addresses: addresses.join(' '),
        //         }

        //         if (supplierResult) {
        //             // 更新供应商信息
        //             const { company_ids, inquiry_material, brands: supplierBrands, companys, id: supplierId } = supplierResult;
        //             if (!company_ids.includes(userCompanyId)) {
        //                 company_ids.push(userCompanyId)
        //                 companys.push({ id: Number(userCompanyId) })
        //             } // 关联公司

        //             const inquiryMaterialIds = inquiry_material.map(item => item.id)
        //             if (!inquiryMaterialIds.includes(inquiryMaterialId)) inquiryMaterialIds.push(inquiryMaterialId) // 关联询料物料ids

        //             await ICCRMAPI.updateSupplierInfo(supplierId, {
        //                 company_ids,
        //                 companys,
        //                 id: supplierId,
        //                 inquiry_material: inquiryMaterialIds.map(item => { return { id: item } }),
        //                 brands: brands.length > 0 ? brands.map(item => {
        //                     const existingBrand = supplierBrands?.find(b => b.brand_name === item.name); // 查找相同名称的已有品牌
        //                     return {
        //                         id: existingBrand?.id, // 保留已有品牌的id
        //                         proportion: item.percentage,
        //                         brand_name: item.name,
        //                     }
        //                 }) : [],
        //                 ...supplierInfo
        //             })
        //         } else {
        //             // 创建供应商信息
        //             await ICCRMAPI.createSupplierInfo({
        //                 company_ids: [userCompanyId],
        //                 companys: [{ id: Number(userCompanyId) }],
        //                 inquiry_material: [{ id: inquiryMaterialId }],
        //                 brands: brands.length > 0 ? brands.map(item => ({
        //                     proportion: item.percentage,
        //                     brand_name: item.name,
        //                 })) : [],
        //                 ...supplierInfo
        //             })
        //         }

        //         // 处理供应商联系人
        //         const supplierContactInfo = {
        //             company_id: companyId, // 所属公司
        //             supplier_name: companyName, // 所属供应商
        //             imUserId: qqAccount.length > 0 ? qqAccount[0] : '', // 联系人qq
        //             imBotUserId: purchase_bot_id, // 机器人ID
        //             imPlatform: purchase_bot_im_platform, // 平台
        //             imIsGroup: '好友'
        //         }
        //         await handleSuppliercontact(supplierContactInfo)
        //     }));
        // }

        // // // 处理供应商联系人
        // async function handleSuppliercontact(supplierContactInfo) {
        //     const { company_id, supplier_name } = supplierContactInfo;
        //     const supplierContactResult = await ICCRMAPI.getSupplierContact(company_id, supplier_name)
        //     if (!supplierContactResult) await ICCRMAPI.createSupplierContact(supplierContactInfo)
        // }
    }


    sendResponse({ success: true });
});