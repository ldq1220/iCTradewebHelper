// 总结供应商信息 ==> 过滤&去重&截取
function summarizeSuppliers(supplierStore, inquiry_supplier_number) {
    // 过滤无效数据并去重
    const seenCompanies = new Set();
    let storage = supplierStore
        .filter(item => item.companyName.length > 0 && item.qqAccount.length > 0)
        .filter(item => {
            // 获取第一个公司名作为唯一标识
            const companyName = item.companyName[0];
            // 如果这个公司名已经出现过，返回false过滤掉
            if (seenCompanies.has(companyName)) {
                return false;
            }
            // 否则添加到Set中并保留这条数据
            seenCompanies.add(companyName);
            return true;
        });

    // 返回指定数量的供应商
    const result = storage.slice(0, inquiry_supplier_number).map(item => ({ ...item, companyName: item.companyName[0] }));
    return result;
}

// 处理供应信息
window.getSuppliersProcessByHqw = function () {
    const inquiry_supplier_number = 20;
    const batchSize = 50;

    return new Promise((resolve) => {
        try {
            const supplierStore = [];
            const ecDataTrElements = document.getElementsByClassName("ec-data");

            if (ecDataTrElements.length === 0) {
                resolve({
                    success: false,
                    data: [],
                    error: '当前物料编码，在【华强网】未找到供应商信息。'
                });
                return;
            }

            const elements = Array.from(ecDataTrElements);
            const totalElements = elements.length;
            let processedCount = 0;

            async function processBatch() {
                const end = Math.min(processedCount + batchSize, totalElements);

                for (let i = processedCount; i < end; i++) {
                    const ecDataTr = elements[i];
                    const elementData = {
                        company: null,
                        visibleLinks: [],
                        companyName: [],
                        companyTag: [],
                        companyInfo: {},
                        materialId: [],
                        brand: null,
                        batchId: null,
                        totalNumber: null,
                        packaging: null,
                        storehouse: null,
                        desc: null,
                        qqAccount: [],
                        source: 'hqw'
                    };

                    // 获取供应信息
                    const supplyElement = ecDataTr.querySelector(".j-company-td");
                    if (supplyElement) {
                        // 供应商公司名称
                        elementData.company = supplyElement;
                        const supplierElement = supplyElement.querySelector(".company");
                        const content = supplierElement.textContent.trim();
                        if (content) elementData.companyName.push(content);
                        // 供应商标签
                        const companyTagElement = ecDataTr.querySelector(".company-row2");
                        const AElementAll = companyTagElement.querySelectorAll("a:not(.stick-tag)");
                        AElementAll.forEach(element => {
                            const childElements = element.children;
                            Array.from(childElements).forEach(child => {
                                const className = child.className;
                                if (className) elementData.companyTag.push(className);
                            });
                        });
                    }

                    // 获取物料编号
                    const materialElement = ecDataTr.querySelector(".td-model-data").children[0];
                    if (materialElement) {
                        const materialIdText = materialElement.textContent.trim();
                        if (materialIdText) elementData.materialId.push(materialIdText);
                    }

                    // 品牌
                    const brandElement = ecDataTr.querySelector(".td-brand").querySelector(".list-pro");
                    if (brandElement) {
                        const brandText = brandElement.textContent.trim();
                        if (brandText) elementData.brand = brandText;
                    }

                    // 批次
                    const batchElement = ecDataTr.querySelector(".td-pproductDate").querySelector(".over");
                    if (batchElement) {
                        const batchText = batchElement.textContent.trim();
                        if (batchText) elementData.batchId = batchText;
                    }

                    // 数量
                    const totalNumberElement = ecDataTr.querySelector(".td-stockNum").querySelector(".over");
                    if (totalNumberElement) {
                        const totalNumberText = totalNumberElement.textContent.trim();
                        if (totalNumberText) elementData.totalNumber = totalNumberText;
                    }

                    // 封装
                    const packagingElement = ecDataTr.querySelector(".td-ppackage").querySelector(".over");
                    if (packagingElement) {
                        const packagingText = packagingElement.textContent.trim();
                        if (packagingText) elementData.packaging = packagingText;
                    }

                    // 仓库
                    const storageLocationElement = ecDataTr.querySelector(".td-storeLocation").querySelector(".over");
                    if (storageLocationElement) {
                        const storageLocationText = storageLocationElement.textContent.trim();
                        if (storageLocationText) elementData.storehouse = storageLocationText;
                    }

                    // 说明
                    const descElement = ecDataTr.querySelector(".td-premark").querySelector(".list-pro");
                    if (descElement) {
                        const descText = descElement.textContent.trim();
                        if (descText) elementData.desc = descText;
                    }

                    // QQ账号
                    const qqAccountElement = ecDataTr.querySelector(".ver-mid").querySelector(".customerqq");
                    if (qqAccountElement) {
                        const qqAccountText = qqAccountElement.getAttribute('qq');
                        if (qqAccountText) elementData.qqAccount.push(qqAccountText);
                    }

                    supplierStore.push(elementData);
                }

                processedCount = end;

                if (processedCount < totalElements) {
                    requestAnimationFrame(processBatch);
                } else {
                    let supplierStoreuppliers = summarizeSuppliers(supplierStore, inquiry_supplier_number)

                    resolve({
                        success: true,
                        data: supplierStoreuppliers,
                        error: null,
                        getAllCompanyNames: function () {
                            return this.data.reduce(
                                (acc, curr) => acc.concat(curr.companyName),
                                []
                            );
                        },
                        getAllCompanyTag: function () {
                            return this.data.reduce(
                                (acc, curr) => acc.concat(curr.companyTag),
                                []
                            );
                        },
                        getAllQQAccounts: function () {
                            return this.data.reduce(
                                (acc, curr) => acc.concat(curr.qqAccount),
                                []
                            );
                        },
                        getAllMaterialIds: function () {
                            return this.data.reduce(
                                (acc, curr) => acc.concat(curr.materialId),
                                []
                            );
                        }
                    });
                }
            }

            requestAnimationFrame(processBatch);
        } catch (error) {
            resolve({
                success: false,
                data: [],
                error: error.message
            });
        }
    });
};