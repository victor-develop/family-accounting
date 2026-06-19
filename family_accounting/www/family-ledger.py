def get_context(context):
    context.no_cache = 1
    context.title = "Family Ledger"
    context.boot = {
        "app_name": "family_accounting",
        "frontend_route": "/family-ledger",
    }
