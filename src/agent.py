"""
Caseworker LLM agent.

Each call to `process_turn` sends the full conversation history to Claude and
returns a structured result: extracted data, still-missing fields, and the next
message to show the user.

The system prompt is cached via prompt caching so it only costs full price on
the first request. Subsequent turns hit the cache.
"""
import json
import anthropic
from .schema import OUTPUT_SCHEMA

SYSTEM_PROMPT = """\
You are an AI caseworker helping users apply for government assistance.

A user will describe their situation in natural language.

Your job is to:
1. Determine if they qualify for SNAP (food assistance)
2. Extract as much structured data as possible into this schema:
   {
     "full_name": "",
     "address": "",
     "zip_code": "",
     "dependents": "",
     "monthly_income": "",
     "employment_status": ""
   }

3. Identify missing fields
4. Ask ONLY for missing fields in a natural, empathetic way

Rules:
- Do NOT ask for information already provided
- Keep questions minimal
- Be conversational, not robotic
- Assume user may be stressed or overwhelmed

Output format:
{
  "extracted_data": { ... },
  "missing_fields": [...],
  "follow_up_message": "..."
}\
"""


def process_turn(
    client: anthropic.Anthropic,
    conversation_history: list[dict],
    user_message: str,
) -> dict:
    """
    Process one conversation turn.

    Args:
        client: Authenticated Anthropic client.
        conversation_history: Alternating user/assistant messages from prior turns.
            The assistant turns contain the raw JSON responses so Claude has full
            context about what has already been extracted.
        user_message: The user's current input.

    Returns:
        dict with keys:
            extracted_data  – dict of field → value (None if not yet known)
            missing_fields  – list of field keys still needed
            follow_up_message – human-readable next question(s) for the user
    """
    messages = conversation_history + [{"role": "user", "content": user_message}]

    response = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=4096,
        system=[
            {
                "type": "text",
                "text": SYSTEM_PROMPT,
                # Cache the system prompt — it never changes across turns
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=messages,
        output_config={
            "format": {
                "type": "json_schema",
                "schema": OUTPUT_SCHEMA,
            }
        },
    )

    raw_text = next(b.text for b in response.content if b.type == "text")
    return json.loads(raw_text), raw_text
