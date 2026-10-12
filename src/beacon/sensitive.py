"""Known credential-pattern guard, not general-purpose data-loss prevention."""

import re

KNOWN_CREDENTIAL = re.compile(
    r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b"
    r"|-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----"
    r"|\bgh[pousr]_[A-Za-z0-9]{20,}\b"
    r"|\bgithub_pat_[A-Za-z0-9_]{30,}\b"
    r"|\b(?:sk-proj-|sk_live_|xox[baprs]-)[A-Za-z0-9_-]{16,}\b"
    r"|\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b"
    r"|(?:https?|postgres(?:ql)?|mysql|mongodb)://[^\s/@:]+:[^\s/@]+@"
)


def reject_credentials(value: str) -> str:
    if KNOWN_CREDENTIAL.search(value):
        raise ValueError("Possible credentials detected. Use synthetic lab data only.")
    return value
