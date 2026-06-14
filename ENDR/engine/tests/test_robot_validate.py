#!/usr/bin/env python3
"""Tests for the robot-validate guardrail (Phase B).

Runnable two ways:
  * pytest:     pytest ENDR/engine/tests/test_robot_validate.py
  * standalone: python3 ENDR/engine/tests/test_robot_validate.py
"""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from engine.cli.robot_validate import main, validate_env


def test_calibrated_robot_passes() -> None:
    report = validate_env("tars", "services.yaml", {"HUMOR": "90", "HONESTY": "90", "TRUST": "70"})
    assert report.errors == []
    assert report.calibrated is True
    assert report.notices == []


def test_uncalibrated_is_notice_not_error() -> None:
    # The demo's intentional "break": a robot with no calibration boots MALFUNCTION.
    report = validate_env("kipp", "services.yaml", {"ROBOT_NAME": "kipp"})
    assert report.errors == []
    assert report.calibrated is False
    assert len(report.notices) == 1 and "MALFUNCTION" in report.notices[0]


def test_zero_calibration_is_allowed() -> None:
    report = validate_env("zero", "services.yaml", {"HUMOR": "0", "HONESTY": "0", "TRUST": "0"})
    assert report.errors == []
    assert report.calibrated is False


def test_out_of_range_fails() -> None:
    report = validate_env("bad", "services.yaml", {"HUMOR": "150"})
    assert any("0-100" in error for error in report.errors)


def test_non_integer_fails() -> None:
    assert validate_env("bad", "s", {"HONESTY": "abc"}).errors
    assert validate_env("bad", "s", {"TRUST": "50.5"}).errors
    assert validate_env("bad", "s", {"HUMOR": True}).errors  # bool is not a number


def test_blank_numeric_is_unset_not_error() -> None:
    report = validate_env("blank", "s", {"HUMOR": "", "HONESTY": None})
    assert report.errors == []
    assert report.calibrated is False


def test_bad_accent_and_name() -> None:
    assert any("ACCENT" in e for e in validate_env("b", "s", {"ACCENT": "blue"}).errors)
    assert any("ROBOT_NAME" in e for e in validate_env("b", "s", {"ROBOT_NAME": "  "}).errors)
    # Valid accents (3, 6 and 8 hex digits) pass.
    assert validate_env("b", "s", {"ACCENT": "#abc"}).errors == []
    assert validate_env("b", "s", {"ACCENT": "#37d3c3"}).errors == []


def test_env_hygiene() -> None:
    assert any("invalid env" in e for e in validate_env("b", "s", {"BAD KEY": "x"}).errors)
    assert any("scalar" in e for e in validate_env("b", "s", {"NESTED": {"a": 1}}).errors)
    assert any("mapping" in e for e in validate_env("b", "s", ["not", "a", "dict"]).errors)


def test_repo_run_ignores_non_robots_and_exit_codes() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "SVCS" / "okbot" / "chart").mkdir(parents=True)
        (root / "services.yaml").write_text(
            "services:\n"
            "- name: okbot\n"
            "  namespace: ns\n"
            "  environments: [env]\n"
            "  generator: {service: {template: endr-robot}, gitops: {template: helm-service}}\n"
            "  overrides: {env: {HUMOR: 50, HONESTY: 0, TRUST: 0}}\n"
            "- name: web\n"
            "  namespace: ns\n"
            "  environments: [env]\n"
            "  generator: {service: {template: python-fastapi}, gitops: {template: helm-service}}\n"
            "  overrides: {env: {HUMOR: '999'}}\n",  # not a robot -> ignored
            encoding="utf-8",
        )
        (root / "SVCS" / "okbot" / "chart" / "values.yaml").write_text(
            "env: {HUMOR: 50, HONESTY: 10, TRUST: 10}\n", encoding="utf-8"
        )
        assert main(["--repo-root", str(root)]) == 0

        # Break the chart only -> chart surface fails, services surface filterable.
        (root / "SVCS" / "okbot" / "chart" / "values.yaml").write_text(
            "env: {HUMOR: 200}\n", encoding="utf-8"
        )
        assert main(["--repo-root", str(root), "--surface", "chart"]) == 1
        assert main(["--repo-root", str(root), "--surface", "services"]) == 0
        assert main(["--repo-root", str(root), "--services", ""]) == 0  # validate nothing


def test_malformed_services_yaml_exits_cleanly() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "services.yaml").write_text("services: [unclosed\n", encoding="utf-8")
        # Must return exit code 1, not raise an uncaught yaml.YAMLError traceback.
        assert main(["--repo-root", str(root)]) == 1


def _run_standalone() -> int:
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    failures = 0
    for test in tests:
        try:
            test()
            print(f"PASS {test.__name__}")
        except AssertionError as exc:
            failures += 1
            print(f"FAIL {test.__name__}: {exc}")
    print(f"\n{len(tests) - failures}/{len(tests)} passed")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(_run_standalone())
