import importlib.util
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch


class VoiceInitializationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory(prefix="aldus-wrapper-test-")
        cls.addClassCleanup(cls.directory.cleanup)
        spec = importlib.util.spec_from_file_location(
            "xtts_wrapper", Path(__file__).with_name("xtts_wrapper.py")
        )
        cls.wrapper = importlib.util.module_from_spec(spec)
        with patch.dict(os.environ, {"ALDUS_LOCAL_DATA_DIR": cls.directory.name}):
            spec.loader.exec_module(cls.wrapper)

    def setUp(self):
        self.wrapper.MODEL = None
        self.wrapper.VOICES = {}
        self.wrapper._set_init_status(
            35, "Import", model_loaded=False, ready=False
        )
        self.environment = patch.dict(os.environ, {"ALDUS_TTS_VOICES": ""})
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def test_loaded_model_indexes_voices_before_ready(self):
        self.wrapper.MODEL = SimpleNamespace(speakers=["Voix A", "Voix B"])
        self.wrapper._set_init_status(85, "Modele charge", model_loaded=True)

        result = self.wrapper.list_voices()

        self.assertEqual([voice["id"] for voice in result["voices"]], ["Voix A", "Voix B"])
        self.assertTrue(self.wrapper.health()["ready"])
        self.assertTrue(self.wrapper.status()["model_loaded"])
        self.assertIsNone(self.wrapper.status()["error"])
        self.assertEqual(self.wrapper.list_voices(), result)

    def test_loading_model_returns_503(self):
        with self.assertRaises(self.wrapper.HTTPException) as raised:
            self.wrapper.list_voices()
        self.assertEqual(raised.exception.status_code, 503)
        self.assertEqual(raised.exception.detail, "Import")
        self.assertFalse(self.wrapper.health()["ready"])

    def test_initialization_failure_preserves_error(self):
        self.wrapper._set_init_status(0, "Echec", error="Dependency missing")
        with self.assertRaises(self.wrapper.HTTPException) as raised:
            self.wrapper.list_voices()
        self.assertEqual(raised.exception.status_code, 503)
        self.assertEqual(raised.exception.detail, "Dependency missing")

    def test_loaded_flag_without_model_returns_503(self):
        self.wrapper._set_init_status(85, "Modele charge", model_loaded=True)
        with self.assertRaises(self.wrapper.HTTPException) as raised:
            self.wrapper.list_voices()
        self.assertEqual(raised.exception.status_code, 503)

    def test_profile_indexing_failure_is_logged_and_reported(self):
        self.wrapper.MODEL = SimpleNamespace(speakers=[])
        self.wrapper._set_init_status(85, "Modele charge", model_loaded=True)
        with self.assertLogs(self.wrapper.LOGGER, level="ERROR"):
            with self.assertRaises(self.wrapper.HTTPException) as raised:
                self.wrapper.list_voices()
        self.assertEqual(raised.exception.status_code, 503)
        self.assertIn("RuntimeError", self.wrapper.status()["error"])
        self.assertFalse(self.wrapper.health()["ready"])


if __name__ == "__main__":
    unittest.main()
