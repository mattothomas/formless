# SNAP application field definitions and output schema

SNAP_FIELDS: dict[str, str] = {
    "full_name": "Full Name",
    "address": "Home Address",
    "zip_code": "ZIP Code",
    "dependents": "Number of Dependents",
    "monthly_income": "Monthly Income",
    "employment_status": "Employment Status",
}

# JSON Schema for Claude's structured output on every turn
OUTPUT_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "extracted_data": {
            "type": "object",
            "description": "All fields extracted so far. Use null for fields not yet known.",
            "properties": {
                "full_name": {"type": ["string", "null"]},
                "address": {"type": ["string", "null"]},
                "zip_code": {"type": ["string", "null"]},
                "dependents": {"type": ["string", "null"]},
                "monthly_income": {"type": ["string", "null"]},
                "employment_status": {"type": ["string", "null"]},
            },
            "required": [
                "full_name",
                "address",
                "zip_code",
                "dependents",
                "monthly_income",
                "employment_status",
            ],
            "additionalProperties": False,
        },
        "missing_fields": {
            "type": "array",
            "description": "Field keys still needed to complete the application.",
            "items": {"type": "string"},
        },
        "follow_up_message": {
            "type": "string",
            "description": "Empathetic message shown to the user asking only for missing info.",
        },
    },
    "required": ["extracted_data", "missing_fields", "follow_up_message"],
    "additionalProperties": False,
}
