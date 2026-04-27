package com.gerenciadordecompras.app

import android.content.Context
import android.webkit.JavascriptInterface
import com.chaquo.python.Python
import com.chaquo.python.android.AndroidPlatform
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
}
