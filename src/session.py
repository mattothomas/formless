"""
Multi-turn caseworker session.

CaseworkerSession owns the conversation history and accumulated extracted data.
Each call to `send_message` invokes the LLM, merges any newly extracted fields
into the running state, and returns the follow-up message to show the user.
"""
import anthropic
from .agent import process_turn
from .schema import SNAP_FIELDS


class CaseworkerSession:
    def __init__(self, api_key: str | None = None) -> None:
        self.client = anthropic.Anthropic(api_key=api_key)
        # Alternating user / assistant dicts — assistant turns store raw JSON
        # so Claude sees exactly what it extracted on prior turns
        self.conversation_history: list[dict] = []
        # Accumulated best-known values across all turns
        self.extracted_data: dict[str, str | None] = {k: None for k in SNAP_FIELDS}
        self.missing_fields: list[str] = list(SNAP_FIELDS.keys())
        self.is_complete: bool = False

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def send_message(self, user_message: str) -> str:
        """
        Process the user's message and return the caseworker's follow-up.

        Updates `extracted_data`, `missing_fields`, and `is_complete` in place.
        """
        result, raw_json = process_turn(
            self.client,
            self.conversation_history,
            user_message,
        )

        # Merge newly extracted fields — never overwrite a known value with None
        for field, value in result["extracted_data"].items():
            if value:
                self.extracted_data[field] = value

        # Recompute missing from the accumulated state (more reliable than
        # trusting the model's list, which may lag by one turn)
        self.missing_fields = [
            k for k, v in self.extracted_data.items() if not v
        ]
        self.is_complete = len(self.missing_fields) == 0

        # Store raw JSON as the assistant turn so future calls have full context
        self.conversation_history.append({"role": "user", "content": user_message})
        self.conversation_history.append({"role": "assistant", "content": raw_json})

        return result["follow_up_message"]

    def summary(self) -> str:
        """Human-readable summary of what has been collected so far."""
        lines = ["Here's what I have on file:"]
        for key, label in SNAP_FIELDS.items():
            value = self.extracted_data.get(key) or "—"
            lines.append(f"  • {label}: {value}")
        return "\n".join(lines)
