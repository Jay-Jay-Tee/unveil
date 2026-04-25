"""
tests/test_api.py
Backend API tests using FastAPI's TestClient.

Auth is disabled via AUTH_REQUIRED=false so tests run without Firebase.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
import io
import unittest

# Disable Firebase auth for testing
os.environ["AUTH_REQUIRED"] = "false"

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient
from backend.api import app

client = TestClient(app)


class HealthEndpointTests(unittest.TestCase):
    def test_health_returns_ok(self):
        response = client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ok")
        self.assertIn("model_loaded", data)
        self.assertIn("gemini_key_set", data)

    def test_health_model_loaded_is_bool(self):
        response = client.get("/health")
        self.assertIsInstance(response.json()["model_loaded"], bool)

    def test_health_gemini_key_set_is_bool(self):
        response = client.get("/health")
        self.assertIsInstance(response.json()["gemini_key_set"], bool)


class PredictEndpointTests(unittest.TestCase):
    def test_predict_returns_prediction_and_probability(self):
        response = client.post("/predict", json={"features": {}})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("prediction", data)
        self.assertIn("probability", data)

    def test_predict_prediction_is_0_or_1(self):
        response = client.post("/predict", json={"features": {"age": 30}})
        self.assertIn(response.json()["prediction"], [0, 1])

    def test_predict_probability_between_0_and_1(self):
        response = client.post("/predict", json={"features": {"age": 30}})
        prob = response.json()["probability"]
        self.assertGreaterEqual(prob, 0.0)
        self.assertLessEqual(prob, 1.0)

    def test_predict_accepts_empty_features(self):
        response = client.post("/predict", json={})
        self.assertEqual(response.status_code, 200)

    def test_predict_with_multiple_features(self):
        features = {
            "age": 35,
            "sex": "Male",
            "education": "Bachelors",
            "hours-per-week": 40,
        }
        response = client.post("/predict", json={"features": features})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("prediction", data)
        self.assertIn("probability", data)


class AnalyzeDatasetAuthTests(unittest.TestCase):
    """
    When AUTH_REQUIRED is false the endpoint still needs a valid CSV file.
    These tests verify authentication is bypassed and the endpoint processes
    the request (it will fail on Gemini or pipeline steps, but not on auth).
    """

    def test_analyze_dataset_without_file_returns_422(self):
        # No file at all → FastAPI validation error
        response = client.post("/analyze/dataset")
        self.assertEqual(response.status_code, 422)

    def test_analyze_dataset_with_minimal_csv_does_not_return_401(self):
        csv_bytes = b"age,sex,income\n30,Male,>50K\n25,Female,<=50K\n"
        response = client.post(
            "/analyze/dataset",
            files={"file": ("test.csv", io.BytesIO(csv_bytes), "text/csv")},
        )
        # Auth is disabled, so we must not get 401; any other status is fine
        self.assertNotEqual(response.status_code, 401)


class SafeJsonTests(unittest.TestCase):
    """Unit tests for the safe_json serialisation helper in pipeline.py."""

    def setUp(self):
        from backend.pipeline import safe_json
        self.safe_json = safe_json

    def test_converts_numpy_int(self):
        import numpy as np
        result = self.safe_json({"v": np.int64(42)})
        self.assertEqual(result["v"], 42)
        self.assertIsInstance(result["v"], int)

    def test_converts_numpy_float(self):
        import numpy as np
        result = self.safe_json({"v": np.float64(3.14)})
        self.assertAlmostEqual(result["v"], 3.14, places=5)
        self.assertIsInstance(result["v"], float)

    def test_converts_numpy_bool(self):
        import numpy as np
        result = self.safe_json({"v": np.bool_(True)})
        self.assertEqual(result["v"], True)
        self.assertIsInstance(result["v"], bool)

    def test_replaces_nan_with_none(self):
        result = self.safe_json({"v": float("nan")})
        self.assertIsNone(result["v"])

    def test_replaces_inf_with_none(self):
        result = self.safe_json({"v": float("inf")})
        self.assertIsNone(result["v"])

    def test_handles_nested_structures(self):
        import numpy as np
        obj = {"outer": [{"inner": np.int64(7)}, float("nan")]}
        result = self.safe_json(obj)
        self.assertEqual(result["outer"][0]["inner"], 7)
        self.assertIsNone(result["outer"][1])

    def test_plain_python_types_pass_through(self):
        obj = {"s": "hello", "i": 1, "f": 2.5, "b": True, "n": None}
        self.assertEqual(self.safe_json(obj), obj)


if __name__ == "__main__":
    unittest.main()
