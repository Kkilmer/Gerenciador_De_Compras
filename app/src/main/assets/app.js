const state = {
    markets: [],
    items: [],
    editingPurchaseId: null,
    activeTab: "home",
    csvImport: {
        fileName: "",
        items: [],
        errors: [],
        suggestedMarket: "",
        suggestedMonth: ""
    }
};

const LAST_MARKET_STORAGE_KEY = "gerenciador-compras:last-market";
const THEME_STORAGE_KEY = "gerenciador-compras:theme";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
});

const MONTH_NAME_MAP = {
    jan: 1,
    janeiro: 1,
    fev: 2,
    fevereiro: 2,
    mar: 3,
    marco: 3,
    março: 3,
    abr: 4,
    abril: 4,
    mai: 5,
    maio: 5,
    jun: 6,
    junho: 6,
    jul: 7,
    julho: 7,
    ago: 8,
    agosto: 8,
    set: 9,
    setembro: 9,
    out: 10,
    outubro: 10,
    nov: 11,
    novembro: 11,
    dez: 12,
    dezembro: 12
};

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function normalizeNumberInput(value) {
    return String(value ?? "")
        .trim()
        .replace(/\s+/g, "")
        .replace(",", ".");
}

function parseLocalizedNumber(value) {
    const normalizedValue = normalizeNumberInput(value);
    if (!normalizedValue) {
        return 0;
    }

    const parsedValue = Number(normalizedValue);
    return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function normalizeTextForMatching(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function normalizeHeaderName(value) {
    return normalizeTextForMatching(value)
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function formatNumberInput(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return "";
    }
    return String(number).replace(".", ",");
}

function getCurrentYear() {
    return new Date().getFullYear();
}

function formatMonthValue(year, month) {
    return `${year}-${String(month).padStart(2, "0")}`;
}

function parseCsvFilenameMetadata(fileName) {
    const cleanFileName = String(fileName ?? "").replace(/\.[^.]+$/, "").trim();
    if (!cleanFileName) {
        return {
            suggestedMarket: "",
            suggestedMonth: ""
        };
    }

    const normalizedName = normalizeTextForMatching(cleanFileName)
        .replace(/[()]/g, " ")
        .replace(/[_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const parts = normalizedName
        .split(/\s*-\s*/)
        .map((part) => part.trim())
        .filter(Boolean);

    let detectedMonth = 0;
    let detectedYear = 0;
    let monthPartIndex = -1;

    parts.forEach((part, index) => {
        const tokens = part.split(/\s+/).filter(Boolean);
        const matchedMonth = tokens.find((token) => MONTH_NAME_MAP[token]);
        const matchedYear = tokens.find((token) => /^\d{4}$/.test(token));

        if (matchedMonth && !detectedMonth) {
            detectedMonth = MONTH_NAME_MAP[matchedMonth];
            monthPartIndex = index;
        }

        if (matchedYear && !detectedYear) {
            detectedYear = Number(matchedYear);
        }
    });

    if (!detectedYear && detectedMonth) {
        detectedYear = getCurrentYear();
    }

    let suggestedMarket = "";
    if (monthPartIndex > 0) {
        suggestedMarket = cleanFileName
            .split(/\s*-\s*/)
            .slice(0, monthPartIndex)
            .join(" - ")
            .trim();
    } else if (parts.length > 1 && detectedMonth) {
        suggestedMarket = cleanFileName.split(/\s*-\s*/)[0]?.trim() || "";
    }

    return {
        suggestedMarket,
        suggestedMonth: detectedMonth ? formatMonthValue(detectedYear, detectedMonth) : ""
    };
}

function getItemTypeMetadata(itemType) {
    if (itemType === "weight") {
        return {
            label: "Por peso (kg)",
            quantityLabel: "Peso da balança",
            quantityPlaceholder: "Ex.: 0,750",
            unitPriceLabel: "Preço por kg",
            unitPricePlaceholder: "Ex.: 32,90"
        };
    }

    return {
        label: "Por unidade",
        quantityLabel: "Quantidade",
        quantityPlaceholder: "Ex.: 1 ou 2",
        unitPriceLabel: "Preço unitário",
        unitPricePlaceholder: "Ex.: 5,99"
    };
}

function showActionFeedback(message, type = "info") {
    const banner = document.getElementById("actionFeedback");
    if (!banner) {
        return;
    }

    banner.textContent = message;
    banner.classList.remove("hidden", "is-error", "is-success");
    if (type === "error") {
        banner.classList.add("is-error");
    } else if (type === "success") {
        banner.classList.add("is-success");
    }
}

function hideActionFeedback() {
    const banner = document.getElementById("actionFeedback");
    if (!banner) {
        return;
    }

    banner.textContent = "";
    banner.classList.add("hidden");
    banner.classList.remove("is-error", "is-success");
}

function setActiveTab(tabName) {
    if (!tabName) {
        return;
    }

    state.activeTab = tabName;
    document.querySelectorAll(".tab-panel").forEach((panel) => {
        panel.classList.toggle("is-active", panel.id === `tab-${tabName}`);
    });
    document.querySelectorAll(".tab-btn").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.tab === tabName);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function getCurrentMonthValue() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
}

function getStoredTheme() {
    try {
        return window.localStorage.getItem(THEME_STORAGE_KEY) || "light";
    } catch (error) {
        return "light";
    }
}

function updateThemeToggleLabel(theme) {
    const label = document.getElementById("themeToggleLabel");
    const toggle = document.getElementById("themeToggleBtn");
    if (!label || !toggle) {
        return;
    }

    const isDark = theme === "dark";
    label.textContent = isDark ? "Modo claro" : "Modo noturno";
    toggle.setAttribute("aria-pressed", String(isDark));
}

function applyTheme(theme) {
    const normalizedTheme = theme === "dark" ? "dark" : "light";
    document.body.dataset.theme = normalizedTheme;
    updateThemeToggleLabel(normalizedTheme);
}

function persistTheme(theme) {
    try {
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
        // Ignore storage errors to keep the app usable inside WebView.
    }
}

function toggleTheme() {
    const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    persistTheme(nextTheme);
}

function getMarketSelect() {
    return document.getElementById("marketSelect");
}

function getPersistedMarket() {
    try {
        return window.localStorage.getItem(LAST_MARKET_STORAGE_KEY) || "";
    } catch (error) {
        return "";
    }
}

function persistSelectedMarket(marketName) {
    if (!marketName) {
        return;
    }

    try {
        window.localStorage.setItem(LAST_MARKET_STORAGE_KEY, marketName);
    } catch (error) {
        // Ignore storage errors to keep the app usable inside WebView.
    }
}

function applySelectedMarket(preferredMarket = "") {
    const marketSelect = getMarketSelect();
    if (!marketSelect) {
        return;
    }

    const desiredMarket = preferredMarket || getPersistedMarket();
    if (!desiredMarket) {
        return;
    }

    const hasOption = Array.from(marketSelect.options).some((option) => option.value === desiredMarket);
    if (hasOption) {
        marketSelect.value = desiredMarket;
    }
}

function renderMarkets() {
    const marketSelect = getMarketSelect();
    const historyMarketFilter = document.getElementById("historyMarketFilter");
    const marketListContainer = document.getElementById("marketListContainer");
    const currentMarketValue = marketSelect.value || getPersistedMarket();
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
        if (marketListContainer) {
            marketListContainer.textContent = "Nenhum mercado cadastrado ainda.";
        }
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

    if (marketListContainer) {
        marketListContainer.innerHTML = "";
        state.markets.forEach((market, index) => {
            const card = document.createElement("div");
            card.className = "history-card";
            card.innerHTML = `
                <strong>${index + 1}. ${market}</strong>
                <span>Disponível para usar na aba Compra.</span>
            `;
            marketListContainer.appendChild(card);
        });
    }

    applySelectedMarket(currentMarketValue);
}

function createEditableItem(item = {}) {
    const itemType = item.itemType === "weight" ? "weight" : "unit";
    return {
        name: item.name ?? "",
        itemType,
        quantity: item.quantity ?? "1",
        unitPrice: item.unitPrice ?? ""
    };
}

function addItem(item = createEditableItem()) {
    state.items.push(createEditableItem(item));
    renderItems();
}

function removeItem(index) {
    state.items.splice(index, 1);
    renderItems();
}

function updateItem(index, field, value) {
    if (!state.items[index]) {
        return;
    }

    state.items[index][field] = value;
    if (field === "itemType") {
        updateItemModeView(index);
    }
    updateSingleItemTotal(index);
    updateTotalView();
}

function getItemTotal(item) {
    return parseLocalizedNumber(item.quantity) * parseLocalizedNumber(item.unitPrice);
}

function getPurchasePayload() {
    return {
        month: document.getElementById("monthInput").value,
        market: getMarketSelect().value,
        items: state.items.map((item) => ({
            name: item.name,
            itemType: item.itemType === "weight" ? "weight" : "unit",
            quantity: parseLocalizedNumber(item.quantity),
            unitPrice: parseLocalizedNumber(item.unitPrice)
        }))
    };
}

function updateTotalView() {
    const total = state.items.reduce((sum, item) => sum + getItemTotal(item), 0);
    document.getElementById("totalPurchaseValue").textContent = currencyFormatter.format(total);
    const heroTotalValue = document.getElementById("heroTotalValue");
    if (heroTotalValue) {
        heroTotalValue.textContent = currencyFormatter.format(total);
    }

    const currentPurchaseTotal = document.getElementById("currentPurchaseTotal");
    if (currentPurchaseTotal) {
        currentPurchaseTotal.textContent = currencyFormatter.format(total);
    }

    const currentPurchaseItemCount = document.getElementById("currentPurchaseItemCount");
    if (currentPurchaseItemCount) {
        currentPurchaseItemCount.textContent = String(state.items.length);
    }

    updateCurrentPurchaseHeader();
}

function updateSingleItemTotal(index) {
    const totalElement = document.querySelector(`[data-item-total="${index}"]`);
    if (!totalElement || !state.items[index]) {
        return;
    }

    totalElement.textContent = currencyFormatter.format(getItemTotal(state.items[index]));
}

function updateItemModeView(index) {
    const row = document.querySelector(`.item-row[data-item-row="${index}"]`);
    const item = state.items[index];
    if (!row || !item) {
        return;
    }

    const metadata = getItemTypeMetadata(item.itemType);
    const quantityLabel = row.querySelector("[data-role='quantity-label']");
    const quantityInput = row.querySelector("[data-role='quantity-input']");
    const unitPriceLabel = row.querySelector("[data-role='unit-price-label']");
    const unitPriceInput = row.querySelector("[data-role='unit-price-input']");

    if (quantityLabel) {
        quantityLabel.textContent = metadata.quantityLabel;
    }

    if (quantityInput instanceof HTMLInputElement) {
        quantityInput.placeholder = metadata.quantityPlaceholder;
    }

    if (unitPriceLabel) {
        unitPriceLabel.textContent = metadata.unitPriceLabel;
    }

    if (unitPriceInput instanceof HTMLInputElement) {
        unitPriceInput.placeholder = metadata.unitPricePlaceholder;
    }
}

function renderItems() {
    const container = document.getElementById("itemsContainer");
    container.innerHTML = "";

    state.items.forEach((item, index) => {
        const metadata = getItemTypeMetadata(item.itemType);
        const row = document.createElement("div");
        row.className = "item-row";
        row.dataset.itemRow = String(index);
        row.innerHTML = `
            <label>
                <span>Produto</span>
                <input
                    type="text"
                    inputmode="text"
                    lang="pt-BR"
                    autocomplete="off"
                    autocapitalize="sentences"
                    value="${escapeHtml(item.name)}"
                    placeholder="Ex.: arroz 5kg"
                    data-index="${index}"
                    data-field="name">
            </label>
            <label>
                <span>Tipo do item</span>
                <select data-index="${index}" data-field="itemType">
                    <option value="unit"${item.itemType === "weight" ? "" : " selected"}>Por unidade</option>
                    <option value="weight"${item.itemType === "weight" ? " selected" : ""}>Por peso (kg)</option>
                </select>
            </label>
            <label>
                <span data-role="quantity-label">${metadata.quantityLabel}</span>
                <input
                    type="text"
                    inputmode="decimal"
                    enterkeyhint="next"
                    autocomplete="off"
                    value="${escapeHtml(item.quantity)}"
                    placeholder="${metadata.quantityPlaceholder}"
                    data-index="${index}"
                    data-field="quantity"
                    data-role="quantity-input">
            </label>
            <label>
                <span data-role="unit-price-label">${metadata.unitPriceLabel}</span>
                <input
                    type="text"
                    inputmode="decimal"
                    enterkeyhint="done"
                    autocomplete="off"
                    value="${escapeHtml(item.unitPrice)}"
                    placeholder="${metadata.unitPricePlaceholder}"
                    data-index="${index}"
                    data-field="unitPrice"
                    data-role="unit-price-input">
            </label>
            <div>
                <span class="muted">Total do item</span>
                <div class="item-total" data-item-total="${index}">${currencyFormatter.format(getItemTotal(item))}</div>
                <button class="danger-btn" type="button" data-remove="${index}">Remover</button>
            </div>
        `;
        container.appendChild(row);
    });

    updateTotalView();
    renderCurrentPurchaseList();
}

function updateCurrentPurchaseHeader() {
    const currentPurchaseMarket = document.getElementById("currentPurchaseMarket");
    if (currentPurchaseMarket) {
        const selectedMarket = getMarketSelect().value || getPersistedMarket();
        currentPurchaseMarket.textContent = selectedMarket || "Nenhum mercado selecionado";
    }

    const currentPurchaseMonth = document.getElementById("currentPurchaseMonth");
    if (currentPurchaseMonth) {
        currentPurchaseMonth.textContent = document.getElementById("monthInput").value || "--";
    }
}

function focusItemEditor(index) {
    const preferredSelector = [
        `[data-index="${index}"][data-field="name"]`,
        `[data-index="${index}"][data-field="quantity"]`,
        `[data-index="${index}"][data-field="unitPrice"]`
    ];

    const emptyField = preferredSelector
        .map((selector) => document.querySelector(selector))
        .find((input) => input instanceof HTMLInputElement && !input.value.trim());
    const targetInput = emptyField || document.querySelector(`[data-index="${index}"][data-field="name"]`);

    if (targetInput instanceof HTMLInputElement) {
        targetInput.focus();
        targetInput.scrollIntoView({ behavior: "smooth", block: "center" });
        const textLength = targetInput.value.length;
        targetInput.setSelectionRange(textLength, textLength);
    }
}

function renderCurrentPurchaseList() {
    const container = document.getElementById("currentPurchaseList");
    if (!container) {
        return;
    }

    updateCurrentPurchaseHeader();

    if (!state.items.length) {
        container.textContent = "Os itens desta compra aparecerão aqui conforme você preencher.";
        return;
    }

    container.innerHTML = "";
    const currentMarket = getMarketSelect().value || getPersistedMarket() || "Nenhum mercado selecionado";

    state.items.forEach((item, index) => {
        const card = document.createElement("div");
        card.className = "history-card current-item-card";

        const productName = item.name?.trim() || `Item ${index + 1} ainda sem nome`;
        const quantity = item.quantity?.trim() || "0";
        const unitPrice = item.unitPrice?.trim() || "0,00";
        const total = currencyFormatter.format(getItemTotal(item));
        const metadata = getItemTypeMetadata(item.itemType);

        card.innerHTML = `
            <div class="current-item-meta">
                <strong>${escapeHtml(productName)}</strong>
                <span>${currentMarket}</span>
            </div>
            <div class="current-item-grid">
                <div>
                    <span class="current-item-label">Tipo</span>
                    <span class="current-item-value">${metadata.label}</span>
                </div>
                <div>
                    <span class="current-item-label">${metadata.quantityLabel}</span>
                    <span class="current-item-value">${escapeHtml(quantity)}</span>
                </div>
                <div>
                    <span class="current-item-label">${metadata.unitPriceLabel}</span>
                    <span class="current-item-value">${escapeHtml(unitPrice)}</span>
                </div>
                <div>
                    <span class="current-item-label">Total</span>
                    <span class="current-item-value">${total}</span>
                </div>
                <div>
                    <span class="current-item-label">Mercado</span>
                    <span class="current-item-value">${escapeHtml(currentMarket)}</span>
                </div>
            </div>
            <div class="current-item-actions">
                <button type="button" class="ghost-btn" data-edit-item="${index}">Editar item</button>
                <button type="button" class="danger-btn" data-delete-item="${index}">Excluir item</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function getCsvImportDefaultStatus() {
    return "Escolha um arquivo CSV para ver a prévia antes de importar.";
}

function clearCsvImportState() {
    state.csvImport = {
        fileName: "",
        items: [],
        errors: [],
        suggestedMarket: "",
        suggestedMonth: ""
    };

    const fileInput = document.getElementById("csvFileInput");
    if (fileInput instanceof HTMLInputElement) {
        fileInput.value = "";
    }

    renderCsvImportPreview();
}

function updateCsvImportButtons() {
    const confirmButton = document.getElementById("confirmCsvImportBtn");
    const cancelButton = document.getElementById("cancelCsvImportBtn");
    if (!confirmButton || !cancelButton) {
        return;
    }

    const hasPreview = state.csvImport.items.length > 0 || state.csvImport.errors.length > 0;
    confirmButton.disabled = state.csvImport.items.length === 0;
    cancelButton.disabled = !hasPreview;
}

function renderCsvImportPreview() {
    const status = document.getElementById("csvImportStatus");
    const validCount = document.getElementById("csvValidCount");
    const errorCount = document.getElementById("csvErrorCount");
    const estimatedTotal = document.getElementById("csvEstimatedTotal");
    const selectedFileName = document.getElementById("csvSelectedFileName");
    const previewList = document.getElementById("csvPreviewList");
    const errorList = document.getElementById("csvErrorList");
    const suggestedMarket = document.getElementById("csvSuggestedMarket");
    const suggestedMonth = document.getElementById("csvSuggestedMonth");
    const validItems = state.csvImport.items;
    const errors = state.csvImport.errors;
    const importTotal = validItems.reduce((sum, item) => sum + item.finalPrice, 0);

    if (validCount) {
        validCount.textContent = String(validItems.length);
    }
    if (errorCount) {
        errorCount.textContent = String(errors.length);
    }
    if (estimatedTotal) {
        estimatedTotal.textContent = currencyFormatter.format(importTotal);
    }
    if (selectedFileName) {
        selectedFileName.textContent = state.csvImport.fileName || "Nenhum arquivo selecionado";
    }
    if (suggestedMarket) {
        suggestedMarket.textContent = state.csvImport.suggestedMarket || "Usando o mercado da compra";
    }
    if (suggestedMonth) {
        suggestedMonth.textContent = state.csvImport.suggestedMonth || "Usando o mês da compra";
    }

    if (status) {
        if (!state.csvImport.fileName) {
            status.textContent = getCsvImportDefaultStatus();
        } else if (validItems.length) {
            const marketHint = state.csvImport.suggestedMarket
                ? `Mercado sugerido: ${state.csvImport.suggestedMarket}. `
                : "";
            const monthHint = state.csvImport.suggestedMonth
                ? `Mês sugerido: ${state.csvImport.suggestedMonth}. `
                : "";
            status.textContent =
                `${marketHint}${monthHint}${validItems.length} item(ns) prontos para importar em ${state.csvImport.fileName}. ` +
                `${errors.length ? `${errors.length} linha(s) precisam de revisão.` : "Revise a sugestão e confirme quando estiver tudo certo."}`;
        } else {
            status.textContent = `Nenhum item válido foi encontrado em ${state.csvImport.fileName}. Revise o arquivo antes de importar.`;
        }
    }

    if (previewList) {
        if (!validItems.length) {
            previewList.textContent = "A prévia dos itens importados aparecerá aqui.";
        } else {
            previewList.innerHTML = "";
            validItems.forEach((item) => {
                const card = document.createElement("div");
                card.className = "history-card";
                card.innerHTML = `
                    <strong>Linha ${item.lineNumber}: ${escapeHtml(item.name)}</strong>
                    <span>Quantidade: ${escapeHtml(item.quantityLabel)}</span>
                    <span>Preço unitário: ${currencyFormatter.format(item.unitPrice)}</span>
                    <span>Total do item: ${currencyFormatter.format(item.finalPrice)}</span>
                `;
                previewList.appendChild(card);
            });
        }
    }

    if (errorList) {
        if (!errors.length) {
            errorList.textContent = "As linhas com erro aparecerão aqui para você revisar antes de importar.";
        } else {
            errorList.innerHTML = "";
            errors.forEach((entry) => {
                const card = document.createElement("div");
                card.className = "history-card attention-card attention-up";
                card.innerHTML = `
                    <strong>Linha ${entry.lineNumber}</strong>
                    <span>${escapeHtml(entry.reason)}</span>
                    <span>${escapeHtml(entry.preview)}</span>
                `;
                errorList.appendChild(card);
            });
        }
    }

    updateCsvImportButtons();
}

function chooseCsvDelimiter(text) {
    const sampleLines = splitCsvTextIntoLines(text)
        .map((line) => line.trim())
        .filter((line) => line.length)
        .slice(0, 5);
    const candidates = [";", "|", "\t", ","];

    let bestDelimiter = ";";
    let bestScore = -1;

    candidates.forEach((delimiter) => {
        const score = sampleLines.reduce((sum, line) => sum + (line.split(delimiter).length - 1), 0);
        if (score > bestScore) {
            bestDelimiter = delimiter;
            bestScore = score;
        }
    });

    return bestDelimiter;
}

function normalizeCsvText(text) {
    return String(text ?? "")
        .replace(/^\uFEFF/, "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n");
}

function splitCsvTextIntoLines(text) {
    return normalizeCsvText(text).split("\n");
}

function parseCsvRows(text, delimiter) {
    const normalizedText = normalizeCsvText(text);
    const rows = [];
    let currentRow = [];
    let currentValue = "";
    let insideQuotes = false;

    for (let index = 0; index < normalizedText.length; index += 1) {
        const char = normalizedText[index];
        const nextChar = normalizedText[index + 1];

        if (char === "\"") {
            if (insideQuotes && nextChar === "\"") {
                currentValue += "\"";
                index += 1;
            } else {
                insideQuotes = !insideQuotes;
            }
            continue;
        }

        if (!insideQuotes && char === delimiter) {
            currentRow.push(currentValue);
            currentValue = "";
            continue;
        }

        if (!insideQuotes && (char === "\n" || char === "\r")) {
            if (char === "\r" && nextChar === "\n") {
                index += 1;
            }
            currentRow.push(currentValue);
            rows.push(currentRow);
            currentRow = [];
            currentValue = "";
            continue;
        }

        currentValue += char;
    }

    if (currentValue.length || currentRow.length) {
        currentRow.push(currentValue);
        rows.push(currentRow);
    }

    return rows;
}

function detectCsvColumnMap(headerRow) {
    const aliases = {
        product: ["produto", "product", "item", "descricao", "descricao_produto"],
        quantity: ["qtd", "quantidade", "qtde", "peso", "peso_kg"],
        unitPrice: ["preco", "preco_unitario", "preco_por_kg", "valor", "valor_unitario"],
        finalPrice: ["preco_final", "total_item", "valor_total", "subtotal", "precofinal"]
    };

    const normalizedHeader = headerRow.map(normalizeHeaderName);
    const columnMap = {
        product: -1,
        quantity: -1,
        unitPrice: -1,
        finalPrice: -1
    };

    Object.entries(aliases).forEach(([key, options]) => {
        const foundIndex = normalizedHeader.findIndex((value) => options.includes(value));
        columnMap[key] = foundIndex;
    });

    const matchedCount = Object.values(columnMap).filter((index) => index >= 0).length;
    return {
        columnMap,
        isHeader: matchedCount >= 2
    };
}

function isHeaderLikeRow(row) {
    const normalizedCells = row.map((cell) => normalizeHeaderName(cell));
    const joined = normalizedCells.join("|");

    return normalizedCells.some((cell) => [
        "produto",
        "qtd",
        "quantidade",
        "preco",
        "preco_unitario",
        "preco_final",
        "total_item",
        "total_compras"
    ].includes(cell)) || joined.includes("produto|qtd") || joined.includes("produto|quantidade");
}

function isIgnorableCsvTitle(rawProduct, row) {
    const normalizedProduct = normalizeTextForMatching(rawProduct);
    const fullRowText = normalizeTextForMatching(row.join(" "));

    if (!fullRowText) {
        return true;
    }

    if (isHeaderLikeRow(row)) {
        return true;
    }

    if (fullRowText.includes("total compras")) {
        return true;
    }

    if (row.filter((cell) => String(cell ?? "").trim()).length === 1) {
        const looksLikeTitle = /^(compras|mercado|supermercado|atacadao|atacad[oã]o|assai|carrefour|casa)/.test(normalizedProduct);
        if (looksLikeTitle) {
            return true;
        }
    }

    return false;
}

function buildCsvItemPreview(row, rowIndex, columnMap) {
    const getCell = (key, fallbackIndex = -1) => {
        const index = columnMap[key] >= 0 ? columnMap[key] : fallbackIndex;
        return index >= 0 ? String(row[index] ?? "").trim() : "";
    };

    const productName = getCell("product", 0);
    const quantityLabel = getCell("quantity", 1);
    const unitPriceLabel = getCell("unitPrice", 2);
    const finalPriceLabel = getCell("finalPrice", 3);
    const totalPurchaseCell = String(row[4] ?? "").trim();

    if (isIgnorableCsvTitle(productName, row)) {
        return null;
    }

    if (normalizeTextForMatching(totalPurchaseCell).includes("total compras")) {
        return null;
    }

    const quantity = parseLocalizedNumber(quantityLabel);
    const providedUnitPrice = parseLocalizedNumber(unitPriceLabel);
    const providedFinalPrice = parseLocalizedNumber(finalPriceLabel);

    if (!productName.trim()) {
        return {
            error: true,
            lineNumber: rowIndex + 1,
            reason: "Produto vazio. Preencha o nome do produto na planilha.",
            preview: row.join(" | ")
        };
    }

    if (quantity <= 0) {
        return {
            error: true,
            lineNumber: rowIndex + 1,
            reason: "Quantidade inválida. Use um valor maior que zero.",
            preview: row.join(" | ")
        };
    }

    let unitPrice = providedUnitPrice;
    let finalPrice = providedFinalPrice;

    if (finalPrice > 0) {
        unitPrice = quantity > 0 ? finalPrice / quantity : unitPrice;
    } else {
        finalPrice = quantity * unitPrice;
    }

    if (unitPrice < 0) {
        return {
            error: true,
            lineNumber: rowIndex + 1,
            reason: "Preço unitário inválido. Use zero ou um valor positivo.",
            preview: row.join(" | ")
        };
    }

    finalPrice = Math.round(finalPrice * 100) / 100;

    return {
        error: false,
        lineNumber: rowIndex + 1,
        name: productName.trim(),
        itemType: "unit",
        quantity,
        quantityLabel: quantityLabel || formatNumberInput(quantity),
        unitPrice,
        unitPriceLabel: unitPriceLabel || formatNumberInput(unitPrice),
        finalPrice
    };
}

function parseCsvImport(text, fileName) {
    const fileMetadata = parseCsvFilenameMetadata(fileName);
    const delimiter = chooseCsvDelimiter(text);
    const rows = parseCsvRows(text, delimiter);
    const firstDataRow = rows.find((row) => row.some((cell) => String(cell ?? "").trim()));

    if (!firstDataRow) {
        state.csvImport = {
            fileName,
            items: [],
            errors: [],
            suggestedMarket: fileMetadata.suggestedMarket,
            suggestedMonth: fileMetadata.suggestedMonth
        };
        renderCsvImportPreview();
        return;
    }

    const headerDetection = detectCsvColumnMap(firstDataRow);
    const dataRows = headerDetection.isHeader ? rows.slice(rows.indexOf(firstDataRow) + 1) : rows;
    const columnMap = headerDetection.isHeader
        ? headerDetection.columnMap
        : { product: 0, quantity: 1, unitPrice: 2, finalPrice: 3 };
    const items = [];
    const errors = [];

    dataRows.forEach((row, rowIndex) => {
        const hasContent = row.some((cell) => String(cell ?? "").trim());
        if (!hasContent) {
            return;
        }

        const result = buildCsvItemPreview(
            row,
            headerDetection.isHeader ? rows.indexOf(firstDataRow) + 1 + rowIndex : rowIndex,
            columnMap
        );

        if (!result) {
            return;
        }

        if (result.error) {
            errors.push(result);
            return;
        }

        items.push(result);
    });

    state.csvImport = {
        fileName,
        items,
        errors,
        suggestedMarket: fileMetadata.suggestedMarket,
        suggestedMonth: fileMetadata.suggestedMonth
    };
    applyCsvImportSuggestions();
    renderCsvImportPreview();
}

function applyCsvImportSuggestions() {
    const { suggestedMarket, suggestedMonth } = state.csvImport;
    const marketSelect = getMarketSelect();
    const monthInput = document.getElementById("monthInput");

    if (suggestedMonth && monthInput instanceof HTMLInputElement) {
        monthInput.value = suggestedMonth;
        updateCurrentPurchaseHeader();
    }

    if (suggestedMarket && marketSelect) {
        const existingMarket = state.markets.find((market) =>
            normalizeTextForMatching(market) === normalizeTextForMatching(suggestedMarket)
        );

        if (existingMarket) {
            marketSelect.value = existingMarket;
            persistSelectedMarket(existingMarket);
            renderCurrentPurchaseList();
        }
    }
}

function readCsvFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(normalizeCsvText(reader.result ?? ""));
        reader.onerror = () => reject(new Error("Não foi possível ler o arquivo CSV."));
        reader.readAsText(file, "utf-8");
    });
}

async function handleCsvFileSelection(file) {
    if (!file) {
        clearCsvImportState();
        return;
    }

    try {
        const content = await readCsvFile(file);
        parseCsvImport(content, file.name || "arquivo.csv");
    } catch (error) {
        clearCsvImportState();
        showActionFeedback(error.message || "Não foi possível ler o arquivo CSV.", "error");
    }
}

function buildImportMergedPayload(existingPurchase, importedItems, market, month) {
    const existingItems = (existingPurchase?.items || []).map((item) => ({
        name: item.name,
        itemType: item.itemType === "weight" ? "weight" : "unit",
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0)
    }));

    const newItems = importedItems.map((item) => ({
        name: item.name,
        itemType: "unit",
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice)
    }));

    return {
        month,
        market,
        items: [...existingItems, ...newItems]
    };
}

function importCsvPurchase() {
    const month = document.getElementById("monthInput").value;
    const selectedMarket = getMarketSelect().value;
    const market = selectedMarket || state.csvImport.suggestedMarket;
    const importedCount = state.csvImport.items.length;

    if (!month) {
        showActionFeedback("Escolha o mês de referência antes de importar o CSV.", "error");
        return;
    }

    if (!market) {
        showActionFeedback("Escolha um mercado antes de importar o CSV.", "error");
        return;
    }

    if (!state.csvImport.items.length) {
        showActionFeedback("Selecione um CSV com pelo menos uma linha válida antes de confirmar.", "error");
        return;
    }

    if (state.csvImport.suggestedMarket && !market) {
        showActionFeedback("Revise o mercado sugerido antes de confirmar a importação.", "error");
        return;
    }

    if (!window.AndroidBridge || !window.AndroidBridge.savePurchase || !window.AndroidBridge.updatePurchase) {
        showActionFeedback("A importação CSV completa funciona no app Android.", "error");
        return;
    }

    const marketExists = state.markets.some((entry) =>
        normalizeTextForMatching(entry) === normalizeTextForMatching(market)
    );
    if (market && !marketExists) {
        const shouldCreate = window.confirm(
            `O mercado "${market}" ainda não está cadastrado. Deseja cadastrar automaticamente e continuar a importação?`
        );
        if (!shouldCreate) {
            showActionFeedback("Escolha um mercado existente ou confirme o cadastro automático antes de importar.", "error");
            return;
        }
    }

    const rawHistory = window.AndroidBridge.getFilteredMonthlyHistory
        ? window.AndroidBridge.getFilteredMonthlyHistory(month, market, "")
        : "[]";
    const historyEntries = JSON.parse(rawHistory);
    const existingEntry = historyEntries.find((entry) => entry.month === month && entry.market === market) || null;
    const existingPurchase = existingEntry
        ? JSON.parse(window.AndroidBridge.getPurchaseDetails(String(existingEntry.purchaseId)))
        : null;
    const payload = buildImportMergedPayload(existingPurchase, state.csvImport.items, market, month);

    persistSelectedMarket(market);

    const rawResponse = existingEntry
        ? window.AndroidBridge.updatePurchase(String(existingEntry.purchaseId), JSON.stringify(payload))
        : window.AndroidBridge.savePurchase(JSON.stringify(payload));
    const response = JSON.parse(rawResponse);
    const purchaseId = response.purchaseId || existingEntry?.purchaseId;

    if (!marketExists && market && !state.markets.includes(market)) {
        state.markets.push(market);
        state.markets.sort((left, right) => left.localeCompare(right, "pt-BR"));
        renderMarkets();
        getMarketSelect().value = market;
    }

    clearCsvImportState();
    loadHistory();
    loadComparison(month);

    if (purchaseId) {
        loadPurchaseForEdit(Number(purchaseId));
    }

    showActionFeedback(
        response.message ||
        `Importação concluída com ${importedCount} item(ns).`,
        "success"
    );
    document.getElementById("summaryContainer").textContent =
        "Importação concluída. Revise os itens desta compra e salve novamente só se quiser fazer mais ajustes.";
}

function showSummary(data) {
    const summaryElement = document.getElementById("summaryContainer");
    const hints = data.comparisonHints || [];
    const hintLines = hints.length
        ? hints.map((hint) =>
            `Produto: ${hint.product}\nMenor preço encontrado: ${currencyFormatter.format(hint.lowestPriceSeen)}\nMaior preço encontrado: ${currencyFormatter.format(hint.highestPriceSeen)}`
        ).join("\n\n")
        : "Ainda não há dados suficientes para comparar esse produto.";

    summaryElement.textContent =
        `Mercado escolhido: ${data.market}\n` +
        `Mês da compra: ${data.month}\n` +
        `Itens lançados: ${data.summary.itemCount}\n` +
        `Total da compra: ${currencyFormatter.format(data.totalPurchase)}\n\n` +
        `Leitura rápida dos preços:\n${hintLines}`;
}

function calculateSummary() {
    const payload = getPurchasePayload();
    const validItems = payload.items.filter((item) => item.name?.trim());

    if (!payload.month) {
        showActionFeedback("Escolha o mês da compra antes de continuar.", "error");
        return;
    }

    if (!payload.market) {
        showActionFeedback("Escolha um mercado para continuar.", "error");
        return;
    }

    if (!validItems.length) {
        showActionFeedback("Adicione pelo menos um produto com nome preenchido.", "error");
        return;
    }

    hideActionFeedback();

    if (window.AndroidBridge && window.AndroidBridge.processMonthlyPurchase) {
        const rawResponse = window.AndroidBridge.processMonthlyPurchase(JSON.stringify(payload));
        const parsedResponse = JSON.parse(rawResponse);
        showSummary(parsedResponse);
        showActionFeedback("Totais conferidos. Se estiver tudo certo, salve a compra.", "success");
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
    showActionFeedback("Totais conferidos. Se estiver tudo certo, salve a compra.", "success");
}

function savePurchase() {
    const payload = getPurchasePayload();
    const validItems = payload.items.filter((item) => item.name?.trim());

    if (!payload.month) {
        showActionFeedback("Escolha o mês da compra antes de salvar.", "error");
        return;
    }

    if (!payload.market) {
        showActionFeedback("Escolha um mercado antes de salvar.", "error");
        return;
    }

    if (!validItems.length) {
        showActionFeedback("Inclua pelo menos um produto antes de salvar.", "error");
        return;
    }

    if (!window.AndroidBridge || !window.AndroidBridge.savePurchase) {
        showActionFeedback("O salvamento local funciona no app Android.", "error");
        return;
    }

    persistSelectedMarket(payload.market);

    const rawResponse = state.editingPurchaseId
        ? window.AndroidBridge.updatePurchase(String(state.editingPurchaseId), JSON.stringify(payload))
        : window.AndroidBridge.savePurchase(JSON.stringify(payload));
    const parsedResponse = JSON.parse(rawResponse);
    clearForm();
    showActionFeedback(parsedResponse.message || "Compra salva com sucesso.", "success");
    loadHistory();
    loadComparison(payload.month);
    document.getElementById("summaryContainer").textContent = "Compra salva. Você pode lançar outra compra ou consultar o histórico.";
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

function showMarketFeedback(message) {
    const feedback = document.getElementById("marketFeedback");
    if (!feedback) {
        return;
    }

    feedback.textContent = message;
    feedback.classList.remove("hidden");
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
        historyContainer.textContent = "O histórico completo aparece quando o app roda no Android.";
        return;
    }

    const rawHistory = window.AndroidBridge.getFilteredMonthlyHistory
        ? window.AndroidBridge.getFilteredMonthlyHistory(filters.month, filters.market, filters.product)
        : window.AndroidBridge.getMonthlyHistory();
    const entries = JSON.parse(rawHistory);

    if (!entries.length) {
        historyContainer.textContent = "Nenhuma compra encontrada com esses filtros.";
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
        itemType: item.itemType === "weight" ? "weight" : "unit",
        quantity: String(item.quantity ?? ""),
        unitPrice: String(item.unitPrice ?? "")
    }));

    document.getElementById("monthInput").value = purchase.month;
    getMarketSelect().value = purchase.market;
    persistSelectedMarket(purchase.market);
    document.getElementById("editBanner").classList.remove("hidden");
    renderItems();
    calculateSummary();
    showActionFeedback("Compra carregada para edição. Faça as mudanças e salve novamente.", "success");
    setActiveTab("purchase");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function deletePurchase(purchaseId) {
    if (!window.AndroidBridge || !window.AndroidBridge.deletePurchase) {
        return;
    }

    const marketName = document.querySelector(`[data-delete="${purchaseId}"]`)?.closest(".history-card")?.querySelector("strong")?.textContent || "esta compra";
    const confirmed = window.confirm(`Deseja excluir ${marketName}? Essa ação não pode ser desfeita.`);
    if (!confirmed) {
        return;
    }

    const rawResponse = window.AndroidBridge.deletePurchase(String(purchaseId));
    const response = JSON.parse(rawResponse);

    if (state.editingPurchaseId === purchaseId) {
        clearForm();
    }

    showActionFeedback(response.message || "Compra excluída com sucesso.", "success");
    loadHistory();
    loadComparison();
}

function clearForm() {
    const selectedMarket = getMarketSelect().value || getPersistedMarket();
    state.editingPurchaseId = null;
    state.items = [];
    document.getElementById("monthInput").value = getCurrentMonthValue();
    document.getElementById("editBanner").classList.add("hidden");
    document.getElementById("summaryContainer").textContent = "Preencha a compra e toque em \"Conferir totais\" para ver o resumo.";
    hideActionFeedback();
    clearCsvImportState();
    addItem({ name: "", itemType: "unit", quantity: "1", unitPrice: "" });
    applySelectedMarket(selectedMarket);
    renderCurrentPurchaseList();
}

function renderMarketComparison(data) {
    const summaryContainer = document.getElementById("comparisonSummary");
    const marketContainer = document.getElementById("marketComparisonContainer");
    const chartContainer = document.getElementById("marketComparisonChart");

    if (!data.markets || !data.markets.length) {
        summaryContainer.textContent = `Ainda não há compras salvas para ${data.month}.`;
        marketContainer.textContent = "Salve compras nesse mês para comparar os mercados.";
        chartContainer.textContent = "O gráfico aparece quando houver dados suficientes.";
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
        container.textContent = "Ainda não há produtos suficientes para comparar neste mês.";
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
                <span class="ranking-score">Pontuação ${entry.score.toFixed(2)}</span>
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
        container.textContent = "O gráfico aparece quando houver dados suficientes.";
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
        container.textContent = "O gráfico aparece quando houver dados suficientes.";
        if (legendContainer) {
            legendContainer.textContent = "Sem dados suficientes por enquanto.";
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
            "A comparação completa aparece quando o app roda no Android.";
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

function exportMonthlyCsv() {
    const month = document.getElementById("exportMonthInput")?.value || "";
    const status = document.getElementById("exportStatus");

    if (!month) {
        status.textContent = "Escolha um mês para exportar.";
        return;
    }

    if (!window.AndroidBridge || !window.AndroidBridge.exportMonthlyCsv) {
        status.textContent = "A exportação CSV funciona no app Android.";
        return;
    }

    const response = JSON.parse(window.AndroidBridge.exportMonthlyCsv(month));
    status.textContent = response.message || "Exportação concluída.";
}

function exportAllCsv() {
    const status = document.getElementById("exportStatus");

    if (!window.AndroidBridge || !window.AndroidBridge.exportAllCsv) {
        status.textContent = "A exportação CSV funciona no app Android.";
        return;
    }

    const response = JSON.parse(window.AndroidBridge.exportAllCsv());
    status.textContent = response.message || "Exportação concluída.";
}

function registerEvents() {
    document.getElementById("itemsContainer").addEventListener("input", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement) || !target.dataset.index || !target.dataset.field) {
            return;
        }

        updateItem(Number(target.dataset.index), target.dataset.field, target.value);
    });

    document.getElementById("itemsContainer").addEventListener("change", (event) => {
        const target = event.target;
        if (!target || !target.dataset || !target.dataset.index || !target.dataset.field) {
            return;
        }

        if (target instanceof HTMLSelectElement) {
            updateItem(Number(target.dataset.index), target.dataset.field, target.value);
        }
    });

    document.getElementById("itemsContainer").addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        const removeButton = target.closest("[data-remove]");
        if (!removeButton) {
            return;
        }

        removeItem(Number(removeButton.dataset.remove));
    });

    document.getElementById("currentPurchaseList").addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        const editButton = target.closest("[data-edit-item]");
        if (editButton) {
            focusItemEditor(Number(editButton.dataset.editItem));
            return;
        }

        const deleteButton = target.closest("[data-delete-item]");
        if (deleteButton) {
            removeItem(Number(deleteButton.dataset.deleteItem));
        }
    });

    getMarketSelect().addEventListener("change", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLSelectElement)) {
            return;
        }

        persistSelectedMarket(target.value);
        renderCurrentPurchaseList();
    });

    document.getElementById("monthInput").addEventListener("change", updateCurrentPurchaseHeader);

    document.getElementById("addMarketBtn").addEventListener("click", () => {
        const input = document.getElementById("newMarketInput");
        const marketName = input.value.trim();
        if (!marketName) {
            showMarketFeedback("Digite o nome do mercado antes de salvar.");
            return;
        }

        if (window.AndroidBridge && window.AndroidBridge.addMarket) {
            const rawResponse = window.AndroidBridge.addMarket(marketName);
            const response = JSON.parse(rawResponse);
            if (!state.markets.includes(response.name)) {
                state.markets.push(response.name);
                state.markets.sort((a, b) => a.localeCompare(b, "pt-BR"));
            }
            showMarketFeedback(response.message || "Mercado salvo com sucesso.");
        } else if (!state.markets.includes(marketName)) {
            state.markets.push(marketName);
            showMarketFeedback("Mercado salvo na lista local.");
        }

        renderMarkets();
        getMarketSelect().value = marketName;
        persistSelectedMarket(marketName);
        renderCurrentPurchaseList();
        input.value = "";
    });

    document.getElementById("addItemBtn").addEventListener("click", () => addItem());
    document.getElementById("calculateBtn").addEventListener("click", calculateSummary);
    document.getElementById("selectCsvBtn").addEventListener("click", (event) => {
        event.preventDefault();
        const fileInput = document.getElementById("csvFileInput");
        if (fileInput instanceof HTMLInputElement) {
            fileInput.click();
        }
    });
    document.getElementById("csvFileInput").addEventListener("change", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) {
            return;
        }
        handleCsvFileSelection(target.files?.[0] || null);
    });
    document.getElementById("confirmCsvImportBtn").addEventListener("click", importCsvPurchase);
    document.getElementById("cancelCsvImportBtn").addEventListener("click", () => {
        clearCsvImportState();
        showActionFeedback("Prévia da importação cancelada. Você pode escolher outro arquivo quando quiser.", "success");
    });
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
    document.getElementById("exportMonthCsvBtn").addEventListener("click", exportMonthlyCsv);
    document.getElementById("exportAllCsvBtn").addEventListener("click", exportAllCsv);
    document.getElementById("savePurchaseBtn").addEventListener("click", savePurchase);
    document.getElementById("themeToggleBtn").addEventListener("click", toggleTheme);
    document.querySelectorAll("[data-tab]").forEach((button) => {
        button.addEventListener("click", () => setActiveTab(button.dataset.tab));
    });
    document.querySelectorAll("[data-tab-jump]").forEach((button) => {
        button.addEventListener("click", () => setActiveTab(button.dataset.tabJump));
    });
}

function init() {
    const currentMonth = getCurrentMonthValue();
    applyTheme(getStoredTheme());
    document.getElementById("monthInput").value = currentMonth;
    document.getElementById("comparisonMonthInput").value = currentMonth;
    document.getElementById("exportMonthInput").value = currentMonth;
    document.getElementById("currentMonthBadge").textContent = `Mês atual: ${currentMonth}`;
    document.getElementById("heroCurrentMonth").textContent = currentMonth;

    loadMarkets();
    addItem({ name: "Arroz 5kg", itemType: "unit", quantity: "1", unitPrice: "28,90" });
    registerEvents();
    clearCsvImportState();
    loadHistory();
    loadComparison(currentMonth);
    renderCurrentPurchaseList();
    setActiveTab("home");
}

init();
