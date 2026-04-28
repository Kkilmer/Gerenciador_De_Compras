import json
from collections import defaultdict
import re
import unicodedata


def _to_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _normalize_name(value):
    text = str(value or "").lower().strip()
    text = re.sub(r"\s+", " ", text)
    text = unicodedata.normalize("NFD", text)
    return "".join(char for char in text if unicodedata.category(char) != "Mn")


def _normalize_item_type(value):
    item_type = str(value or "unit").strip().lower()
    return "weight" if item_type == "weight" else "unit"


def process_purchase_json(payload: str) -> str:
    data = json.loads(payload)
    items = data.get("items", [])
    month = data.get("month", "")
    market = data.get("market", "")

    processed_items = []
    total_purchase = 0.0
    product_prices = defaultdict(list)

    for item in items:
        name = item.get("name", "").strip()
        normalized_name = _normalize_name(name)
        item_type = _normalize_item_type(item.get("itemType"))
        quantity = _to_float(item.get("quantity"))
        unit_price = _to_float(item.get("unitPrice"))
        final_price = round(quantity * unit_price, 2)
        total_purchase += final_price

        if normalized_name:
            product_prices[normalized_name].append(unit_price)

        processed_items.append(
            {
                "name": name,
                "normalizedName": normalized_name,
                "itemType": item_type,
                "quantity": quantity,
                "unitPrice": round(unit_price, 2),
                "finalPrice": final_price,
            }
        )

    comparison_hint = []
    for product_name, price_list in product_prices.items():
        comparison_hint.append(
            {
                "product": product_name,
                "lowestPriceSeen": round(min(price_list), 2),
                "highestPriceSeen": round(max(price_list), 2),
            }
        )

    response = {
        "month": month,
        "market": market,
        "items": processed_items,
        "totalPurchase": round(total_purchase, 2),
        "summary": {
            "itemCount": len(processed_items),
            "marketCount": 1 if market else 0,
        },
        "comparisonHints": comparison_hint,
    }
    return json.dumps(response, ensure_ascii=False)
