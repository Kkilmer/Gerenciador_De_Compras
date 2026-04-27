const state = {
    markets: [],
    items: [],
    editingPurchaseId: null
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
});

function getCurrentMonthValue() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
}

function renderMarkets() {
    const marketSelect = document.getElementById("marketSelect");
    const historyMarketFilter = document.getElementById("historyMarketFilter");
    marketSelect.innerHTML = "";

    if (historyMarketFilter) {
        historyMarketFilter.innerHTML = "";
        const allOption = document.createElement("option");
        allOption.value = "";
        allOption.textContent = "Todos os mercados";
        historyMarketFilter.appendChild(allOption);
    }

    if (!state.markets.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Cadastre um mercado";
        marketSelect.appendChild(option);
        return;
    }

    state.markets.forEach((market) => {
        const option = document.createElement("option");
        option.value = market;
        option.textContent = market;
        marketSelect.appendChild(option);

        if (historyMarketFilter) {
            const filterOption = document.createElement("option");
            filterOption.value = market;
            filterOption.textContent = market;
            historyMarketFilter.appendChild(filterOption);
        }
    });
}

function addItem(item = { name: "", quantity: 1, unitPrice: 0 }) {
    state.items.push(item);
    renderItems();
}

function removeItem(index) {
    state.items.splice(index, 1);
    renderItems();
}

function updateItem(index, field, value) {
    state.items[index][field] = field === "name" ? value : Number(value);
    renderItems();
}

function getItemTotal(item) {
    return (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
}

function getPurchasePayload() {
    return {
        month: document.getElementById("monthInput").value,
        market: document.getElementById("marketSelect").value,
        items: state.items
    };
}

function updateTotalView() {
    const total = state.items.reduce((sum, item) => sum + getItemTotal(item), 0);
    document.getElementById("totalPurchaseValue").textContent = currencyFormatter.format(total);
    const heroTotalValue = document.getElementById("heroTotalValue");
    if (heroTotalValue) {
        heroTotalValue.textContent = currencyFormatter.format(total);
    }
}

function renderItems() {
    const container = document.getElementById("itemsContainer");
    container.innerHTML = "";

    state.items.forEach((item, index) => {
        const row = document.createElement("div");
        row.className = "item-row";
        row.innerHTML = `
            <label>
                <span>Produto</span>
                <input type="text" value="${item.name}" data-index="${index}" data-field="name">
            </label>
            <label>
                <span>Quantidade</span>
                <input type="number" min="0" step="1" value="${item.quantity}" data-index="${index}" data-field="quantity">
            </label>
            <label>
                <span>Preço unitário</span>
                <input type="number" min="0" step="0.01" value="${item.unitPrice}" data-index="${index}" data-field="unitPrice">
            </label>
            <div>
                <span class="muted">Total do item</span>
                <div class="item-total">${currencyFormatter.format(getItemTotal(item))}</div>
                <button class="danger-btn" type="button" data-remove="${index}">Remover</button>
            </div>
        `;
        container.appendChild(row);
    });

    container.querySelectorAll("input").forEach((input) => {
        input.addEventListener("input", (event) => {
            const target = event.target;
            updateItem(Number(target.dataset.index), target.dataset.field, target.value);
        });
    });

    container.querySelectorAll("[data-remove]").forEach((button) => {
        button.addEventListener("click", () => {
            removeItem(Number(button.dataset.remove));
        });
    });

    updateTotalView();
}

function showSummary(data) {
    const summaryElement = document.getElementById("summaryContainer");
    const hints = data.comparisonHints || [];
    const hintLines = hints.length
        ? hints.map((hint) =>
            `Produto: ${hint.product}\nMenor preço visto: ${currencyFormatter.format(hint.lowestPriceSeen)}\nMaior preço visto: ${currencyFormatter.format(hint.highestPriceSeen)}`
        ).join("\n\n")
        : "Ainda não há comparação suficiente.";

    summaryElement.textContent =
        `Mercado: ${data.market}\n` +
        `Mês: ${data.month}\n` +
        `Itens: ${data.summary.itemCount}\n` +
        `Total: ${currencyFormatter.format(data.totalPurchase)}\n\n` +
        `Comparação inicial:\n${hintLines}`;
}

function calculateSummary() {
    const payload = getPurchasePayload();

    if (!payload.market) {
        alert("Selecione um mercado.");
        return;
    }

    if (!payload.items.length) {
        alert("Adicione pelo menos um produto.");
        return;
    }

    if (window.AndroidBridge && window.AndroidBridge.processMonthlyPurchase) {
        const rawResponse = window.AndroidBridge.processMonthlyPurchase(JSON.stringify(payload));
        const parsedResponse = JSON.parse(rawResponse);
        showSummary(parsedResponse);
        return;
    }

    const fallbackTotal = payload.items.reduce((sum, item) => sum + getItemTotal(item), 0);
    showSummary({
        market: payload.market,
        month: payload.month,
        totalPurchase: fallbackTotal,
        summary: { itemCount: payload.items.length },
        comparisonHints: []
    });
}

function savePurchase() {
    const payload = getPurchasePayload();

    if (!window.AndroidBridge || !window.AndroidBridge.savePurchase) {
        alert("O salvamento local funciona no app Android.");
        return;
    }

    const rawResponse = state.editingPurchaseId
        ? window.AndroidBridge.updatePurchase(String(state.editingPurchaseId), JSON.stringify(payload))
        : window.AndroidBridge.savePurchase(JSON.stringify(payload));
    const parsedResponse = JSON.parse(rawResponse);
    alert(parsedResponse.message || "Compra salva.");
    clearForm();
    loadHistory();
    loadComparison(payload.month);
}

function loadMarkets() {
    if (window.AndroidBridge && window.AndroidBridge.getMarkets) {
        const rawMarkets = window.AndroidBridge.getMarkets();
        const parsedMarkets = JSON.parse(rawMarkets);
        state.markets = parsedMarkets.map((market) => market.name);
    }

    renderMarkets();

    const heroMarketCount = document.getElementById("heroMarketCount");
    if (heroMarketCount) {
        heroMarketCount.textContent = String(state.markets.length);
    }
}

function getHistoryFilters() {
    return {
        month: document.getElementById("historyMonthFilter")?.value || "",
        market: document.getElementById("historyMarketFilter")?.value || "",
        product: document.getElementById("historyProductFilter")?.value.trim() || ""
    };
}

function loadHistory() {
    const historyContainer = document.getElementById("historyContainer");
    const filters = getHistoryFilters();

    if (!window.AndroidBridge || !window.AndroidBridge.getMonthlyHistory) {
        historyContainer.textContent = "O histórico aparecerá no app Android.";
        return;
    }

    const rawHistory = window.AndroidBridge.getFilteredMonthlyHistory
        ? window.AndroidBridge.getFilteredMonthlyHistory(filters.month, filters.market, filters.product)
        : window.AndroidBridge.getMonthlyHistory();
    const entries = JSON.parse(rawHistory);

    if (!entries.length) {
        historyContainer.textContent = "Nenhuma compra encontrada para esse filtro.";
        return;
    }

    historyContainer.innerHTML = "";
    entries.forEach((entry) => {
        const card = document.createElement("div");
        card.className = "history-card";
        card.innerHTML = `
            <strong>${entry.market}</strong>
            <span>Mês: ${entry.month}</span>
            <span>Itens: ${entry.itemCount}</span>
            <span>Total: ${currencyFormatter.format(entry.totalAmount)}</span>
            <div class="history-actions">
                <button type="button" data-edit="${entry.purchaseId}">Editar</button>
                <button type="button" class="danger-btn" data-delete="${entry.purchaseId}">Excluir</button>
            </div>
        `;
        historyContainer.appendChild(card);
    });

    historyContainer.querySelectorAll("[data-edit]").forEach((button) => {
        button.addEventListener("click", () => loadPurchaseForEdit(Number(button.dataset.edit)));
    });

    historyContainer.querySelectorAll("[data-delete]").forEach((button) => {
        button.addEventListener("click", () => deletePurchase(Number(button.dataset.delete)));
    });
}

function loadPurchaseForEdit(purchaseId) {
    if (!window.AndroidBridge || !window.AndroidBridge.getPurchaseDetails) {
        return;
    }

    const rawResponse = window.AndroidBridge.getPurchaseDetails(String(purchaseId));
    const purchase = JSON.parse(rawResponse);
    state.editingPurchaseId = purchase.purchaseId;
    state.items = (purchase.items || []).map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice
    }));

    document.getElementById("monthInput").value = purchase.month;
    document.getElementById("marketSelect").value = purchase.market;
    document.getElementById("editBanner").classList.remove("hidden");
    renderItems();
    calculateSummary();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function deletePurchase(purchaseId) {
    if (!window.AndroidBridge || !window.AndroidBridge.deletePurchase) {
        return;
    }

    const confirmed = window.confirm("Deseja excluir esta compra?");
    if (!confirmed) {
        return;
    }

    const rawResponse = window.AndroidBridge.deletePurchase(String(purchaseId));
    const response = JSON.parse(rawResponse);
    alert(response.message || "Compra excluída.");

    if (state.editingPurchaseId === purchaseId) {
        clearForm();
    }

    loadHistory();
    loadComparison();
}

function clearForm() {
    state.editingPurchaseId = null;
    state.items = [];
    document.getElementById("monthInput").value = getCurrentMonthValue();
    document.getElementById("marketSelect").selectedIndex = 0;
    document.getElementById("editBanner").classList.add("hidden");
    document.getElementById("summaryContainer").textContent = "Nenhum cálculo realizado ainda.";
    addItem({ name: "", quantity: 1, unitPrice: 0 });
}

function renderMarketComparison(data) {
    const summaryContainer = document.getElementById("comparisonSummary");
    const marketContainer = document.getElementById("marketComparisonContainer");
    const chartContainer = document.getElementById("marketComparisonChart");

    if (!data.markets || !data.markets.length) {
        summaryContainer.textContent = `Nenhuma compra encontrada para ${data.month}.`;
        marketContainer.textContent = "Sem dados ainda.";
        chartContainer.textContent = "Sem gráfico ainda.";
        return;
    }

    const bestMarket = data.bestMarket;
    summaryContainer.textContent =
        `No mês ${data.month}, o mercado mais barato foi ${bestMarket.market} ` +
        `com total de ${currencyFormatter.format(bestMarket.monthTotal)}.`;

    marketContainer.innerHTML = "";
    data.markets.forEach((entry, index) => {
        const card = document.createElement("div");
        card.className = `history-card${index === 0 ? " highlight-card" : ""}`;
        card.innerHTML = `
            <strong>${index + 1}. ${entry.market}</strong>
            <span>Total do mês: ${currencyFormatter.format(entry.monthTotal)}</span>
            <span>Compras registradas: ${entry.purchaseCount}</span>
        `;
        marketContainer.appendChild(card);
    });

    renderBarChart(
        chartContainer,
        data.markets.map((entry) => ({
            label: entry.market,
            value: entry.monthTotal,
            text: currencyFormatter.format(entry.monthTotal),
            warm: false
        }))
    );
}

function renderProductComparison(products) {
    const container = document.getElementById("productComparisonContainer");

    if (!products.length) {
        container.textContent = "Sem comparação de produtos para este mês.";
        return;
    }

    container.innerHTML = "";
    products.forEach((product) => {
        const bestMarket = product.bestMarket;
        const card = document.createElement("div");
        card.className = "history-card";
        const marketLines = product.markets.map((entry) =>
            `${entry.market}: média ${currencyFormatter.format(entry.averageUnitPrice)}`
        ).join("<br>");

        card.innerHTML = `
            <strong>${product.product}</strong>
            <span>Melhor mercado: ${bestMarket.market}</span>
            <span>Menor média: ${currencyFormatter.format(bestMarket.averageUnitPrice)}</span>
            <span>${marketLines}</span>
        `;
        container.appendChild(card);
    });
}

function formatSignedCurrency(value) {
    const prefix = value > 0 ? "+" : "";
    return `${prefix}${currencyFormatter.format(value)}`;
}

function formatSignedPercent(value) {
    const prefix = value > 0 ? "+" : "";
    return `${prefix}${value.toFixed(1)}%`;
}

function renderDashboardOverview(data) {
    document.getElementById("metricCurrentTotal").textContent = currencyFormatter.format(data.currentTotal || 0);
    document.getElementById("metricPreviousTotal").textContent = currencyFormatter.format(data.previousTotal || 0);
    document.getElementById("metricVariationPercent").textContent = formatSignedPercent(data.differencePercent || 0);
    document.getElementById("metricBestMarket").textContent = data.bestMarket?.market || "--";
    document.getElementById("metricHighestIncrease").textContent = data.highestIncrease?.product || "--";
    document.getElementById("metricBiggestDrop").textContent = data.biggestDrop?.product || "--";

    renderLineChart(
        document.getElementById("monthlyTrendChart"),
        document.getElementById("monthlyTrendLegend"),
        (data.monthlySpendingTrend || []).map((entry) => ({
            label: entry.month,
            value: entry.total,
            text: currencyFormatter.format(entry.total)
        }))
    );

    renderBarChart(
        document.getElementById("dashboardMarketChart"),
        (data.marketBars || []).map((entry) => ({
            label: entry.market,
            value: entry.monthTotal,
            text: currencyFormatter.format(entry.monthTotal),
            warm: false
        }))
    );

    renderMarketHistoricalRanking(data.marketHistoricalRanking || []);
    renderPriceAlerts(data.priceAlerts || {});
}

function renderMonthVsPrevious(data) {
    const summaryContainer = document.getElementById("monthVsPreviousSummary");
    const marketContainer = document.getElementById("marketMonthChangeContainer");
    const productContainer = document.getElementById("productMonthChangeContainer");
    const chartContainer = document.getElementById("marketMonthChangeChart");

    summaryContainer.textContent =
        `Comparando ${data.currentMonth} com ${data.previousMonth}, ` +
        `o total foi de ${currencyFormatter.format(data.previousTotal)} para ` +
        `${currencyFormatter.format(data.currentTotal)} ` +
        `(${formatSignedCurrency(data.difference)} | ${formatSignedPercent(data.differencePercent)}).`;

    marketContainer.innerHTML = "";
    if (!data.marketChanges.length) {
        marketContainer.textContent = "Sem mercados suficientes para comparar.";
        chartContainer.textContent = "Sem gráfico ainda.";
    } else {
        data.marketChanges.forEach((entry) => {
            const card = document.createElement("div");
            card.className = `history-card${entry.difference < 0 ? " highlight-card" : ""}`;
            card.innerHTML = `
                <strong>${entry.market}</strong>
                <span>Mês anterior: ${currencyFormatter.format(entry.previousTotal)}</span>
                <span>Mês atual: ${currencyFormatter.format(entry.currentTotal)}</span>
                <span>Diferença: ${formatSignedCurrency(entry.difference)} (${formatSignedPercent(entry.differencePercent)})</span>
            `;
            marketContainer.appendChild(card);
        });

        renderBarChart(
            chartContainer,
            data.marketChanges.map((entry) => ({
                label: entry.market,
                value: Math.abs(entry.difference),
                text: `${formatSignedCurrency(entry.difference)} (${formatSignedPercent(entry.differencePercent)})`,
                warm: entry.difference > 0
            }))
        );
    }

    productContainer.innerHTML = "";
    if (!data.productChanges.length) {
        productContainer.textContent = "Sem produtos suficientes para comparar.";
    } else {
        data.productChanges.slice(0, 8).forEach((entry) => {
            const card = document.createElement("div");
            card.className = "history-card";
            card.innerHTML = `
                <strong>${entry.product}</strong>
                <span>Status: ${entry.trend}</span>
                <span>Média anterior: ${currencyFormatter.format(entry.previousAverage)}</span>
                <span>Média atual: ${currencyFormatter.format(entry.currentAverage)}</span>
                <span>Diferença absoluta: ${currencyFormatter.format(entry.absoluteDifference)}</span>
                <span>Diferença percentual: ${formatSignedPercent(entry.differencePercent)}</span>
                <span>Variação: ${formatSignedCurrency(entry.difference)}</span>
            `;
            productContainer.appendChild(card);
        });
    }
}

function renderMarketHistoricalRanking(entries) {
    const container = document.getElementById("marketHistoricalRankingContainer");
    if (!container) {
        return;
    }

    if (!entries.length) {
        container.textContent = "Salve compras em mais mercados para gerar o ranking.";
        return;
    }

    container.innerHTML = "";
    entries.forEach((entry, index) => {
        const card = document.createElement("div");
        card.className = `history-card ranking-card${index === 0 ? " highlight-card" : ""}`;
        card.innerHTML = `
            <div class="ranking-header">
                <strong>${entry.position}. ${entry.market}</strong>
                <span class="ranking-score">Score ${entry.score.toFixed(2)}</span>
            </div>
            <span>Média de gasto: ${currencyFormatter.format(entry.averageSpend)}</span>
            <span>Vezes mais barato: ${entry.timesCheapest}</span>
            <span>Média normalizada: ${entry.normalizedAverageSpend.toFixed(2)}</span>
        `;
        container.appendChild(card);
    });
}

function renderPriceAlerts(data) {
    const summaryContainer = document.getElementById("priceAlertsSummary");
    const attentionContainer = document.getElementById("priceAttentionList");
    if (!summaryContainer || !attentionContainer) {
        return;
    }

    const increaseCount = data.increaseCount || 0;
    const decreaseCount = data.decreaseCount || 0;
    const attentionList = data.attentionList || [];

    summaryContainer.innerHTML = `
        <article class="alert-card alert-up">
            <span>Aumentaram mais de 20%</span>
            <strong>${increaseCount}</strong>
        </article>
        <article class="alert-card alert-down">
            <span>Diminuíram mais de 20%</span>
            <strong>${decreaseCount}</strong>
        </article>
    `;

    if (!attentionList.length) {
        attentionContainer.textContent = "Sem alertas fortes no momento.";
        return;
    }

    attentionContainer.innerHTML = "";
    attentionList.forEach((entry) => {
        const card = document.createElement("div");
        const isIncrease = entry.alertType === "aumento";
        card.className = `history-card attention-card ${isIncrease ? "attention-up" : "attention-down"}`;
        card.innerHTML = `
            <div class="ranking-header">
                <strong>${entry.product}</strong>
                <span class="attention-tag ${isIncrease ? "attention-tag-up" : "attention-tag-down"}">
                    ${isIncrease ? "Atenção" : "Oportunidade"}
                </span>
            </div>
            <span>Status: ${isIncrease ? "aumentou mais de 20%" : "diminuiu mais de 20%"}</span>
            <span>Média anterior: ${currencyFormatter.format(entry.previousAverage)}</span>
            <span>Média atual: ${currencyFormatter.format(entry.currentAverage)}</span>
            <span>Variação: ${formatSignedCurrency(entry.difference)} (${formatSignedPercent(entry.differencePercent)})</span>
        `;
        attentionContainer.appendChild(card);
    });
}

function renderBarChart(container, items) {
    if (!container) {
        return;
    }

    if (!items.length) {
        container.textContent = "Sem gráfico ainda.";
        return;
    }

    const maxValue = Math.max(...items.map((item) => item.value), 0);
    container.innerHTML = "";

    items.forEach((item) => {
        const percentage = maxValue === 0 ? 0 : (item.value / maxValue) * 100;
        const row = document.createElement("div");
        row.className = "chart-row";
        row.innerHTML = `
            <div class="chart-meta">
                <strong>${item.label}</strong>
                <span>${item.text}</span>
            </div>
            <div class="chart-track">
                <div class="chart-fill${item.warm ? " warm" : ""}" style="width: ${Math.max(percentage, 6)}%"></div>
            </div>
        `;
        container.appendChild(row);
    });
}

function renderLineChart(container, legendContainer, items) {
    if (!container) {
        return;
    }

    if (!items.length) {
        container.textContent = "Sem gráfico ainda.";
        if (legendContainer) {
            legendContainer.textContent = "Sem dados ainda.";
        }
        return;
    }

    const width = 320;
    const height = 180;
    const padding = 20;
    const maxValue = Math.max(...items.map((item) => item.value), 0);
    const minValue = Math.min(...items.map((item) => item.value), 0);
    const valueRange = Math.max(maxValue - minValue, 1);

    const points = items.map((item, index) => {
        const x = items.length === 1
            ? width / 2
            : padding + (index * (width - padding * 2)) / (items.length - 1);
        const y = height - padding - ((item.value - minValue) / valueRange) * (height - padding * 2);
        return { x, y, ...item };
    });

    const linePath = points.map((point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`
    ).join(" ");
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

    container.innerHTML = `
        <svg viewBox="0 0 ${width} ${height}" class="line-chart-svg" role="img" aria-label="Evolução de gastos por mês">
            <path d="${areaPath}" class="line-chart-area"></path>
            <path d="${linePath}" class="line-chart-path"></path>
            ${points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="5" class="line-chart-point"></circle>`).join("")}
        </svg>
    `;

    if (legendContainer) {
        legendContainer.innerHTML = "";
        items.forEach((item) => {
            const row = document.createElement("div");
            row.className = "chart-legend-item";
            row.innerHTML = `
                <strong>${item.label}</strong>
                <span>${item.text}</span>
            `;
            legendContainer.appendChild(row);
        });
    }
}

function loadComparison(month = document.getElementById("comparisonMonthInput").value) {
    const comparisonMonth = month || getCurrentMonthValue();
    document.getElementById("comparisonMonthInput").value = comparisonMonth;

    if (window.AndroidBridge && window.AndroidBridge.getDashboardOverview) {
        const rawOverview = window.AndroidBridge.getDashboardOverview(comparisonMonth);
        const overviewData = JSON.parse(rawOverview);
        renderDashboardOverview(overviewData);
    }

    if (!window.AndroidBridge || !window.AndroidBridge.getMonthlyComparison) {
        document.getElementById("comparisonSummary").textContent =
            "A comparação mensal completa aparece no app Android.";
        return;
    }

    const rawMonthly = window.AndroidBridge.getMonthlyComparison(comparisonMonth);
    const monthlyData = JSON.parse(rawMonthly);
    renderMarketComparison(monthlyData);

    if (window.AndroidBridge.getProductComparison) {
        const rawProducts = window.AndroidBridge.getProductComparison(comparisonMonth);
        const productData = JSON.parse(rawProducts);
        renderProductComparison(productData);
    }

    if (window.AndroidBridge.getMonthVsPrevious) {
        const rawMonthChange = window.AndroidBridge.getMonthVsPrevious(comparisonMonth);
        const monthChangeData = JSON.parse(rawMonthChange);
        renderMonthVsPrevious(monthChangeData);
    }
}

function registerEvents() {
    document.getElementById("addMarketBtn").addEventListener("click", () => {
        const input = document.getElementById("newMarketInput");
        const marketName = input.value.trim();
        if (!marketName) {
            return;
        }

        if (window.AndroidBridge && window.AndroidBridge.addMarket) {
            const rawResponse = window.AndroidBridge.addMarket(marketName);
            const response = JSON.parse(rawResponse);
            if (!state.markets.includes(response.name)) {
                state.markets.push(response.name);
                state.markets.sort((a, b) => a.localeCompare(b, "pt-BR"));
            }
        } else if (!state.markets.includes(marketName)) {
            state.markets.push(marketName);
        }

        renderMarkets();
        document.getElementById("marketSelect").value = marketName;
        input.value = "";
    });

    document.getElementById("addItemBtn").addEventListener("click", () => addItem());
    document.getElementById("calculateBtn").addEventListener("click", calculateSummary);
    document.getElementById("refreshHistoryBtn").addEventListener("click", loadHistory);
    document.getElementById("applyHistoryFiltersBtn").addEventListener("click", loadHistory);
    document.getElementById("clearHistoryFiltersBtn").addEventListener("click", () => {
        document.getElementById("historyMonthFilter").value = "";
        document.getElementById("historyMarketFilter").value = "";
        document.getElementById("historyProductFilter").value = "";
        loadHistory();
    });
    document.getElementById("loadComparisonBtn").addEventListener("click", () => loadComparison());
    document.getElementById("cancelEditBtn").addEventListener("click", clearForm);
    document.getElementById("calculateBtn").insertAdjacentHTML(
        "afterend",
        '<button id="savePurchaseBtn" type="button">Salvar compra</button>'
    );
    document.getElementById("savePurchaseBtn").addEventListener("click", savePurchase);
}

function init() {
    const currentMonth = getCurrentMonthValue();
    document.getElementById("monthInput").value = currentMonth;
    document.getElementById("comparisonMonthInput").value = currentMonth;
    document.getElementById("currentMonthBadge").textContent = `Mês atual: ${currentMonth}`;
    document.getElementById("heroCurrentMonth").textContent = currentMonth;

    loadMarkets();
    addItem({ name: "Arroz 5kg", quantity: 1, unitPrice: 28.9 });
    registerEvents();
    loadHistory();
    loadComparison(currentMonth);
}

init();
