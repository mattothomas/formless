"""
Formless — AI Caseworker CLI

Starts a conversational session that extracts SNAP application data from
natural language. Runs until all required fields are collected, then
prints a confirmation summary.

Usage:
    python main.py
"""
import os
from dotenv import load_dotenv
from src.session import CaseworkerSession

load_dotenv()


def main() -> None:
    print("=" * 60)
    print("  Formless — AI Caseworker")
    print("  SNAP (Food Assistance) Application Helper")
    print("=" * 60)
    print()
    print("Tell me a little about your situation and I'll help you")
    print("apply for food assistance. Type 'quit' to exit.\n")

    session = CaseworkerSession(api_key=os.getenv("ANTHROPIC_API_KEY"))

    # Kick off the first turn with a greeting prompt so the agent introduces itself
    opening = session.send_message(
        "Hello, I'd like to apply for food assistance. Can you help me?"
    )
    print(f"Caseworker: {opening}\n")

    while not session.is_complete:
        try:
            user_input = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n\nSession ended.")
            break

        if user_input.lower() in {"quit", "exit", "q"}:
            print("\nSession ended. Come back any time.")
            break

        if not user_input:
            continue

        response = session.send_message(user_input)
        print(f"\nCaseworker: {response}\n")

    if session.is_complete:
        print("\n" + "=" * 60)
        print("  All information collected!")
        print("=" * 60)
        print(session.summary())
        print()
        print("Next step: PDF generation (coming soon).")


if __name__ == "__main__":
    main()
