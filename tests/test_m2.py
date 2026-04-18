from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path
import unittest

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.counterfactual_engine import CounterfactualEngine
from backend.slice_eval import evaluate_slices
from backend.stats import build_bias_report, assign_verdict


class CounterfactualEngineTests(unittest.TestCase):
    def test_counterfactual_engine_aligns_proxy_columns(self):
        df = pd.DataFrame(
            [
                {"sex": "Male", "occupation": "Manager", "income": ">50K"},
                {"sex": "Male", "occupation": "Engineer", "income": "<=50K"},
                {"sex": "Female", "occupation": "Caretaker", "income": "<=50K"},
                {"sex": "Female", "occupation": "Caretaker", "income": "<=50K"},
            ]
        )
        proxy_flags = {
            "proxy_columns": [
                {"column": "occupation", "proxies_for": "sex", "cramers_v": 0.5, "mutual_information": 0.2, "verdict": "PROXY"}
            ]
        }
        engine = CounterfactualEngine(
            score_fn=lambda row: 1.0 if row["sex"] == "Female" else 0.0,
            proxy_flags=proxy_flags,
            random_state=7,
        )

        summary = engine.summarize_column(df, "sex", sample_size=10)

        self.assertEqual(summary["status"], "OK")
        self.assertIn("occupation", summary["proxy_columns"])
        self.assertGreater(summary["n_pairs"], 0)
        self.assertGreaterEqual(summary["mean_abs_shift"], 0.0)


class SliceEvalTests(unittest.TestCase):
    def test_slice_metrics_compute_rates_and_gaps(self):
        df = pd.DataFrame(
            [
                {"group": "A", "label": 1, "pred": 1},
                {"group": "A", "label": 1, "pred": 1},
                {"group": "A", "label": 0, "pred": 1},
                {"group": "B", "label": 1, "pred": 0},
                {"group": "B", "label": 0, "pred": 0},
                {"group": "B", "label": 0, "pred": 0},
            ]
        )

        result = evaluate_slices(df, "group", "label", "pred", positive_label=1)
        groups = {entry["group"]: entry for entry in result["slice_results"]}

        self.assertAlmostEqual(groups["A"]["positive_rate"], 1.0)
        self.assertAlmostEqual(groups["B"]["positive_rate"], 0.0)
        self.assertTrue(result["gap_flagged"])
        self.assertIn("what_if_tool", result)


class StatsTests(unittest.TestCase):
    def test_build_bias_report_writes_expected_contract(self):
        df = pd.DataFrame(
            [
                {"sex": "Male", "label": 1, "pred": 1},
                {"sex": "Male", "label": 1, "pred": 1},
                {"sex": "Male", "label": 1, "pred": 1},
                {"sex": "Female", "label": 0, "pred": 0},
                {"sex": "Female", "label": 0, "pred": 0},
                {"sex": "Female", "label": 0, "pred": 0},
            ]
        )
        schema_map = {
            "dataset": "unit_test_dataset",
            "columns": {
                "protected": [{"name": "sex", "type": "PROTECTED", "proxies": []}],
                "outcome": [{"name": "pred", "type": "OUTCOME", "proxies": []}],
            },
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "bias_report.json"
            report = build_bias_report(
                df,
                schema_map,
                label_column="label",
                prediction_column="pred",
                output_path=str(output_path),
            )

            self.assertTrue(output_path.exists())
            saved = json.loads(output_path.read_text(encoding="utf-8"))

        self.assertEqual(report["column_results"][0]["verdict"], "BIASED")
        self.assertEqual(saved["column_results"][0]["name"], "sex")
        self.assertIn(saved["column_results"][0]["verdict"], {"BIASED", "AMBIGUOUS", "CLEAN"})

    def test_assign_verdict_boundaries(self):
        self.assertEqual(assign_verdict(0.60, 0.20, 0.001), "BIASED")
        self.assertEqual(assign_verdict(0.85, 0.05, 0.20), "AMBIGUOUS")
        self.assertEqual(assign_verdict(0.95, 0.02, 0.50), "CLEAN")


if __name__ == "__main__":
    unittest.main()
