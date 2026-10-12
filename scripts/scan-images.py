"""Fail on high/critical advisories in deployable images, without Docker socket access."""

import json
from pathlib import Path
import subprocess
import tempfile

TRIVY = 'aquasec/trivy:0.71.1@sha256:b5d1b07e61c375597a6e2086bc110257348bba9f9f9a3b30e6e67f3ba0b1aa06'
IMAGES = (
    'beacon-api:security-test', 'beacon-gateway:security-test', 'beacon-edge:security-test',
    'beacon-sso:security-test', 'beacon-sessions:security-test',
)


def main():
    cache = Path('/tmp/opencode/beacon-trivy-cache')
    cache.mkdir(parents=True, exist_ok=True)
    failed = False
    with tempfile.TemporaryDirectory(prefix='beacon-images-', dir='/tmp/opencode') as tmp:
        directory = Path(tmp)
        for image in IMAGES:
            subprocess.run(['docker', 'save', '-o', str(directory / 'image.tar'), image], check=True)
            result = subprocess.run([
                'docker', 'run', '--rm', '-v', f'{directory}:/scan', '-v', f'{cache}:/cache',
                TRIVY, 'image', '--cache-dir', '/cache', '--input', '/scan/image.tar',
                '--scanners', 'vuln', '--severity', 'HIGH,CRITICAL', '--exit-code', '1',
                '--format', 'json', '--output', '/scan/result.json', '--no-progress', '--skip-version-check',
            ], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
            if not (directory / 'result.json').is_file():
                raise RuntimeError('Container scanner failed: ' + result.stdout[-1000:])
            report = json.loads((directory / 'result.json').read_text())
            findings = [vuln for target in report.get('Results', []) for vuln in target.get('Vulnerabilities', [])]
            print(f'{image.split("@")[0]}: {len(findings)} high/critical advisories')
            for vuln in findings:
                print(f'  {vuln["VulnerabilityID"]} {vuln["PkgName"]} {vuln["InstalledVersion"]} fixed={vuln.get("FixedVersion", "not available")}')
            failed |= result.returncode != 0 or bool(findings)
            (directory / 'result.json').unlink()
    if failed:
        raise SystemExit('Image gate failed. Update/review findings before deployment; none are silently ignored.')


if __name__ == '__main__':
    main()
