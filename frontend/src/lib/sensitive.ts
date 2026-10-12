// Known credential-pattern guard only. It cannot identify arbitrary PII/secrets.
const credential = /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b|-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{30,}\b|\b(?:sk-proj-|sk_live_|xox[baprs]-)[A-Za-z0-9_-]{16,}\b|\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b|(?:https?|postgres(?:ql)?|mysql|mongodb):\/\/[^\s/@:]+:[^\s/@]+@/;

export const containsCredential = (value: string) => credential.test(value);
