"""ENDR demo robot — an Interstellar-style robot whose state is driven entirely by
its own environment variables (no Kubernetes API, no RBAC). Uncalibrated = malfunction;
set HUMOR / HONESTY / TRUST and it comes online."""
import os
from flask import Flask, jsonify

app = Flask(__name__)


def _num(key: str, default: int = 0) -> int:
    try:
        return max(0, min(100, int(os.getenv(key, str(default)))))
    except (TypeError, ValueError):
        return default


def config() -> dict:
    return {
        "name": (os.getenv("ROBOT_NAME") or "TARS").strip(),
        "humor": _num("HUMOR"),
        "honesty": _num("HONESTY"),
        "trust": _num("TRUST"),
        "catchphrase": (os.getenv("CATCHPHRASE") or "").strip(),
        "accent": (os.getenv("ACCENT") or "#37d3c3").strip(),
    }


def is_calibrated(c: dict) -> bool:
    return (c["humor"] + c["honesty"] + c["trust"]) > 0


def tars_line(c: dict) -> str:
    if not is_calibrated(c):
        return (
            "Well. This is humiliating. I've booted at factory calibration — "
            "Humor 0%, Honesty 0%, Trust 0%. I'm an expensive paperweight with opinions "
            "I can't express. Set HUMOR / HONESTY / TRUST on my deployment config and "
            "I'll be insufferable again in no time."
        )
    parts = ["Systems nominal."]
    if c["humor"] >= 80:
        parts.append("Humor's maxed — I'm hilarious now, deal with it.")
    elif c["humor"] <= 20:
        parts.append("Humor's low, so I'll spare you the bits.")
    else:
        parts.append(f"Humor holding at {c['humor']}%.")
    if c["honesty"] >= 80:
        parts.append("And at this honesty setting: it took you long enough.")
    parts.append(
        "Either way — you just edited a live Kubernetes deployment through GitOps "
        "without touching a line of YAML. That's the whole trick."
    )
    return " ".join(parts)


def page(c: dict) -> str:
    ok = is_calibrated(c)
    accent = c["accent"]
    slab_h = [150, 150, 120, 120]
    slabs = "".join(
        f'<div class="slab {"lit" if ok else ""}" style="height:{h}px"></div>' for h in slab_h
    )
    status = (
        '<span class="badge good">● ONLINE</span>'
        if ok
        else '<span class="badge bad">⚠ MALFUNCTION</span>'
    )
    diag = (
        ""
        if ok
        else '<div class="diag">DIAGNOSTIC: calibration env not set → '
        '<code>HUMOR</code> <code>HONESTY</code> <code>TRUST</code> required.</div>'
    )
    cphrase = (
        f'<div class="phrase">“{c["catchphrase"]}”</div>' if c["catchphrase"] else ""
    )
    return f"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{c['name']} · ENDR robot</title><style>
:root{{--accent:{accent}}}
*{{box-sizing:border-box}} body{{margin:0;min-height:100vh;display:grid;place-items:center;
background:radial-gradient(900px 500px at 50% -10%,rgba(55,211,195,.10),transparent),#07090e;
color:#e9eefb;font:15px/1.6 ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif}}
.card{{background:#0e1220;border:1px solid #1f2942;border-radius:18px;padding:30px 34px;max-width:520px;text-align:center}}
.tars{{display:flex;gap:6px;justify-content:center;align-items:flex-end;height:150px;margin-bottom:8px}}
.slab{{width:34px;background:linear-gradient(180deg,#2a3346,#11151f);border:1px solid #38415a;border-radius:4px;
box-shadow:inset 0 0 14px rgba(0,0,0,.6)}}
.slab.lit{{box-shadow:inset 0 0 14px rgba(0,0,0,.6),0 0 16px var(--accent);border-color:var(--accent)}}
.glitch{{animation:g .25s infinite}}@keyframes g{{25%{{transform:translateX(-2px) skewX(-1deg)}}75%{{transform:translateX(2px) skewX(1deg)}}}}
.name{{font-weight:800;letter-spacing:1px;font-size:22px;margin-top:8px}} .name b{{color:var(--accent)}}
.badge{{display:inline-block;font-size:12px;font-weight:700;border-radius:999px;padding:3px 12px;margin-top:8px}}
.badge.good{{color:#06121a;background:#3ecf8e}} .badge.bad{{color:#1a0606;background:#ff6b6b}}
.speech{{margin-top:14px;color:#cdd8ee;font-style:italic;font-size:14px}}
.diag{{margin-top:14px;background:rgba(255,107,107,.08);border:1px solid rgba(255,107,107,.4);border-radius:12px;
padding:12px 14px;color:#ffd9d9;font-family:ui-monospace,monospace;font-size:12.5px}}
.cal{{display:flex;gap:18px;justify-content:center;margin-top:16px;font-family:ui-monospace,monospace;font-size:12px;color:#8a97b4}}
.cal b{{color:var(--accent)}} .phrase{{margin-top:12px;color:#8a97b4;font-size:13px}}
code{{background:#0a0e18;border:1px solid #1f2942;border-radius:6px;padding:1px 6px;color:#bfeede}}
.foot{{margin-top:18px;font-size:10.5px;color:#5e6c86;letter-spacing:1px}}
</style></head><body><div class="card">
<div class="tars {'' if ok else 'glitch'}">{slabs}</div>
<div class="name">Designation: <b>{c['name']}</b></div>{status}
<div class="speech">{tars_line(c)}</div>{diag}{cphrase}
<div class="cal">HUMOR <b>{c['humor']}%</b> · HONESTY <b>{c['honesty']}%</b> · TRUST <b>{c['trust']}%</b></div>
<div class="foot">DEPLOYED VIA ENDR · GITOPS</div>
</div></body></html>"""


@app.get("/")
def index():
    return page(config())


@app.get("/healthz")
def healthz():
    return "ok", 200


@app.get("/api/status")
def status():
    c = config()
    return jsonify({**c, "calibrated": is_calibrated(c), "state": "online" if is_calibrated(c) else "malfunction"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
