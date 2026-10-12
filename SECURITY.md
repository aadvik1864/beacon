# Security

Beacon is a synthetic prompt-injection simulation lab. It must not process real
payroll, cloud credentials, or confidential documents. See
[private deployment](docs/deployment.md) for the supported security boundary,
secret handling, limitations, and launch checklist.

Only the current release and its locked dependencies are supported. Review
dependency/image updates and rerun tests, SSO checks, and vulnerability scans.
An audit with no findings is not a guarantee of security or a penetration test.

Report suspected vulnerabilities privately to the repository owner through an
existing trusted private channel or GitHub private vulnerability reporting if
enabled. Do not create public issues or upload credentials, documents, cookies,
browser traces, or unredacted logs. Include a minimal synthetic reproduction,
affected release, and server-generated request ID if available.

On suspected secret exposure: stop affected deployments, revoke/rotate the
credential at its source, invalidate SSO sessions, and review access. Removing a
value from Git or a file does not revoke it. Private Git visibility is not a
replacement for secret management.
