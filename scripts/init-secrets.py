"""Generate private deployment keys outside the repository, without printing them."""

import argparse
import base64
import os
from pathlib import Path
import secrets


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path, help="Absolute secrets directory outside this repository")
    args = parser.parse_args()
    target = args.directory
    repo = Path(__file__).resolve().parents[1]
    if not target.is_absolute() or target.resolve().is_relative_to(repo):
        parser.error("Use an absolute directory outside the repository.")
    target.mkdir(parents=True, exist_ok=True, mode=0o700)
    names = ("gateway_key", "csrf_key", "cookie_key", "redis_config", "sso_store_config")
    if any((target / name).exists() for name in names):
        parser.error("Keys already exist. Refusing to replace them.")
    redis_key = secrets.token_urlsafe(48)
    values = (
        secrets.token_urlsafe(48), secrets.token_urlsafe(48), base64.urlsafe_b64encode(secrets.token_bytes(32)).decode(),
        f"requirepass {redis_key}\n", f'redis_password = "{redis_key}"\n',
    )
    for name, value in zip(names, values):
        fd = os.open(target / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w") as output:
            output.write(value)
    print("Generated five private key/configuration files. No existing files were replaced.")
    print("Add allowed_emails and oidc_client_secret, then set file ownership for UID 10001. See docs/deployment.md.")


if __name__ == "__main__":
    main()
