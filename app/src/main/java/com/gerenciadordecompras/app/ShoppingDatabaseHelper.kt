package com.gerenciadordecompras.app

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.text.Normalizer
import org.json.JSONArray
import org.json.JSONObject

class ShoppingDatabaseHelper(context: Context) :
    SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE markets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                address TEXT,
                notes TEXT,
                created_at INTEGER DEFAULT (strftime('%s','now'))
            )
            """.trimIndent()
        )

        db.execSQL(
            """
            CREATE TABLE purchases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                market_id INTEGER NOT NULL,
                reference_month TEXT NOT NULL,
                total_amount REAL NOT NULL,
                created_at INTEGER DEFAULT (strftime('%s','now')),
                FOREIGN KEY (market_id) REFERENCES markets(id)
            )
            """.trimIndent()
        )

        db.execSQL(
            """
            CREATE TABLE purchase_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                purchase_id INTEGER NOT NULL,
                product_name TEXT NOT NULL,
                normalized_name TEXT NOT NULL,
                quantity REAL NOT NULL,
                unit_price REAL NOT NULL,
                final_price REAL NOT NULL,
                FOREIGN KEY (purchase_id) REFERENCES purchases(id)
            )
            """.trimIndent()
        )

        seedMarkets(db)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 2) {
            db.execSQL(
                "ALTER TABLE purchase_items ADD COLUMN normalized_name TEXT NOT NULL DEFAULT ''"
            )
            backfillNormalizedNames(db)
        }
    }

    fun insertMarket(name: String, address: String? = null, notes: String? = null): JSONObject {
        val cleanName = name.trim()
        val existingId = findMarketIdByName(cleanName)
        if (existingId != null) {
            return JSONObject()
                .put("success", true)
                .put("id", existingId)
                .put("name", cleanName)
                .put("message", "Mercado já cadastrado.")
        }

        val values = ContentValues().apply {
            put("name", cleanName)
            put("address", address)
            put("notes", notes)
        }

        val id = writableDatabase.insertOrThrow("markets", null, values)
        return JSONObject()
            .put("success", true)
            .put("id", id)
            .put("name", cleanName)
            .put("message", "Mercado cadastrado com sucesso.")
    }

    fun listMarkets(): JSONArray {
        val result = JSONArray()
        readableDatabase.query(
            "markets",
            arrayOf("id", "name", "address", "notes"),
            null,
            null,
            null,
            null,
            "name COLLATE NOCASE ASC"
        ).use { cursor ->
            while (cursor.moveToNext()) {
                result.put(
                    JSONObject()
                        .put("id", cursor.getLong(0))
                        .put("name", cursor.getString(1))
                        .put("address", cursor.getString(2) ?: "")
                        .put("notes", cursor.getString(3) ?: "")
                )
            }
        }
        return result
    }

    fun savePurchase(payload: JSONObject, calculated: JSONObject): JSONObject {
        val marketName = payload.optString("market").trim()
        val referenceMonth = payload.optString("month").trim()
        val items = calculated.optJSONArray("items") ?: JSONArray()
        val totalPurchase = calculated.optDouble("totalPurchase", 0.0)

        val marketId = findMarketIdByName(marketName)
            ?: insertMarket(marketName).optLong("id")

        val purchaseValues = ContentValues().apply {
            put("market_id", marketId)
            put("reference_month", referenceMonth)
            put("total_amount", totalPurchase)
        }

        val db = writableDatabase
        db.beginTransaction()
        return try {
            val purchaseId = db.insertOrThrow("purchases", null, purchaseValues)

            for (index in 0 until items.length()) {
                val item = items.getJSONObject(index)
                val productName = item.optString("name")
                val itemValues = ContentValues().apply {
                    put("purchase_id", purchaseId)
                    put("product_name", productName)
                    put("normalized_name", normalizeProductName(productName))
                    put("quantity", item.optDouble("quantity", 0.0))
                    put("unit_price", item.optDouble("unitPrice", 0.0))
                    put("final_price", item.optDouble("finalPrice", 0.0))
                }
                db.insertOrThrow("purchase_items", null, itemValues)
            }

            db.setTransactionSuccessful()
            JSONObject()
                .put("success", true)
                .put("purchaseId", purchaseId)
                .put("totalAmount", totalPurchase)
                .put("message", "Compra salva no banco local.")
        } finally {
            db.endTransaction()
        }
    }

    fun getPurchaseDetails(purchaseId: Long): JSONObject {
        val purchase = JSONObject()
        readableDatabase.rawQuery(
            """
            SELECT p.id, p.reference_month, p.total_amount, m.name
            FROM purchases p
            INNER JOIN markets m ON m.id = p.market_id
            WHERE p.id = ?
            """.trimIndent(),
            arrayOf(purchaseId.toString())
        ).use { cursor ->
            if (cursor.moveToFirst()) {
                purchase.put("purchaseId", cursor.getLong(0))
                purchase.put("month", cursor.getString(1))
                purchase.put("totalAmount", cursor.getDouble(2))
                purchase.put("market", cursor.getString(3))
            }
        }

        val items = JSONArray()
        readableDatabase.rawQuery(
            """
            SELECT id, product_name, quantity, unit_price, final_price
            FROM purchase_items
            WHERE purchase_id = ?
            ORDER BY id ASC
            """.trimIndent(),
            arrayOf(purchaseId.toString())
        ).use { cursor ->
            while (cursor.moveToNext()) {
                items.put(
                    JSONObject()
                        .put("itemId", cursor.getLong(0))
                        .put("name", cursor.getString(1))
                        .put("quantity", cursor.getDouble(2))
                        .put("unitPrice", cursor.getDouble(3))
                        .put("finalPrice", cursor.getDouble(4))
                )
            }
        }

        return purchase.put("items", items)
    }

    fun updatePurchase(purchaseId: Long, payload: JSONObject, calculated: JSONObject): JSONObject {
        val marketName = payload.optString("market").trim()
        val referenceMonth = payload.optString("month").trim()
        val items = calculated.optJSONArray("items") ?: JSONArray()
        val totalPurchase = calculated.optDouble("totalPurchase", 0.0)
        val marketId = findMarketIdByName(marketName)
            ?: insertMarket(marketName).optLong("id")

        val db = writableDatabase
        db.beginTransaction()
        return try {
            val purchaseValues = ContentValues().apply {
                put("market_id", marketId)
                put("reference_month", referenceMonth)
                put("total_amount", totalPurchase)
            }
            db.update("purchases", purchaseValues, "id = ?", arrayOf(purchaseId.toString()))
            db.delete("purchase_items", "purchase_id = ?", arrayOf(purchaseId.toString()))

            for (index in 0 until items.length()) {
                val item = items.getJSONObject(index)
                val productName = item.optString("name")
                val itemValues = ContentValues().apply {
                    put("purchase_id", purchaseId)
                    put("product_name", productName)
                    put("normalized_name", normalizeProductName(productName))
                    put("quantity", item.optDouble("quantity", 0.0))
                    put("unit_price", item.optDouble("unitPrice", 0.0))
                    put("final_price", item.optDouble("finalPrice", 0.0))
                }
                db.insertOrThrow("purchase_items", null, itemValues)
            }

            db.setTransactionSuccessful()
            JSONObject()
                .put("success", true)
                .put("purchaseId", purchaseId)
                .put("message", "Compra atualizada com sucesso.")
        } finally {
            db.endTransaction()
        }
    }

    fun deletePurchase(purchaseId: Long): JSONObject {
        val db = writableDatabase
        db.beginTransaction()
        return try {
            db.delete("purchase_items", "purchase_id = ?", arrayOf(purchaseId.toString()))
            db.delete("purchases", "id = ?", arrayOf(purchaseId.toString()))
            db.setTransactionSuccessful()
            JSONObject()
                .put("success", true)
                .put("purchaseId", purchaseId)
                .put("message", "Compra excluída com sucesso.")
        } finally {
            db.endTransaction()
        }
    }

    fun listMonthlyHistory(): JSONArray {
        return listMonthlyHistoryFiltered(null, null, null)
    }

    fun listMonthlyHistoryFiltered(
        month: String?,
        market: String?,
        product: String?
    ): JSONArray {
        val result = JSONArray()
        val sql = StringBuilder(
            """
            SELECT
                p.id,
                p.reference_month,
                m.name,
                p.total_amount,
                COUNT(pi.id) AS item_count
            FROM purchases p
            INNER JOIN markets m ON m.id = p.market_id
            LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
            """.trimIndent(),
        )
        val args = mutableListOf<String>()
        val filters = mutableListOf<String>()

        if (!month.isNullOrBlank()) {
            filters += "p.reference_month = ?"
            args += month
        }

        if (!market.isNullOrBlank()) {
            filters += "m.name = ?"
            args += market
        }

        if (!product.isNullOrBlank()) {
            filters += """
                EXISTS (
                    SELECT 1
                    FROM purchase_items pi_filter
                    WHERE pi_filter.purchase_id = p.id
                      AND pi_filter.normalized_name LIKE ?
                )
            """.trimIndent()
            args += "%${normalizeProductName(product)}%"
        }

        if (filters.isNotEmpty()) {
            sql.append("\nWHERE ").append(filters.joinToString(" AND "))
        }

        sql.append(
            """

            GROUP BY p.id, p.reference_month, m.name, p.total_amount
            ORDER BY p.reference_month DESC, p.id DESC
            """.trimIndent()
        )

        readableDatabase.rawQuery(sql.toString(), args.toTypedArray()).use { cursor ->
            while (cursor.moveToNext()) {
                result.put(
                    JSONObject()
                        .put("purchaseId", cursor.getLong(0))
                        .put("month", cursor.getString(1))
                        .put("market", cursor.getString(2))
                        .put("totalAmount", cursor.getDouble(3))
                        .put("itemCount", cursor.getInt(4))
                )
            }
        }
        return result
    }

    fun monthlyComparison(month: String): JSONObject {
        val byMarket = JSONArray()
        readableDatabase.rawQuery(
            """
            SELECT m.name, SUM(p.total_amount) AS month_total, COUNT(p.id) AS purchase_count
            FROM purchases p
            INNER JOIN markets m ON m.id = p.market_id
            WHERE p.reference_month = ?
            GROUP BY m.name
            ORDER BY month_total ASC
            """.trimIndent(),
            arrayOf(month)
        ).use { cursor ->
            while (cursor.moveToNext()) {
                byMarket.put(
                    JSONObject()
                        .put("market", cursor.getString(0))
                        .put("monthTotal", cursor.getDouble(1))
                        .put("purchaseCount", cursor.getInt(2))
                )
            }
        }

        val bestMarket = if (byMarket.length() > 0) byMarket.getJSONObject(0) else null

        return JSONObject()
            .put("month", month)
            .put("bestMarket", bestMarket)
            .put("markets", byMarket)
    }

    fun productComparison(month: String): JSONArray {
        val result = JSONArray()
        readableDatabase.rawQuery(
            """
            SELECT
                pi.normalized_name AS normalized_name,
                pi.product_name AS display_name,
                m.name AS market_name,
                AVG(pi.unit_price) AS average_unit_price,
                MIN(pi.unit_price) AS lowest_unit_price,
                MAX(pi.unit_price) AS highest_unit_price,
                COUNT(pi.id) AS records_count
            FROM purchase_items pi
            INNER JOIN purchases p ON p.id = pi.purchase_id
            INNER JOIN markets m ON m.id = p.market_id
            WHERE p.reference_month = ?
              AND pi.normalized_name <> ''
            GROUP BY normalized_name, market_name
            ORDER BY normalized_name ASC, average_unit_price ASC
            """.trimIndent(),
            arrayOf(month)
        ).use { cursor ->
            val grouped = linkedMapOf<String, JSONObject>()

            while (cursor.moveToNext()) {
                val normalizedName = cursor.getString(0)
                val displayName = cursor.getString(1)
                val marketName = cursor.getString(2)
                val averagePrice = cursor.getDouble(3)
                val lowestPrice = cursor.getDouble(4)
                val highestPrice = cursor.getDouble(5)
                val recordsCount = cursor.getInt(6)

                val productEntry = grouped.getOrPut(normalizedName) {
                    JSONObject()
                        .put("product", displayName)
                        .put("markets", JSONArray())
                }

                productEntry.getJSONArray("markets").put(
                    JSONObject()
                        .put("market", marketName)
                        .put("averageUnitPrice", averagePrice)
                        .put("lowestUnitPrice", lowestPrice)
                        .put("highestUnitPrice", highestPrice)
                        .put("recordsCount", recordsCount)
                )
            }

            grouped.values.forEach { productEntry ->
                val markets = productEntry.getJSONArray("markets")
                if (markets.length() > 0) {
                    productEntry.put("bestMarket", markets.getJSONObject(0))
                }
                result.put(productEntry)
            }
        }

        return result
    }

    fun compareWithPreviousMonth(month: String): JSONObject {
        val previousMonth = getPreviousMonth(month)
        val currentTotal = getMonthTotal(month)
        val previousTotal = getMonthTotal(previousMonth)
        val totalDifference = currentTotal - previousTotal
        val totalDifferencePercent = calculatePercentChange(previousTotal, currentTotal)

        val marketChanges = JSONArray()
        readableDatabase.rawQuery(
            """
            SELECT
                market_name,
                current_total,
                previous_total
            FROM (
                SELECT
                    m.name AS market_name,
                    SUM(CASE WHEN p.reference_month = ? THEN p.total_amount ELSE 0 END) AS current_total,
                    SUM(CASE WHEN p.reference_month = ? THEN p.total_amount ELSE 0 END) AS previous_total
                FROM markets m
                LEFT JOIN purchases p ON p.market_id = m.id
                    AND p.reference_month IN (?, ?)
                GROUP BY m.name
            )
            WHERE current_total > 0 OR previous_total > 0
            ORDER BY (current_total - previous_total) DESC
            """.trimIndent(),
            arrayOf(month, previousMonth, month, previousMonth)
        ).use { cursor ->
            while (cursor.moveToNext()) {
                val marketName = cursor.getString(0)
                val currentMarketTotal = cursor.getDouble(1)
                val previousMarketTotal = cursor.getDouble(2)
                marketChanges.put(
                    JSONObject()
                        .put("market", marketName)
                        .put("currentTotal", currentMarketTotal)
                        .put("previousTotal", previousMarketTotal)
                        .put("difference", currentMarketTotal - previousMarketTotal)
                        .put(
                            "differencePercent",
                            calculatePercentChange(previousMarketTotal, currentMarketTotal)
                        )
                )
            }
        }

        val productChanges = JSONArray()
        readableDatabase.rawQuery(
            """
            SELECT
                normalized_name,
                display_name,
                current_avg,
                previous_avg
            FROM (
                SELECT
                    pi.normalized_name AS normalized_name,
                    MIN(TRIM(pi.product_name)) AS display_name,
                    AVG(CASE WHEN p.reference_month = ? THEN pi.unit_price END) AS current_avg,
                    AVG(CASE WHEN p.reference_month = ? THEN pi.unit_price END) AS previous_avg
                FROM purchase_items pi
                INNER JOIN purchases p ON p.id = pi.purchase_id
                WHERE p.reference_month IN (?, ?)
                  AND pi.normalized_name <> ''
                GROUP BY pi.normalized_name
            )
            WHERE current_avg IS NOT NULL OR previous_avg IS NOT NULL
            ORDER BY (COALESCE(current_avg, 0) - COALESCE(previous_avg, 0)) DESC, display_name ASC
            """.trimIndent(),
            arrayOf(month, previousMonth, month, previousMonth)
        ).use { cursor ->
            while (cursor.moveToNext()) {
                val productName = cursor.getString(1)
                val currentAverage = if (cursor.isNull(2)) 0.0 else cursor.getDouble(2)
                val previousAverage = if (cursor.isNull(3)) 0.0 else cursor.getDouble(3)
                val difference = currentAverage - previousAverage
                val absoluteDifference = kotlin.math.abs(difference)
                productChanges.put(
                    JSONObject()
                        .put("product", productName)
                        .put("currentAverage", currentAverage)
                        .put("previousAverage", previousAverage)
                        .put("difference", difference)
                        .put("absoluteDifference", absoluteDifference)
                        .put(
                            "differencePercent",
                            calculatePercentChange(previousAverage, currentAverage)
                        )
                        .put(
                            "trend",
                            when {
                                difference > 0 -> "aumentou"
                                difference < 0 -> "diminuiu"
                                else -> "estável"
                            }
                        )
                )
            }
        }

        val highestIncrease = findFirstByTrend(productChanges, "aumentou")
        val biggestDrop = findFirstByTrend(productChanges, "diminuiu")

        return JSONObject()
            .put("currentMonth", month)
            .put("previousMonth", previousMonth)
            .put("currentTotal", currentTotal)
            .put("previousTotal", previousTotal)
            .put("difference", totalDifference)
            .put("differencePercent", totalDifferencePercent)
            .put("marketChanges", marketChanges)
            .put("productChanges", productChanges)
            .put("highestIncrease", highestIncrease)
            .put("biggestDrop", biggestDrop)
    }

    fun getDashboardOverview(referenceMonth: String): JSONObject {
        val previousMonth = getPreviousMonth(referenceMonth)
        val currentTotal = getMonthTotal(referenceMonth)
        val previousTotal = getMonthTotal(previousMonth)
        val monthlyComparison = monthlyComparison(referenceMonth)
        val productChanges = compareWithPreviousMonth(referenceMonth)
        val bestMarket = monthlyComparison.optJSONObject("bestMarket")
        val priceAlerts = buildPriceAlerts(productChanges.optJSONArray("productChanges") ?: JSONArray())

        return JSONObject()
            .put("currentMonth", referenceMonth)
            .put("previousMonth", previousMonth)
            .put("currentTotal", currentTotal)
            .put("previousTotal", previousTotal)
            .put("differencePercent", calculatePercentChange(previousTotal, currentTotal))
            .put("bestMarket", bestMarket)
            .put("highestIncrease", productChanges.optJSONObject("highestIncrease"))
            .put("biggestDrop", productChanges.optJSONObject("biggestDrop"))
            .put("monthlySpendingTrend", getMonthlySpendingTrend())
            .put("marketBars", monthlyComparison.optJSONArray("markets") ?: JSONArray())
            .put("marketHistoricalRanking", getMarketHistoricalRanking())
            .put("priceAlerts", priceAlerts)
    }

    fun getMonthlySpendingTrend(): JSONArray {
        val result = JSONArray()
        readableDatabase.rawQuery(
            """
            SELECT
                reference_month,
                SUM(total_amount) AS month_total,
                COUNT(id) AS purchase_count
            FROM purchases
            GROUP BY reference_month
            ORDER BY reference_month ASC
            """.trimIndent(),
            null
        ).use { cursor ->
            while (cursor.moveToNext()) {
                result.put(
                    JSONObject()
                        .put("month", cursor.getString(0))
                        .put("total", cursor.getDouble(1))
                        .put("purchaseCount", cursor.getInt(2))
                )
            }
        }
        return result
    }

    fun getMarketHistoricalRanking(): JSONArray {
        data class MarketStat(
            val market: String,
            val averageSpend: Double,
            var timesCheapest: Int = 0
        )

        val stats = linkedMapOf<String, MarketStat>()
        readableDatabase.rawQuery(
            """
            SELECT
                m.name,
                AVG(p.total_amount) AS average_spend
            FROM purchases p
            INNER JOIN markets m ON m.id = p.market_id
            GROUP BY m.name
            HAVING COUNT(p.id) > 0
            ORDER BY m.name COLLATE NOCASE ASC
            """.trimIndent(),
            null
        ).use { cursor ->
            while (cursor.moveToNext()) {
                val marketName = cursor.getString(0)
                val averageSpend = cursor.getDouble(1)
                stats[marketName] = MarketStat(
                    market = marketName,
                    averageSpend = averageSpend
                )
            }
        }

        if (stats.isEmpty()) {
            return JSONArray()
        }

        val monthlyTotals = linkedMapOf<String, MutableList<Pair<String, Double>>>()
        readableDatabase.rawQuery(
            """
            SELECT
                p.reference_month,
                m.name,
                SUM(p.total_amount) AS month_total
            FROM purchases p
            INNER JOIN markets m ON m.id = p.market_id
            GROUP BY p.reference_month, m.name
            ORDER BY p.reference_month ASC, month_total ASC, m.name ASC
            """.trimIndent(),
            null
        ).use { cursor ->
            while (cursor.moveToNext()) {
                val referenceMonth = cursor.getString(0)
                val marketName = cursor.getString(1)
                val monthTotal = cursor.getDouble(2)
                monthlyTotals.getOrPut(referenceMonth) { mutableListOf() }
                    .add(marketName to monthTotal)
            }
        }

        monthlyTotals.values.forEach { monthEntries ->
            val lowestTotal = monthEntries.minOfOrNull { it.second } ?: 0.0
            monthEntries.forEach { (marketName, monthTotal) ->
                if (monthTotal <= lowestTotal + 0.0001) {
                    stats[marketName]?.timesCheapest = stats[marketName]?.timesCheapest?.plus(1) ?: 0
                }
            }
        }

        val maxAverageSpend = stats.values.maxOfOrNull { it.averageSpend } ?: 0.0
        val rankedMarkets = stats.values.map { stat ->
            val normalizedAverage = if (maxAverageSpend == 0.0) {
                0.0
            } else {
                stat.averageSpend / maxAverageSpend
            }

            JSONObject()
                .put("market", stat.market)
                .put("averageSpend", stat.averageSpend)
                .put("timesCheapest", stat.timesCheapest)
                .put("normalizedAverageSpend", normalizedAverage)
                .put("score", (stat.timesCheapest * 2.0) - normalizedAverage)
        }.sortedWith(
            compareByDescending<JSONObject> { it.optDouble("score") }
                .thenByDescending { it.optInt("timesCheapest") }
                .thenBy { it.optDouble("averageSpend") }
                .thenBy { it.optString("market") }
        )

        val result = JSONArray()
        rankedMarkets.forEachIndexed { index, entry ->
            entry.put("position", index + 1)
            result.put(entry)
        }
        return result
    }

    private fun findMarketIdByName(name: String): Long? {
        if (name.isBlank()) {
            return null
        }

        readableDatabase.query(
            "markets",
            arrayOf("id"),
            "name = ?",
            arrayOf(name),
            null,
            null,
            null
        ).use { cursor ->
            if (cursor.moveToFirst()) {
                return cursor.getLong(0)
            }
        }

        return null
    }

    private fun getMonthTotal(month: String): Double {
        readableDatabase.rawQuery(
            "SELECT COALESCE(SUM(total_amount), 0) FROM purchases WHERE reference_month = ?",
            arrayOf(month)
        ).use { cursor ->
            if (cursor.moveToFirst()) {
                return cursor.getDouble(0)
            }
        }
        return 0.0
    }

    private fun getPreviousMonth(month: String): String {
        val parts = month.split("-")
        if (parts.size != 2) {
            return month
        }

        var year = parts[0].toIntOrNull() ?: return month
        var monthNumber = parts[1].toIntOrNull() ?: return month
        monthNumber -= 1
        if (monthNumber < 1) {
            monthNumber = 12
            year -= 1
        }
        return "%04d-%02d".format(year, monthNumber)
    }

    private fun calculatePercentChange(previous: Double, current: Double): Double {
        if (previous == 0.0) {
            return if (current == 0.0) 0.0 else 100.0
        }
        return ((current - previous) / previous) * 100.0
    }

    private fun findFirstByTrend(items: JSONArray, trend: String): JSONObject? {
        for (index in 0 until items.length()) {
            val item = items.getJSONObject(index)
            if (item.optString("trend") == trend) {
                return item
            }
        }
        return null
    }

    private fun buildPriceAlerts(productChanges: JSONArray): JSONObject {
        val increased = mutableListOf<JSONObject>()
        val decreased = mutableListOf<JSONObject>()

        for (index in 0 until productChanges.length()) {
            val item = productChanges.getJSONObject(index)
            val previousAverage = item.optDouble("previousAverage", 0.0)
            val currentAverage = item.optDouble("currentAverage", 0.0)
            val differencePercent = item.optDouble("differencePercent", 0.0)

            if (previousAverage <= 0.0 || currentAverage <= 0.0) {
                continue
            }

            if (differencePercent >= 20.0) {
                increased += JSONObject(item.toString()).put("alertType", "aumento")
            } else if (differencePercent <= -20.0) {
                decreased += JSONObject(item.toString()).put("alertType", "queda")
            }
        }

        val sortedAttention = (increased + decreased).sortedByDescending {
            kotlin.math.abs(it.optDouble("differencePercent"))
        }

        val increasedArray = JSONArray()
        increased.sortedByDescending { it.optDouble("differencePercent") }.forEach(increasedArray::put)

        val decreasedArray = JSONArray()
        decreased.sortedBy { it.optDouble("differencePercent") }.forEach(decreasedArray::put)

        val attentionArray = JSONArray()
        sortedAttention.forEach(attentionArray::put)

        return JSONObject()
            .put("increaseCount", increased.size)
            .put("decreaseCount", decreased.size)
            .put("increased", increasedArray)
            .put("decreased", decreasedArray)
            .put("attentionList", attentionArray)
    }

    private fun normalizeProductName(value: String): String {
        val collapsedSpaces = value.lowercase().trim().replace(Regex("\\s+"), " ")
        val normalized = Normalizer.normalize(collapsedSpaces, Normalizer.Form.NFD)
        return normalized.replace(Regex("\\p{InCombiningDiacriticalMarks}+"), "")
    }

    private fun backfillNormalizedNames(db: SQLiteDatabase) {
        db.rawQuery(
            "SELECT id, product_name FROM purchase_items",
            null
        ).use { cursor ->
            while (cursor.moveToNext()) {
                val itemId = cursor.getLong(0)
                val productName = cursor.getString(1) ?: ""
                val values = ContentValues().apply {
                    put("normalized_name", normalizeProductName(productName))
                }
                db.update("purchase_items", values, "id = ?", arrayOf(itemId.toString()))
            }
        }
    }

    private fun seedMarkets(db: SQLiteDatabase) {
        listOf("Atacadão", "Assaí", "Carrefour").forEach { market ->
            val values = ContentValues().apply {
                put("name", market)
            }
            db.insert("markets", null, values)
        }
    }

    companion object {
        private const val DATABASE_NAME = "shopping_manager.db"
        private const val DATABASE_VERSION = 2
    }
}
