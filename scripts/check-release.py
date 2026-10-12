"""Require green private-repository CI, rebuild/test/scan, and record local image identities."""

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
COMPONENTS = ('api', 'gateway', 'edge', 'sso', 'sessions')
REQUIRED_STEPS = frozenset({
    'Scan Git history for credentials', 'Audit pinned runtime dependencies',
    'Backend and security regressions', 'Deployment navigation regressions',
    'Frontend verification', 'Build deployable images',
    'Verify private HTTPS/SSO deployment', 'Gate deployable images on high/critical advisories',
})


class ReleaseError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise ReleaseError(message)


def command(*args):
    result = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, timeout=120)
    require(result.returncode == 0, 'A required Git, GitHub, or image metadata check failed.')
    return result.stdout


def source_commit():
    require(not command('git', 'status', '--porcelain').strip(), 'Commit all source changes before checking a release.')
    commit = command('git', 'rev-parse', 'HEAD').strip()
    require(re.fullmatch(r'[a-f0-9]{40}', commit), 'A full source commit is required.')
    return commit


def verify_ci(repository, commit):
    require(re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repository), 'Use an owner/repository identifier.')
    metadata = json.loads(command('gh', 'api', f'repos/{repository}'))
    require(metadata.get('private') is True, 'The release repository must remain private.')
    branch = metadata['default_branch']
    runs = json.loads(command(
        'gh', 'run', 'list', '--repo', repository, '--workflow', 'security.yml',
        '--branch', branch, '--commit', commit, '--limit', '20',
        '--json', 'databaseId,headSha,status,conclusion,event,url',
    ))
    # Do not fall back to an older green run after a newer failure or cancellation.
    eligible = [run for run in runs if run.get('event') in ('push', 'workflow_dispatch', 'schedule')]
    require(eligible, 'No default-branch verification run exists for this commit.')
    run = eligible[0]
    require(run.get('headSha') == commit and run.get('status') == 'completed' and run.get('conclusion') == 'success', 'The latest verification for this exact commit must be green.')
    require(isinstance(run.get('databaseId'), int) and run['databaseId'] > 0, 'Verification run metadata is incomplete.')
    require(run.get('url') == f'https://github.com/{repository}/actions/runs/{run["databaseId"]}', 'Verification run URL is invalid.')
    details = json.loads(command('gh', 'run', 'view', str(run['databaseId']), '--repo', repository, '--json', 'jobs'))
    jobs = [job for job in details['jobs'] if job.get('name') == 'verify' and job.get('conclusion') == 'success']
    require(len(jobs) == 1, 'The verification job must complete successfully.')
    passed = {step['name'] for step in jobs[0]['steps'] if step.get('conclusion') == 'success'}
    require(REQUIRED_STEPS <= passed, 'All required tests, deployment checks, and scans must pass without skipped gates.')
    return run['url']


def image_identities():
    images = {}
    for component in COMPONENTS:
        tag = f'beacon-{component}:security-test'
        metadata = json.loads(command('docker', 'image', 'inspect', tag))[0]
        require(re.fullmatch(r'sha256:[a-f0-9]{64}', metadata['Id']), 'Image content identity is invalid.')
        require(metadata['Os'] == 'linux' and metadata['Architecture'] == 'amd64', 'Only Linux amd64 release images have been exercised.')
        images[component] = {
            'local_tag': tag, 'image_id': metadata['Id'],
            'os': metadata['Os'], 'architecture': metadata['Architecture'],
        }
    return images


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', default='aadvik1864/beacon')
    parser.add_argument('--output', type=Path, required=True, help='New manifest outside the source repository; existing files are never replaced.')
    args = parser.parse_args()
    try:
        output = args.output.resolve()
        require(not output.is_relative_to(ROOT) and not output.exists(), 'Choose a new release-manifest path outside the repository.')
        commit = source_commit()
        run_url = verify_ci(args.repo, commit)
        # Green hosted CI is not proof of later local rebuilds: verify the actual
        # local images too. These scripts use only generated synthetic fixtures.
        subprocess.run([sys.executable, str(ROOT / 'scripts/test-deployment.py')], cwd=ROOT, check=True, timeout=1200)
        images = image_identities()
        subprocess.run([sys.executable, str(ROOT / 'scripts/scan-images.py')], cwd=ROOT, check=True, timeout=600)
        require(image_identities() == images, 'Local image identities changed during verification.')
        require(source_commit() == commit, 'Source changed during verification.')
        require(verify_ci(args.repo, commit) == run_url, 'Hosted verification changed during release checks.')
        manifest = {
            'x-beacon-release': {
                'schema_version': 1, 'product': 'Beacon', 'source_commit': commit,
                'checked_at': datetime.now(timezone.utc).isoformat(), 'verification_run': run_url,
                'images': images, 'aws_enabled': False, 'paid_inference_enabled': False,
            },
            # This manifest is also a Compose override. --no-build --pull never
            # starts the tested local content IDs rather than rebuilding tags.
            'services': {name: {'image': image['image_id'], 'pull_policy': 'never'} for name, image in images.items()},
        }
        with open(output, 'x', encoding='utf-8', opener=lambda path, flags: os.open(path, flags, 0o600)) as handle:
            handle.write(json.dumps(manifest, indent=2) + '\n')
    except ReleaseError as error:
        print(f'Release check failed: {error}', file=sys.stderr)
        return 1
    except (OSError, ValueError, KeyError, IndexError, TypeError, subprocess.SubprocessError):
        # Never echo command output, credentials, configuration, or raw exceptions.
        print('Release check failed. Review local tooling, private GitHub access, and verification gates.', file=sys.stderr)
        return 1
    print('Release checks passed. Local image identities recorded; real-provider/host acceptance is still required.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
