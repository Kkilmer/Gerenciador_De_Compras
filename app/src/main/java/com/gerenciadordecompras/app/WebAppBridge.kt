package com.gerenciadordecompras.app

import android.content.ContentValues
import android.content.Context
import android.os.Environment
import android.provider.MediaStore
import android.webkit.JavascriptInterface
import com.chaquo.python.Python
import com.chaquo.python.android.AndroidPlatform
import java.nio.charset.StandardCharsets
import org.json.JSONObject

class WebAppBridge(private val context: Context) {

    private val databaseHelper = ShoppingDatabaseHelper(context)

    init {
        if (!Python.isStarted()) {
            Python.start(AndroidPlatform(context))
        }
    }

    @JavascriptInterface
    fun processMonthlyPurchase(payload: String): String {
        val python = Python.getInstance()
        val module = python.getModule("shopping_logic")
        return module.callAttr("process_purchase_json", payload).toString()
    }

    @JavascriptInterface
    fun savePurchase(payload: String): String {
        val processed = JSONObject(processMonthlyPurchase(payload))
        return databaseHelper.savePurchase(JSONObject(payload), processed).toString()
    }

    @JavascriptInterface
    fun getPurchaseDetails(purchaseId: String): String {
        return databaseHelper.getPurchaseDetails(purchaseId.toLong()).toString()
    }

    @JavascriptInterface
    fun updatePurchase(purchaseId: String, payload: String): String {
        val processed = JSONObject(processMonthlyPurchase(payload))
        return databaseHelper.updatePurchase(purchaseId.toLong(), JSONObject(payload), processed).toString()
    }

    @JavascriptInterface
    fun deletePurchase(purchaseId: String): String {
        return databaseHelper.deletePurchase(purchaseId.toLong()).toString()
    }

    @JavascriptInterface
    fun addMarket(name: String): String {
        return databaseHelper.insertMarket(name).toString()
    }

    @JavascriptInterface
    fun getMarkets(): String {
        return databaseHelper.listMarkets().toString()
    }

    @JavascriptInterface
    fun getMonthlyHistory(): String {
        return databaseHelper.listMonthlyHistory().toString()
    }

    @JavascriptInterface
    fun getFilteredMonthlyHistory(month: String, market: String, product: String): String {
        val normalizedMonth = month.ifBlank { null }
        val normalizedMarket = market.ifBlank { null }
        val normalizedProduct = product.ifBlank { null }
        return databaseHelper
            .listMonthlyHistoryFiltered(normalizedMonth, normalizedMarket, normalizedProduct)
            .toString()
    }

    @JavascriptInterface
    fun getMonthlyComparison(month: String): String {
        return databaseHelper.monthlyComparison(month).toString()
    }

    @JavascriptInterface
    fun getProductComparison(month: String): String {
        return databaseHelper.productComparison(month).toString()
    }

    @JavascriptInterface
    fun getMonthVsPrevious(month: String): String {
        return databaseHelper.compareWithPreviousMonth(month).toString()
    }

    @JavascriptInterface
    fun getDashboardOverview(month: String): String {
        return databaseHelper.getDashboardOverview(month).toString()
    }

    @JavascriptInterface
    fun exportMonthlyCsv(month: String): String {
        if (month.isBlank()) {
            return JSONObject()
                .put("success", false)
                .put("message", "Escolha um mês para exportar.")
                .toString()
        }

        return saveCsvReport(
            referenceMonth = month,
            fileName = "gerenciador_compras_$month.csv"
        ).toString()
    }

    @JavascriptInterface
    fun exportAllCsv(): String {
        return saveCsvReport(
            referenceMonth = null,
            fileName = "gerenciador_compras_tudo.csv"
        ).toString()
    }

    private fun saveCsvReport(referenceMonth: String?, fileName: String): JSONObject {
        val report = databaseHelper.buildPurchasesCsv(referenceMonth)
        val rowCount = report.optInt("rowCount", 0)
        val content = report.optString("content")

        if (rowCount == 0) {
            return JSONObject()
                .put("success", false)
                .put("message", "Nenhum dado encontrado para exportar.")
        }

        val resolver = context.contentResolver
        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, fileName)
            put(MediaStore.Downloads.MIME_TYPE, "text/csv")
            put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
        }

        val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
            ?: return JSONObject()
                .put("success", false)
                .put("message", "Não foi possível criar o arquivo CSV.")

        return try {
            resolver.openOutputStream(uri)?.use { output ->
                output.write(content.toByteArray(StandardCharsets.UTF_8))
            }

            JSONObject()
                .put("success", true)
                .put("fileName", fileName)
                .put("rowCount", rowCount)
                .put("uri", uri.toString())
                .put("message", "CSV salvo em Downloads: $fileName")
        } catch (error: Exception) {
            resolver.delete(uri, null, null)
            JSONObject()
                .put("success", false)
                .put("message", "Erro ao salvar CSV: ${error.message}")
        }
    }
}
