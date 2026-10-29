#!/usr/bin/env python3
"""Offline per-PC Router setup; never installs tools, starts agents or changes global config."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]


def runtime_status(root=ROOT):
    path = root / 'config/runtime.local.json'
    if not path.exists():
        return 'MISSING'
    try:
        if path.is_symlink() or not path.is_file():
            return 'INVALID'
        config = json.loads(path.read_text())
        validate_runtime(config, root)
        return 'CONFIGURED' if config.get('enabled') else 'DISABLED'
    except (OSError, ValueError, KeyError, TypeError):
        return 'INVALID'


def validate_runtime(config, root=ROOT):
    if not isinstance(config, dict):
        raise ValueError('INVALID_RUNTIME')
    if not isinstance(config.get('enabled'), bool) or config.get('device') not in ('cpu', 'mps'):
        raise ValueError('INVALID_RUNTIME')
    python, model = Path(config['python']), Path(config['model_dir'])
    if not python.is_absolute() or not python.is_file() or not os.access(python, os.X_OK):
        raise ValueError('PYTHON_REQUIRED')
    if not model.is_absolute() or not model.is_dir():
        raise ValueError('MODEL_REQUIRED')
    policy = json.loads((root / 'config/policy.json').read_text())
    manifest = (model / 'MODEL_MANIFEST.json').read_bytes()
    if hashlib.sha256(manifest).hexdigest() != policy['decision']['manifest_sha256']:
        raise ValueError('MODEL_MANIFEST_MISMATCH')
    # Full executable/weight verification remains in poc.py / D3 verify=full before inference.


def configure(python, model_dir, device, root=ROOT):
    config = {'enabled': True, 'python': str(Path(python).absolute()),
              'model_dir': str(Path(model_dir).absolute()), 'device': device}
    validate_runtime(config, root)
    destination = root / 'config/runtime.local.json'
    if destination.is_symlink():
        raise ValueError('UNSAFE_RUNTIME_PATH')
    # Exclusive creation: a different local setup is never overwritten.
    try:
        fd = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        if json.loads(destination.read_text()) == config:
            return 'PRESERVED'
        raise ValueError('EXISTING_RUNTIME_PRESERVED')
    with os.fdopen(fd, 'w') as stream:
        json.dump(config, stream, indent=2)
        stream.write('\n')
    return 'CREATED'


def check(root=ROOT):
    return {'mode': 'OFFLINE_CHECK', 'insideHerdr': os.environ.get('HERDR_ENV') == '1',
            'tools': {tool: bool(shutil.which(tool)) for tool in ('herdr', 'codex', 'python3')},
            'runtime': runtime_status(root),
            'hookDefinition': (root.parents[1] / '.codex/hooks.json').is_file(),
            'hookTrust': 'VERIFY_IN_CODEX', 'inference': 'NOT_RUN',
            'herdrSession': 'NOT_INSPECTED', 'downloads': 0, 'agentsStarted': 0}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('check')
    runtime = sub.add_parser('runtime')
    runtime.add_argument('--python', required=True)
    runtime.add_argument('--model-dir', required=True)
    runtime.add_argument('--device', choices=('cpu', 'mps'), required=True)
    args = parser.parse_args()
    try:
        result = check() if args.command == 'check' else {
            'runtime': configure(args.python, args.model_dir, args.device)}
        print(json.dumps(result, indent=2))
    except (OSError, ValueError, KeyError, TypeError):
        print('Router setup failed; check local Python, pinned model and existing config. No existing config was overwritten.', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
