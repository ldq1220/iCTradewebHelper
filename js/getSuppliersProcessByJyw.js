// 获取公司信息的处理函数
function getCompanyInfo(detailLayer) {
    const info = {
        businessTags: [], // 企业档案标签
        memberYears: '', // 会员年限
        contacts: {
            phones: [], // 电话
            mobiles: [], // 手机
            faxes: [] // 传真
        },
        location: '', // 办公地点
        addresses: [], // 地址
        brands: [] // 经营品牌
    };
    if (!detailLayer) return info;

    // 获取企业档案标签
    const businessTags = detailLayer.querySelectorAll('.layer_icon');
    businessTags.forEach(tag => {
        const style = window.getComputedStyle(tag);
        if (style.display !== 'none') {
            // 获取类名
            const className = tag?.className;
            const title = tag.getAttribute('title');
            if (className && title) info.businessTags.push(className.split(' ')[1]);
        }
    });

    // 获取会员年限
    const memberYears = detailLayer.querySelector('.orangenumber');
    if (memberYears) info.memberYears = memberYears.textContent.trim();

    // 获取联系方式
    // 电话和联系人
    const contactElements = detailLayer.querySelectorAll('.layer_contacts');
    contactElements.forEach(contact => {
        const style = window.getComputedStyle(contact);
        if (style.display !== 'none') {
            const phone = contact.querySelector('.layer_telNumber');
            const contactName = contact.querySelector('.layer_contactName');
            if (phone || contactName) info.contacts.phones.push(phone.textContent.trim() + ' ' + contactName.textContent.trim());

        }
    });

    // 手机
    const mobiles = detailLayer.querySelectorAll('.layer_otherContentphone');
    mobiles.forEach(mobile => {
        const style = window.getComputedStyle(mobile);
        if (style.display !== 'none') info.contacts.mobiles.push(mobile.textContent.trim());
    });

    // 传真
    const faxes = detailLayer.querySelectorAll('.layer_line .layer_otherContent:not(.layer_otherContentphone)');
    faxes.forEach(fax => {
        const style = window.getComputedStyle(fax);
        if (style.display !== 'none' && fax.parentElement.querySelector('.layer_otherTitle_fax')) {
            info.contacts.faxes.push(fax.textContent.trim());
        }
    });

    // 获取办公地点
    const location = detailLayer.querySelector('.company_address');
    if (location) info.location = location.textContent.trim();

    // 详细地址
    const addressElements = detailLayer.querySelectorAll('.layer_line');
    addressElements.forEach(element => {
        const titleEl = element.querySelector('.layer_otherTitle');
        const contentEls = element.querySelectorAll('.layer_otherContent');
        if (titleEl && titleEl.textContent.trim() === '地址：') {
            contentEls.forEach(contentEl => {
                const style = window.getComputedStyle(contentEl);
                if (style.display !== 'none') {
                    info.addresses.push(contentEl.textContent.trim());
                }
            });
        }
    });

    // 获取经营品牌信息
    const brandLists = detailLayer.querySelectorAll('.layer_brandList');
    brandLists.forEach(brand => {
        const brandName = brand.querySelector('.brandName')?.textContent.trim();
        const percentage = brand.querySelector('.num')?.textContent.trim();
        if (brandName && percentage) {
            info.brands.push({
                name: brandName,
                percentage: percentage
            });
        }
    });

    return info;
}

// 根据标签优先级对供应商进行排序
function sortSuppliersByTagPriority(supplierStore) {
    const priorityMap = {
        'yuanchang': 1,
        'daili': 2,
        'iccp': 3,
        'sscp': 4,
        'redvip': 5,
        'stock': 6,
        'icon500': 7
    };

    supplierStore.sort((a, b) => {
        const aPriority = Math.min(...a.companyTag.map(tag => priorityMap[tag] || Infinity));
        const bPriority = Math.min(...b.companyTag.map(tag => priorityMap[tag] || Infinity));
        return aPriority - bPriority;
    });
}

// 总结供应商信息 ==> 排序&过滤&去重&截取
function summarizeSuppliers(supplierStore, inquiry_supplier_number) {
    // 先排序
    // sortSuppliersByTagPriority(supplierStore);

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

            delete item.company;
            delete item.visibleLinks;
            return true;
        });

    // 返回指定数量的供应商
    const result = storage.slice(0, inquiry_supplier_number).map(item => ({ ...item, companyName: item.companyName[0] }));
    return result;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 处理供应信息
window.getSuppliersProcessByJyw = function () {
    const inquiry_supplier_number = 50;
    const batchSize = 50;

    return new Promise((resolve) => {
        try {
            const supplierStore = [];
            let total = 0
            const stairTrElements = document.getElementsByClassName('stair_tr');

            if (stairTrElements.length === 0) {
                resolve({
                    success: false,
                    data: [],
                    error: '当前物料编码，在【交易网】未找到供应商信息。'
                });
                return;
            }

            const elements = Array.from(stairTrElements);
            const totalElements = elements.length;
            let processedCount = 0;

            async function processBatch() {
                const end = Math.min(processedCount + batchSize, totalElements);

                for (let i = processedCount; i < end; i++) {
                    const stairTr = elements[i];
                    const elementData = {
                        company: null,
                        visibleLinks: [],
                        companyName: [],
                        companyTag: [],
                        companyInfo: {},
                        materialId: [],
                        materialTags: [],
                        brand: null,
                        batchId: null,
                        totalNumber: null,
                        packaging: null,
                        storehouse: null,
                        desc: null,
                        qqAccount: [],
                        source: 'jyw',
                        materialDate: ''
                    };

                    // 获取供应信息
                    const supplyElement = stairTr.querySelector('.result_supply');
                    if (supplyElement) {
                        elementData.company = supplyElement;
                        const supplyLinks = Array.from(supplyElement.querySelectorAll('a:not(.detailLayer a):not(.result_icons a)'));

                        supplyLinks.forEach(async (link) => {
                            if (link.offsetParent !== null) {
                                // 获取公司信息
                                const detailLayer = supplyElement.querySelector('.detailLayer');
                                elementData.companyInfo = getCompanyInfo(detailLayer);

                                elementData.visibleLinks.push(link);
                                const content = link.textContent.trim();
                                if (content) elementData.companyName.push(content);

                                // 获取 result_icons 下的所有 a 标签
                                const iconLinks = supplyElement.querySelectorAll('.result_icons a');
                                iconLinks.forEach(link => {
                                    const className = link?.className;
                                    if (className) elementData.companyTag.push(className);
                                });
                            }
                        });
                    }

                    // 获取物料编号
                    const resultIdElement = stairTr.querySelector('.result_id');
                    if (resultIdElement) {
                        // 获取物料编号
                        const productNumbers =
                            resultIdElement.querySelectorAll('.product_number');
                        productNumbers.forEach((product) => {
                            const materialIdText = product.textContent.trim();
                            if (materialIdText) elementData.materialId.push(materialIdText);
                        });
                        // 物料标签
                        const materialTags = resultIdElement.querySelectorAll('span');
                        materialTags.forEach(tag => {
                            const tagClassName = tag?.className;
                            if (tagClassName && tagClassName.includes('icon')) elementData.materialTags.push(tagClassName);
                        });
                    }

                    // 获取厂商
                    const brandElement = stairTr.querySelector('div.result_factory')
                    if (brandElement) {
                        const brandText = brandElement.textContent.trim();
                        if (brandText) elementData.brand = brandText;
                    }

                    // 获取批号
                    const resultBatchIdElement = stairTr.querySelector('.result_batchNumber');
                    if (resultBatchIdElement) {
                        const batchIdText = resultBatchIdElement.textContent.trim();
                        if (batchIdText) elementData.batchId = batchIdText;
                    }

                    // 获取数量
                    const totalNumberElements = stairTr.querySelectorAll('.result_totalNumber');
                    if (totalNumberElements) {
                        totalNumberElements.forEach((element) => {
                            const display = !(getComputedStyle(element).display.includes('none'));
                            if (display) {
                                const totalNumberText = element.textContent.trim();
                                if (totalNumberText) elementData.totalNumber = totalNumberText;
                            }
                        })
                    }

                    // 获取封装
                    const packagingElement = stairTr.querySelector('.result_pakaging');
                    if (packagingElement) {
                        const packagingText = packagingElement.textContent.trim();
                        if (packagingText) elementData.packaging = packagingText;
                    }

                    // 获取库位
                    const kwPlaceElement = stairTr.querySelector('.result_kwplace');
                    if (kwPlaceElement) {
                        const kwElement = kwPlaceElement.querySelector('.kw_list');
                        if (kwElement) {
                            const kwText = kwElement.textContent.trim();
                            if (kwText) elementData.storehouse = kwText;
                        }
                    }

                    // 获取说明
                    const explainElement = stairTr.querySelector('.result_explain');
                    if (explainElement) {
                        const explainText = explainElement.textContent.trim();
                        if (explainText) elementData.desc = explainText;
                    }

                    // 获取询价信息中的QQ账号
                    const askPriceElement = stairTr.querySelector('.result_askPrice');
                    if (askPriceElement) {
                        const askPriceLinks = askPriceElement.querySelectorAll('a');
                        askPriceLinks.forEach((link) => {
                            if (link.offsetParent !== null) {
                                const myTitle = link.getAttribute('mytitle');
                                if (myTitle) elementData.qqAccount.push(myTitle)
                            }
                        });
                    }

                    // 获取物料日期
                    const materialDateElement = stairTr.querySelector('.result_date');
                    if (materialDateElement) {
                        const materialDateText = materialDateElement.textContent.trim();
                        if (materialDateText) elementData.materialDate = materialDateText;
                    }

                    supplierStore.push(elementData);
                }

                // 总数结果
                const icCountDom = document.getElementById('icCount')
                total = Number(icCountDom.innerText)

                processedCount = end;

                if (processedCount < totalElements) {
                    requestAnimationFrame(processBatch);
                } else {
                    let supplierStoreuppliers = summarizeSuppliers(supplierStore, inquiry_supplier_number)

                    resolve({
                        success: true,
                        data: supplierStoreuppliers,
                        total: total,
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

// 搜索物料
window.searchMaterial = async function (code) {
    let success = true
    try {
        const href = window.location.href
        const isSearchPage = href.includes('search')
        let searchInput = null
        let searchButton = null

        if (isSearchPage) {
            const topsearchBox = document.querySelector('.topsearchBox')
            searchInput = topsearchBox.querySelector('.topsch_input')
            searchButton = document.getElementById('btn_topSearch')
        } else {
            const head_searchMain = document.querySelector('.head_searchMain')
            searchInput = head_searchMain.querySelector('.head_searchInput')
            searchButton = document.getElementById('btn_topSearch')
        }

        if (searchInput) {
            searchInput.value = ''
            await sleep(500)
            searchInput.value = code
            await sleep(2000)
            searchButton.click()
        }
    } catch (error) {
        console.error('searchMaterial error', error)
        success = false
    }

    return success
}

// 模拟滚动
window.scrollToBottom = async function () {
    const scrollDistance = Math.floor(Math.random() * (200 - 100 + 1)) + 100 // 随机生成200到300之间的滚动距离
    const scrollDelay = 2000 // 停留时间
    const behavior = 'smooth' // 滚动行为

    // 获取当前滚动位置
    const startPosition = window.scrollY;
    // 向下滚动
    window.scrollTo({
        top: startPosition + scrollDistance,
        behavior: behavior
    });
    // 等待指定时间
    await sleep(scrollDelay)
    // 滚回原位置
    // window.scrollTo({
    //     top: startPosition,
    //     behavior: behavior
    // });
}

// 模拟鼠标移入供应商 查看供应商信息
window.mouseMoveSupplier = async function () {
    // 先从1-5随机一个数， 再随机打乱 Math.floor(supplierStoreuppliers.length / 2) 个供应商，并截取前【随机数】个
    const { data: supplierStoreuppliers } = await window.getSuppliersProcessByJyw()
    if (!supplierStoreuppliers || !supplierStoreuppliers.length) return

    const randomNum = Math.floor(Math.random() * 5) + 1;
    const frontSupplys = supplierStoreuppliers.slice(0, Math.floor(supplierStoreuppliers.length / 2)).sort(() => Math.random() - 0.5).slice(0, randomNum);
    for (const supplier of frontSupplys) {
        const supplyLinks = Array.from(supplier.company.querySelectorAll('a:not(.detailLayer a):not(.result_icons a)'));
        for (const link of supplyLinks) {
            if (link.offsetParent !== null) {
                // 触发鼠标移入事件
                link.dispatchEvent(new MouseEvent('mouseover', {
                    view: window,
                    bubbles: true,
                    cancelable: true
                }));

                const randomSecond = Math.floor(Math.random() * 4) + 2; // 等待随机2-5s后 鼠标移开
                await new Promise(resolve => setTimeout(resolve, randomSecond * 1000));

                // 触发鼠标移出事件
                link.dispatchEvent(new MouseEvent('mouseout', {
                    view: window,
                    bubbles: true,
                    cancelable: true
                }));

                // 在处理下一个链接前稍作等待
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
}


// 校验账号是否没封禁
window.checkAccountIsBlocked = async function (account) {
    const bodyDom = document.querySelector('body')
    const bodyDomText = bodyDom.textContent
    const blocked = bodyDomText.includes('禁止访问, 请联系客服')
    return blocked
}

