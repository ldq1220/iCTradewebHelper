window.getSuppliersProcessByLcsc = function () {
    const material_info_number = 2;

    return new Promise((resolve) => {
        try {
            const lcscMaterialInfos = [];
            const shopListElements = document.getElementById("shop-list");
            const tableElements = shopListElements.querySelectorAll("table");

            if (tableElements.length === 0) {
                resolve({
                    success: false,
                    data: [],
                    error: '当前物料编码在【立创商城】未搜索到商品。'
                });
                return;
            }

            for (let i = 0; i < tableElements.length; i++) {
                const tableElement = tableElements[i];
                const elementData = {
                    companyName: '立创商城',
                    materialId: '',
                    brand: null,
                    packaging: null,
                    desc: null,
                    category: null,
                    categoryCode: null,
                    tieredPricing: [],
                    storehouse: [],
                    source: 'lcsc'
                };

                // 料号
                const materialNumberElement = tableElement.querySelector('.LUCENE_HIGHLIGHT_CLASS');
                if (materialNumberElement) elementData.materialId = materialNumberElement.textContent.trim();

                // 品牌
                const brandElement = tableElement.querySelector('.band');
                const brandNameElement = tableElement.querySelector('.brand-name');
                if (brandNameElement) elementData.brand = brandNameElement.textContent.trim();

                // 封装
                const packagingElement = brandElement?.nextElementSibling; // 获取品牌的下一个兄弟节点 【封装】
                const packagingSpans = packagingElement?.querySelectorAll('span');
                if (packagingSpans?.length >= 2) elementData.packaging = packagingSpans[1].textContent.trim();

                // 描述
                const descElement = tableElement.querySelector('.description');
                const descSpans = descElement?.querySelectorAll('span');
                if (descSpans?.length >= 2) elementData.desc = descSpans[1].textContent.trim();

                // 类目 编号
                const categoryElement = tableElement.querySelector('.catalog');
                const categoryCodeElement = categoryElement?.parentElement?.nextElementSibling; // 获取类目的父元素的下一个兄弟节点 【编号】
                const categoryCodeSpans = categoryCodeElement?.querySelectorAll('span');
                if (categoryElement) elementData.category = categoryElement.textContent.trim();
                if (categoryCodeSpans?.length >= 2) elementData.categoryCode = categoryCodeSpans[1].textContent.trim();

                // 阶梯价
                const threeNrElement = tableElement.querySelector('.three-nr');
                const threeNrItems = threeNrElement?.querySelectorAll('.three-nr-item');
                threeNrItems?.forEach(item => {
                    const pElement = item.querySelector('p');
                    const priceElement = item.querySelector('span');
                    const priceItem = {
                        number: null,
                        price: null,
                    }
                    if (pElement) priceItem.number = pElement.textContent.trim()
                    if (priceElement) priceItem.price = priceElement.textContent.trim();
                    elementData.tieredPricing.push(priceItem)
                });

                // 仓库
                const gdStorehouseElement = tableElement.querySelector('.stock-nums-gd'); // 广东仓
                if (gdStorehouseElement) {
                    elementData.storehouse.push({
                        name: gdStorehouseElement.childNodes[0].textContent.trim(),
                        stock: Number(gdStorehouseElement.querySelector('span').textContent.trim())
                    })
                }
                const jsStorehouseElement = tableElement.querySelector('.stock-nums-js'); // 江苏仓
                if (jsStorehouseElement) {
                    elementData.storehouse.push({
                        name: jsStorehouseElement.innerText.trim(),
                        stock: Number(jsStorehouseElement.querySelector('span').innerText.trim())
                    })
                }

                lcscMaterialInfos.push(elementData);
            }

            resolve({
                success: true,
                data: lcscMaterialInfos,
                error: null,
            });
        } catch (error) {
            resolve({
                success: false,
                data: [],
                error: error.message
            });
        }
    });
};