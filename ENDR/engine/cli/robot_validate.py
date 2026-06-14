#!/usr/bin/env python3
"""robot-validate — policy-as-code guardrail for ENDR robot services (Phase B).

For every robot service (``generator.service.template == "endr-robot"``) this
checks that the calibration env is *well-formed*:

  * ``HUMOR`` / ``HONESTY`` / ``TRUST`` — when set, integers in ``0–100``
  * ``ACCENT``     — when set, a hex colour (e.g. ``#37d3c3``)
  * ``ROBOT_NAME`` — when set, a non-empty single-line name (<= 48 chars)
  * every env key is a valid environment-variable name; every value is scalar

It validates both calibration surfaces:

  * ``services.yaml`` ``overrides.env`` — the desired-state catalog (create PRs)
  * ``SVCS/<name>/chart/values.yaml`` ``env:`` — the rendered chart edited by the
    Day-2 *fix* flow (values-only PRs)

A robot whose ``HUMOR + HONESTY + TRUST`` is zero/absent is a **valid**
(uncalibrated) robot that boots MALFUNCTION — that is the demo's intended "break"
state, so it is reported as a NOTICE, never a failure. Only *malformed* values
fail the gate: you can't ship a broken (mis-configured) robot, but you can ship a
deliberately-uncalibrated one.

Exit code is ``1`` when any error is found, ``0`` otherwise — wire it as a required
status check in ``reconcile-pr.yml`` / ``config-edit-pr.yml``.
"""
from __future__ import annotations

import argparse
import json
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

ROBOT_TEMPLATE = "endr-robot"
NUMERIC_KEYS = ("HUMOR", "HONESTY", "TRUST")
ENV_KEY_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
INT_RE = re.compile(r"^-?\d+$")
HEX_COLOR_RE = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")
ROBOT_NAME_MAX = 48
CATCHPHRASE_MAX = 280


@dataclass(slots=True)
class RobotReport:
    name: str
    source: str
    errors: list[str] = field(default_factory=list)
    notices: list[str] = field(default_factory=list)
    calibrated: bool = False


def _numeric_contribution(report: RobotReport, key: str, value: Any) -> int:
    """Validate a calibration number; return its 0–100 contribution (0 if unset/bad)."""
    if value is None:
        return 0  # key present but empty -> treated as unset (contributes 0)
    if isinstance(value, bool):
        report.errors.append(f"{key} must be an integer 0-100 (got boolean {value!r})")
        return 0
    if isinstance(value, int):
        number = value
    elif isinstance(value, float):
        report.errors.append(f"{key} must be a whole number 0-100 (got {value!r})")
        return 0
    elif isinstance(value, str):
        stripped = value.strip()
        if stripped == "":
            return 0  # blank -> unset
        if not INT_RE.match(stripped):
            report.errors.append(f"{key} must be an integer 0-100 (got {value!r})")
            return 0
        number = int(stripped)
    else:
        report.errors.append(f"{key} must be an integer 0-100 (got {value!r})")
        return 0

    if number < 0 or number > 100:
        report.errors.append(f"{key} must be within 0-100 (got {number})")
        return 0
    return number


def validate_env(name: str, source: str, env: Any) -> RobotReport:
    report = RobotReport(name=name, source=source)
    if env is None:
        env = {}
    if not isinstance(env, dict):
        report.errors.append(f"env must be a mapping of NAME -> value (got {type(env).__name__})")
        return report

    # Generic env hygiene: valid names, scalar values.
    for key, value in env.items():
        if not isinstance(key, str) or not ENV_KEY_RE.match(key):
            report.errors.append(f"invalid env variable name: {key!r}")
            continue
        if isinstance(value, (dict, list)):
            report.errors.append(f"env value for {key!r} must be a scalar")

    # Calibration numbers.
    calibration_sum = 0
    for key in NUMERIC_KEYS:
        if key in env:
            calibration_sum += _numeric_contribution(report, key, env[key])

    # Identity.
    if env.get("ROBOT_NAME") is not None:
        raw_name = str(env["ROBOT_NAME"])
        trimmed = raw_name.strip()
        if not trimmed:
            report.errors.append("ROBOT_NAME must not be blank")
        elif len(trimmed) > ROBOT_NAME_MAX:
            report.errors.append(f"ROBOT_NAME must be <= {ROBOT_NAME_MAX} characters")
        elif "\n" in raw_name:
            report.errors.append("ROBOT_NAME must be a single line")

    # Accent colour.
    if env.get("ACCENT") is not None:
        accent = str(env["ACCENT"]).strip()
        if accent and not HEX_COLOR_RE.match(accent):
            report.errors.append(f"ACCENT must be a hex colour like #37d3c3 (got {env['ACCENT']!r})")

    # Catchphrase.
    if env.get("CATCHPHRASE") is not None:
        catchphrase = str(env["CATCHPHRASE"])
        if len(catchphrase) > CATCHPHRASE_MAX:
            report.errors.append(f"CATCHPHRASE must be <= {CATCHPHRASE_MAX} characters")

    report.calibrated = calibration_sum > 0
    if not report.calibrated and not report.errors:
        report.notices.append(
            f"{name} will boot MALFUNCTION (HUMOR + HONESTY + TRUST = 0); "
            "set HUMOR / HONESTY / TRUST to bring it online."
        )
    return report


def load_robot_services(repo_root: Path) -> list[dict[str, Any]]:
    svcs_path = repo_root / "services.yaml"
    if not svcs_path.exists():
        raise FileNotFoundError(f"services.yaml not found under {repo_root}")
    try:
        raw = yaml.safe_load(svcs_path.read_text(encoding="utf-8")) or {}
    except yaml.YAMLError as exc:
        # Surface as ValueError so main() reports it cleanly (exit 1) instead of a traceback.
        raise ValueError(f"services.yaml is not valid YAML: {exc}") from exc
    if not isinstance(raw, dict):
        raise ValueError("services.yaml root must be a mapping")
    entries = raw.get("services", [])
    if not isinstance(entries, list):
        raise ValueError("services.yaml 'services' must be a list")

    robots: list[dict[str, Any]] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        generator = entry.get("generator")
        service = generator.get("service") if isinstance(generator, dict) else None
        template = service.get("template") if isinstance(service, dict) else None
        if template == ROBOT_TEMPLATE:
            robots.append(entry)
    return robots


def validate_repo(repo_root: Path, only: set[str] | None, surface: str) -> list[RobotReport]:
    reports: list[RobotReport] = []
    for entry in load_robot_services(repo_root):
        name = entry.get("name")
        if not isinstance(name, str) or not name:
            continue
        if only is not None and name not in only:
            continue

        if surface in ("services", "both"):
            overrides = entry.get("overrides")
            env = overrides.get("env") if isinstance(overrides, dict) else None
            reports.append(validate_env(name, "services.yaml", env))

        if surface in ("chart", "both"):
            chart_values = repo_root / "SVCS" / name / "chart" / "values.yaml"
            if chart_values.exists():
                rel = f"SVCS/{name}/chart/values.yaml"
                try:
                    values = yaml.safe_load(chart_values.read_text(encoding="utf-8")) or {}
                except yaml.YAMLError as exc:
                    report = RobotReport(name=name, source=rel)
                    report.errors.append(f"values.yaml is not valid YAML: {exc}")
                    reports.append(report)
                    continue
                chart_env = values.get("env") if isinstance(values, dict) else None
                reports.append(validate_env(name, rel, chart_env))
    return reports


def write_github_output(values: dict[str, str]) -> None:
    output_path = os.getenv("GITHUB_OUTPUT")
    if not output_path:
        return
    with Path(output_path).open("a", encoding="utf-8") as handle:
        for key, value in values.items():
            handle.write(f"{key}={value}\n")


def emit_annotations(reports: list[RobotReport]) -> None:
    for report in reports:
        for error in report.errors:
            print(f"::error title=robot-validate ({report.name})::{report.source}: {error}")
        for notice in report.notices:
            print(f"::notice title=robot-validate ({report.name})::{notice}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="robot-validate: enforce ENDR robot calibration config is well-formed",
    )
    parser.add_argument("--repo-root", default=".")
    parser.add_argument(
        "--services",
        default=None,
        help="comma-separated robot services to validate (default: all robots). "
        "An explicit empty value validates nothing.",
    )
    parser.add_argument("--surface", choices=["services", "chart", "both"], default="both")
    args = parser.parse_args(argv)

    repo_root = Path(args.repo_root).resolve()
    os.environ.setdefault("IDP_REPO_ROOT", str(repo_root))

    only: set[str] | None
    if args.services is None:
        only = None
    else:
        only = {item.strip() for item in args.services.split(",") if item.strip()}

    try:
        reports = validate_repo(repo_root, only, args.surface)
    except (FileNotFoundError, ValueError) as exc:
        print(f"::error title=robot-validate::{exc}")
        print(json.dumps({"passed": False, "error": str(exc)}, indent=2))
        return 1

    emit_annotations(reports)

    error_count = sum(len(report.errors) for report in reports)
    notice_count = sum(len(report.notices) for report in reports)
    robot_names = sorted({report.name for report in reports})
    malfunctioning = sorted({report.name for report in reports if not report.calibrated and not report.errors})
    passed = error_count == 0

    summary = {
        "passed": passed,
        "surface": args.surface,
        "robotCount": len(robot_names),
        "robots": robot_names,
        "errorCount": error_count,
        "noticeCount": notice_count,
        "malfunctioning": malfunctioning,
        "reports": [
            {
                "name": report.name,
                "source": report.source,
                "calibrated": report.calibrated,
                "errors": report.errors,
                "notices": report.notices,
            }
            for report in reports
        ],
    }
    print(json.dumps(summary, indent=2))

    write_github_output(
        {
            "passed": "true" if passed else "false",
            "error_count": str(error_count),
            "notice_count": str(notice_count),
            "robot_count": str(len(robot_names)),
            "robots": ",".join(robot_names),
            "malfunctioning": ",".join(malfunctioning),
        }
    )

    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
