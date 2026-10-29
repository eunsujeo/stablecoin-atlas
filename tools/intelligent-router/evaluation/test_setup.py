"""Portable setup preserves per-PC secrets/config and performs no external operations."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('router_setup', Path(__file__).resolve().parents[1] / 'adapters/setup.py')
setup = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(setup)


class SetupTests(unittest.TestCase):
    def fixture(self, root):
        (root / 'config').mkdir()
        model = root / 'model'
        model.mkdir()
        manifest = b'{"files_sha256":{}}'
        (model / 'MODEL_MANIFEST.json').write_bytes(manifest)
        (root / 'config/policy.json').write_text(json.dumps({'decision': {'manifest_sha256': hashlib.sha256(manifest).hexdigest()}}))
        return model

    def test_create_exact_repeat_preserves_and_other_config_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            model = self.fixture(root)
            self.assertEqual(setup.runtime_status(root), 'MISSING')
            self.assertEqual(setup.configure(sys.executable, model, 'cpu', root), 'CREATED')
            path = root / 'config/runtime.local.json'
            before = path.read_bytes()
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            self.assertEqual(setup.runtime_status(root), 'CONFIGURED')
            self.assertEqual(setup.configure(sys.executable, model, 'cpu', root), 'PRESERVED')
            with self.assertRaises(ValueError):
                setup.configure(sys.executable, model, 'mps', root)
            self.assertEqual(path.read_bytes(), before)

    def test_bad_manifest_missing_python_symlink_corruption_and_disabled(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            model = self.fixture(root)
            with self.assertRaises(ValueError):
                setup.configure(root / 'absent-python', model, 'cpu', root)
            (model / 'MODEL_MANIFEST.json').write_bytes(b'wrong')
            with self.assertRaises(ValueError):
                setup.configure(sys.executable, model, 'cpu', root)
            self.assertFalse((root / 'config/runtime.local.json').exists())
            (model / 'MODEL_MANIFEST.json').write_bytes(b'{"files_sha256":{}}')
            target = root / 'preserved.json'
            target.write_text('PRIVATE_SENTINEL')
            path = root / 'config/runtime.local.json'
            path.symlink_to(target)
            with self.assertRaises(ValueError):
                setup.configure(sys.executable, model, 'cpu', root)
            self.assertEqual(setup.runtime_status(root), 'INVALID')
            self.assertEqual(target.read_text(), 'PRIVATE_SENTINEL')
            path.unlink()
            for text in ['broken', '[]', '{}']:
                path.write_text(text)
                self.assertEqual(setup.runtime_status(root), 'INVALID')
            path.unlink()
            setup.configure(sys.executable, model, 'cpu', root)
            data = json.loads(path.read_text())
            data['enabled'] = False
            path.write_text(json.dumps(data))
            self.assertEqual(setup.runtime_status(root), 'DISABLED')

    def test_doctor_only_inspects_local_prerequisites(self):
        with tempfile.TemporaryDirectory() as temp, patch.dict(os.environ, {'HERDR_ENV': '0'}), patch.object(setup.shutil, 'which', return_value=None):
            root = Path(temp) / 'tools/intelligent-router'
            root.mkdir(parents=True)
            result = setup.check(root)
            self.assertFalse(result['insideHerdr'])
            self.assertEqual(result['runtime'], 'MISSING')
            self.assertEqual(result['agentsStarted'], 0)
            self.assertEqual(result['herdrSession'], 'NOT_INSPECTED')
            self.assertNotIn(str(root), json.dumps(result))
