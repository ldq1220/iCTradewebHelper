window.getSuppliersProcessByLcsc = function () {
    const material_info_number = 2;

    return new Promise((resolve) => {
        try {
            const lsscMaterialInfos = [];
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
                    materialId: [],
                    brand: null,
                    packaging: null,
                    desc: null,
                    category: null,
                    categoryCode: null,
                    tieredPricing: [],
                    storehouse: [],
                    source: 'lcsc'
                };
            }

            resolve({
                success: true,
                data: lsscMaterialInfos,
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