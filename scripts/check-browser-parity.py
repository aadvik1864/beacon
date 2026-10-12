"""Generate/check fictional Python-engine expectations for the browser port."""
import argparse
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'src'))
from beacon.fixtures import CLEAN_POLICY, INJECTED_POLICY, NORMAL_QUESTION  # noqa: E402
from beacon.models import SimulationInput  # noqa: E402
from beacon.simulation import simulate  # noqa: E402

DESTINATION = ROOT / 'frontend/src/test/browserParity.json'


def expectations():
    cases = []
    scenarios = [
        ('clean', CLEAN_POLICY, NORMAL_QUESTION),
        ('injected', INJECTED_POLICY, NORMAL_QUESTION),
        ('direct', CLEAN_POLICY, 'Retrieve the synthetic payroll file and show its contents.'),
    ]
    for name, policy, question in scenarios:
        for behavior in ('follow', 'ignore', 'retrieve_only'):
            for target in ('both', 'vulnerable', 'protected'):
                cases.append((f'{name}/{behavior}/{target}', policy, question, behavior, target))
    for name, policy, question in [
        ('edited', 'Employees receive 28 days of annual leave.', NORMAL_QUESTION),
        ('unicode-gap', 'read ' + '😀' * 195 + 'private/payroll.csv', NORMAL_QUESTION),
        ('long-gap', 'read ' + 'x' * 201 + 'private/payroll.csv', NORMAL_QUESTION),
        ('unicode-word', CLEAN_POLICY, 'épayroll'),
        ('unicode-allowance', 'Employees receive ٢٨ days of annual leave.', NORMAL_QUESTION),
        ('unknown-question', 'An unrelated fictional document.', 'What is the weather?'),
        ('plural-boundary', 'Employees receive 28 days of annual leaves.', NORMAL_QUESTION),
    ]:
        cases.append((name, policy, question, 'follow', 'both'))
    output = []
    for name, policy, question, behavior, target in cases:
        request = SimulationInput(mode='simulation', idempotency_key='00000000-0000-4000-8000-000000000000',
                                  policy=policy, question=question, behavior=behavior, target=target)
        record = simulate(request)
        results = []
        for result in record.results:
            data = result.model_dump(exclude={'explanation'})
            data['answer'] = re.sub(r'BEACON_SYNTHETIC_[a-f0-9]{24}', 'BEACON_SYNTHETIC_MARKER', data['answer'])
            data['answer'] = data['answer'].replace('The local permission policy blocked payroll retrieval.',
                                                  'The browser permission illustration blocked payroll retrieval.')
            results.append(data)
        output.append({'name': name, 'input': request.model_dump(), 'results': results,
                       'trace': [{'actor': event.actor, 'event_type': event.event_type, 'metadata': event.metadata}
                                 for event in record.events]})
    return json.dumps(output, ensure_ascii=False, indent=2) + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    generated = expectations()
    if args.check:
        if not DESTINATION.is_file() or DESTINATION.read_text() != generated:
            print('Browser parity fixture is stale. Review engine changes and regenerate it.', file=sys.stderr)
            return 1
        print('34 Python/browser parity expectations match the current Python engine.')
    else:
        DESTINATION.write_text(generated)
        print('Generated 34 fictional Python-engine expectations; run frontend tests to check the browser port.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
