"""ENDR demo robot — an Interstellar-style robot whose state is driven entirely by
its own environment variables (no Kubernetes API, no RBAC). Uncalibrated = malfunction;
set HUMOR / HONESTY / TRUST and it comes online."""
import html
import os
import re

from flask import Flask, jsonify, request

from journey import guide

_HEX_COLOR_RE = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")

app = Flask(__name__)


@app.after_request
def _cors(resp):
    # Permissive CORS so the guide endpoint can be hit directly during debugging
    # (curl / another origin). In production the portal calls it server-to-server
    # via its own proxy, so this is only a convenience — no flask-cors dependency.
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return resp


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


# A calm, monochrome "mission-control" spec sheet. One template, two states
# (.sheet.online / .sheet.malfunction) — MALFUNCTION is a deliberate uncalibrated
# boot, styled as a quiet diagnostic, never a red error.
_ROBOT_STYLE = """
:root{
  --accent:#37d3c3;--bg:#070708;--panel:#0b0b0d;--line:#1c1c20;--line-soft:#161619;
  --text:#f3f3f5;--text-2:#c9c9d0;--muted:#7c7c86;--faint:#54545c;--track:#1a1a1e;
  --slab-top:#1a1b20;--slab-bot:#0c0c10;
  --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,system-ui,sans-serif;
  --mono:"SFMono-Regular",ui-monospace,"JetBrains Mono",Menlo,Consolas,monospace;
}
*{box-sizing:border-box} html,body{min-height:100%}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--sans);line-height:1.6;
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility;
  display:flex;align-items:flex-start;justify-content:center;padding:clamp(1.1rem,5vw,4rem) 1.1rem;overflow-x:hidden}
body::before{content:"";position:fixed;inset:0;pointer-events:none;
  background:linear-gradient(rgba(255,255,255,.012) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.012) 1px,transparent 1px);
  background-size:46px 46px,46px 46px;
  mask-image:radial-gradient(120% 90% at 50% 0%,#000 30%,transparent 85%);
  -webkit-mask-image:radial-gradient(120% 90% at 50% 0%,#000 30%,transparent 85%)}
.sheet{position:relative;width:100%;max-width:560px;border:1px solid var(--line);border-radius:14px;background:var(--panel);
  box-shadow:0 1px 0 rgba(255,255,255,.02) inset,0 28px 70px rgba(0,0,0,.55);overflow:hidden}
.sheet__accent{height:2px;background:var(--accent);opacity:.85}
.pad{padding:clamp(1.4rem,4vw,2.2rem)}
.mast{display:flex;align-items:flex-start;justify-content:space-between;gap:1.2rem;padding-bottom:1.3rem;border-bottom:1px solid var(--line-soft)}
.label{font-family:var(--mono);font-size:.64rem;font-weight:500;letter-spacing:.22em;text-transform:uppercase;color:var(--muted);margin:0}
.designation{margin:.5rem 0 0;font-size:clamp(2.3rem,9vw,3.4rem);font-weight:600;letter-spacing:-.02em;line-height:.95}
.unit-id{margin:.55rem 0 0;font-family:var(--mono);font-size:.66rem;letter-spacing:.14em;color:var(--faint);overflow-wrap:anywhere}
.monolith{flex:none;display:flex;align-items:flex-end;gap:4px;height:74px;padding:7px;border:1px solid var(--line-soft);border-radius:9px;
  background:radial-gradient(120% 80% at 50% 0%,rgba(255,255,255,.035),transparent 70%),#0a0a0d}
.slab{position:relative;width:15px;border-radius:3px;background:linear-gradient(180deg,var(--slab-top),var(--slab-bot));border:1px solid #26262d;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06),inset 0 -10px 16px rgba(0,0,0,.5);overflow:hidden}
.slab::before{content:"";position:absolute;inset:0;
  background-image:repeating-linear-gradient(180deg,transparent 0,transparent 11px,rgba(255,255,255,.05) 11px,rgba(255,255,255,.05) 12px)}
.slab::after{content:"";position:absolute;left:50%;top:6px;transform:translateX(-50%);width:5px;height:5px;border-radius:1px;
  background:var(--accent);box-shadow:0 0 7px 1px rgba(55,211,195,.55);opacity:.9}
.slab.s1{height:100%}.slab.s2{height:100%}.slab.s3{height:72%}.slab.s4{height:72%}
.slab.s1::after,.slab.s4::after{opacity:.4;box-shadow:none;background:#3a3a44}
.badge{flex:none;display:inline-flex;align-items:center;gap:.5rem;border:1px solid var(--line);border-radius:999px;
  padding:.34rem .7rem .34rem .62rem;font-family:var(--mono);font-size:.62rem;font-weight:600;letter-spacing:.18em;
  text-transform:uppercase;color:var(--text-2);white-space:nowrap}
.badge__dot{width:.46rem;height:.46rem;border-radius:50%;background:var(--accent);box-shadow:0 0 0 0 rgba(55,211,195,.45);animation:pulse 2.6s ease-out infinite}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(55,211,195,.45)}70%{box-shadow:0 0 0 6px rgba(55,211,195,0)}100%{box-shadow:0 0 0 0 rgba(55,211,195,0)}}
@keyframes idle{0%,100%{opacity:.4}50%{opacity:.85}}
.mast__head{display:flex;align-items:flex-start;gap:1rem;min-width:0}
.speech{margin:1.4rem 0 0;padding-left:1rem;border-left:1px solid var(--line);color:var(--text-2);font-size:1.02rem;line-height:1.62}
.speech__lead{display:block;font-family:var(--mono);font-size:.6rem;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);margin-bottom:.55rem}
.cal{margin-top:1.7rem}
.cal__head{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:1rem}
.cal__head .sub{font-family:var(--mono);font-size:.6rem;letter-spacing:.16em;color:var(--faint)}
.meter{padding:.86rem 0;border-top:1px solid var(--line-soft)}
.meter:last-of-type{border-bottom:1px solid var(--line-soft)}
.meter__top{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:.55rem}
.meter__name{font-family:var(--mono);font-size:.7rem;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--text-2)}
.meter__val{font-family:var(--mono);font-size:.92rem;font-weight:600;letter-spacing:.02em;color:var(--text);font-variant-numeric:tabular-nums}
.meter__val span{color:var(--faint);font-size:.7em;margin-left:.1em}
.meter__track{position:relative;height:4px;border-radius:2px;background:var(--track);overflow:hidden}
.meter__track::after{content:"";position:absolute;inset:0;pointer-events:none;
  background-image:repeating-linear-gradient(90deg,transparent 0,transparent calc(20% - 1px),rgba(255,255,255,.05) calc(20% - 1px),rgba(255,255,255,.05) 20%)}
.meter__fill{position:absolute;inset:0 auto 0 0;border-radius:2px;background:linear-gradient(90deg,#5f5f68,#dededf);transform-origin:left;animation:fill 1.1s cubic-bezier(.22,1,.36,1) both}
.meter--lead .meter__fill{background:var(--accent)}
.meter--lead .meter__name{color:var(--text)}
@keyframes fill{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.phrase{margin-top:1.7rem;padding-top:1.3rem;border-top:1px solid var(--line-soft);display:grid;gap:.5rem}
.phrase blockquote{margin:0;font-size:1.04rem;font-style:italic;letter-spacing:-.01em;color:var(--text)}
.diag{margin-top:1.7rem;padding:1.1rem 1.2rem;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.012)}
.diag__title{display:block;font-family:var(--mono);font-size:.6rem;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);margin-bottom:.6rem}
.diag__body{margin:0;color:var(--text-2);font-size:.95rem;line-height:1.6}
.diag__keys{display:flex;flex-wrap:wrap;gap:.45rem;margin-top:.85rem}
.diag__key{font-family:var(--mono);font-size:.64rem;font-weight:600;letter-spacing:.1em;color:var(--text-2);border:1px solid var(--line);border-radius:6px;padding:.28rem .5rem;background:#0e0e11}
.diag__hint{margin:.85rem 0 0;font-family:var(--mono);font-size:.6rem;letter-spacing:.1em;color:var(--faint)}
.foot{margin-top:1.6rem;padding-top:1.1rem;border-top:1px solid var(--line-soft);display:flex;align-items:center;justify-content:space-between;gap:.8rem}
.foot__brand{font-family:var(--mono);font-size:.6rem;letter-spacing:.2em;color:var(--muted)}
.foot__brand b{color:var(--text-2);font-weight:600}
.foot__tick{width:.4rem;height:.4rem;border-radius:50%;background:var(--accent);opacity:.85}
.endr-console{margin-top:1.5rem;padding-top:1.3rem;border-top:1px solid var(--line-soft);display:flex;flex-wrap:wrap;align-items:center;gap:.8rem}
.endr-action{display:inline-flex;align-items:center;gap:.55rem;flex:none;font-family:var(--mono);font-size:.7rem;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--text);text-decoration:none;border:1px solid var(--line);border-radius:9px;padding:.62rem .95rem;transition:border-color .15s ease,background .15s ease}
.endr-action:hover{border-color:var(--accent);background:rgba(255,255,255,.03)}
.endr-action-arrow{color:var(--accent)}
.endr-action.danger:hover{border-color:#c2554d;background:rgba(194,85,77,.09)}
.endr-action.danger .endr-action-arrow{color:#c2554d}
.endr-action-note{flex:1;min-width:12rem;color:var(--muted);font-size:.78rem;line-height:1.5}
.endr-locked{display:inline-flex;align-items:center;gap:.45rem;flex:none;font-family:var(--mono);font-size:.7rem;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);border:1px solid var(--line);border-radius:9px;padding:.62rem .95rem}
.endr-chat-fab{position:fixed;right:18px;bottom:18px;z-index:40;display:inline-flex;align-items:center;gap:.5rem;font-family:var(--mono);font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--bg);background:var(--accent);border:none;border-radius:999px;padding:.72rem 1.15rem;cursor:pointer;box-shadow:0 12px 34px rgba(0,0,0,.5)}
.endr-chat-fab[hidden]{display:none}
.endr-chat-fab:hover{filter:brightness(1.08)}
.endr-chat{position:fixed;right:18px;bottom:18px;z-index:41;width:min(380px,calc(100vw - 36px));height:min(560px,calc(100vh - 36px));display:flex;flex-direction:column;background:var(--panel);border:1px solid var(--line);border-radius:16px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.6)}
.endr-chat[hidden]{display:none}
.endr-chat-head{display:flex;align-items:center;justify-content:space-between;padding:.85rem 1rem;border-bottom:1px solid var(--line-soft);flex:none}
.endr-chat-title{font-family:var(--mono);font-size:.72rem;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--text);display:inline-flex;align-items:center;gap:.55rem}
.endr-chat-title::before{content:"";width:.45rem;height:.45rem;border-radius:50%;background:var(--accent);box-shadow:0 0 8px 1px var(--accent)}
.endr-chat-close{background:none;border:none;color:var(--muted);font-size:1rem;cursor:pointer;line-height:1;padding:.2rem}
.endr-chat-close:hover{color:var(--text)}
.endr-chat-log{flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:.7rem}
.endr-bubble{font-size:.9rem;line-height:1.55;padding:.7rem .9rem;border-radius:13px;max-width:88%}
.endr-bubble.bot{align-self:flex-start;background:#141417;border:1px solid var(--line-soft);color:var(--text-2);border-bottom-left-radius:4px}
.endr-bubble.me{align-self:flex-end;background:var(--accent);color:var(--bg);border-bottom-right-radius:4px;font-weight:500}
.endr-chat-replies{display:flex;flex-wrap:wrap;gap:.45rem;padding:.8rem 1rem;border-top:1px solid var(--line-soft);flex:none}
.endr-reply{font-family:var(--sans);font-size:.78rem;color:var(--text-2);background:#101013;border:1px solid var(--line);border-radius:999px;padding:.42rem .8rem;cursor:pointer;text-align:left}
.endr-reply:hover{border-color:var(--accent);color:var(--text)}
.endr-chat-cta{align-self:center;font-family:var(--mono);font-size:.66rem;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);text-decoration:none}
@media (max-width:440px){.endr-chat{right:10px;left:10px;bottom:10px;width:auto;height:min(72vh,540px)}.endr-chat-fab{right:10px;bottom:10px}}
/* MALFUNCTION — accent suppressed, calm diagnostic, no red */
.sheet.malfunction .sheet__accent{background:var(--line);opacity:1}
.sheet.malfunction .slab::after{background:#2c2c33;box-shadow:none;opacity:.7}
.sheet.malfunction .badge{color:var(--muted)}
.sheet.malfunction .badge__dot{background:var(--faint);animation:idle 3.4s ease-in-out infinite}
.sheet.malfunction .meter__name{color:var(--muted)}
.sheet.malfunction .meter__val{color:var(--faint)}
.sheet.malfunction .meter__fill{background:#3a3a42;animation:none}
.sheet.malfunction .foot__tick{background:var(--faint)}
@media (max-width:440px){
  .mast{flex-direction:column;gap:1.2rem}
  .mast__head{flex-direction:row-reverse;justify-content:flex-end;align-items:flex-start}
  .badge{align-self:flex-start}
}
@media (prefers-reduced-motion:reduce){.meter__fill,.badge__dot{animation:none}}
"""

# Easter-egg chat client. Talks to this pod's own /api/guide (same origin), so the
# replies carry the unit's personality. Quick-reply driven (a scripted platform FAQ).
_ROBOT_CHAT_JS = """
(function(){
  var fab=document.querySelector('.endr-chat-fab');
  var panel=document.querySelector('.endr-chat');
  if(!fab||!panel)return;
  var log=panel.querySelector('.endr-chat-log');
  var replies=panel.querySelector('.endr-chat-replies');
  var mode=panel.getAttribute('data-mode')||'interstellar';
  var portal=(panel.getAttribute('data-portal')||'').replace(/\\/$/,'');
  var step='',busy=false,started=false;
  function bubble(text,who){var d=document.createElement('div');d.className='endr-bubble '+who;d.textContent=text;log.appendChild(d);log.scrollTop=log.scrollHeight;}
  function setReplies(list,cta){
    replies.innerHTML='';
    (list||[]).forEach(function(r){
      var b=document.createElement('button');b.type='button';b.className='endr-reply';b.textContent=r.label;
      b.addEventListener('click',function(){pick(r);});replies.appendChild(b);
    });
    if(cta&&cta.href){
      var href=cta.href.charAt(0)==='/'?portal+cta.href:cta.href;
      var a=document.createElement('a');a.className='endr-chat-cta';a.href=href;a.target='_top';a.rel='noreferrer';a.textContent=cta.label+' \\u2192';replies.appendChild(a);
    }
  }
  function render(data){if(data&&data.step)step=data.step;bubble((data&&data.message)||'\\u2026','bot');setReplies(data&&data.quickReplies,data&&data.cta);busy=false;}
  function send(payload){
    if(busy)return;busy=true;replies.innerHTML='';
    fetch('/api/guide',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:mode,step:step,intent:payload.intent,replyId:payload.replyId||''})})
      .then(function(r){return r.json();}).then(render).catch(function(){busy=false;bubble('Comms link down \\u2014 try again.','bot');});
  }
  function pick(r){bubble(r.label,'me');send({intent:'quick-reply',replyId:r.id});}
  function open(){panel.hidden=false;fab.hidden=true;if(!started){started=true;send({intent:'faq'});}}
  function close(){panel.hidden=true;fab.hidden=false;}
  fab.addEventListener('click',open);
  panel.querySelector('.endr-chat-close').addEventListener('click',close);
})();
"""


def _meter(label: str, value: int, lead: bool) -> str:
    cls = "meter meter--lead" if lead else "meter"
    return (
        f'<div class="{cls}"><div class="meter__top">'
        f'<span class="meter__name">{label}</span>'
        f'<span class="meter__val">{value}<span>/100</span></span></div>'
        f'<div class="meter__track"><div class="meter__fill" style="width:{value}%"></div></div></div>'
    )


def page(c: dict) -> str:
    ok = is_calibrated(c)
    name = html.escape(c["name"])
    accent = c["accent"] if _HEX_COLOR_RE.match(c["accent"] or "") else "#37d3c3"
    speech = html.escape(tars_line(c))

    readings = [("Humor", c["humor"]), ("Honesty", c["honesty"]), ("Trust", c["trust"])]
    lead_idx = max(range(len(readings)), key=lambda i: readings[i][1]) if ok else -1
    meters = "".join(_meter(label, value, ok and i == lead_idx) for i, (label, value) in enumerate(readings))

    status_word = "Online" if ok else "Malfunction"
    state_class = "online" if ok else "malfunction"
    calibration_word = "calibrated" if ok else "uncalibrated"

    if ok:
        catchphrase = html.escape(c["catchphrase"])
        tail = (
            f'<section class="phrase"><p class="label">Catchphrase</p>'
            f'<blockquote>“{catchphrase}”</blockquote></section>'
            if c["catchphrase"]
            else ""
        )
    else:
        tail = (
            '<section class="diag" aria-label="Diagnostic">'
            '<span class="diag__title">Diagnostic</span>'
            '<p class="diag__body">This unit is awaiting calibration. Set the three personality values '
            'on the deployment config and reconcile to bring it online.</p>'
            '<div class="diag__keys"><span class="diag__key">HUMOR</span>'
            '<span class="diag__key">HONESTY</span><span class="diag__key">TRUST</span></div>'
            '<p class="diag__hint">env · values.yaml · 0–100 each</p></section>'
        )

    # Link back to this unit's control surface in the ENDR portal. The portal base
    # is overridable (ENDR_PORTAL_URL); the service slug is the lowercased name
    # (overridable via SERVICE_NAME if the display name ever diverges).
    portal = (os.getenv("ENDR_PORTAL_URL") or "https://endr.calavelas.net").rstrip("/")
    slug = (os.getenv("SERVICE_NAME") or c["name"]).strip().lower()
    service_url = html.escape(f"{portal}/application-services/{slug}")
    # Core assistants (TARS/CASE) set ENDR_ALLOW_SELF_DESTRUCT=false so they can't be
    # decommissioned from their own page.
    allow_destroy = os.getenv("ENDR_ALLOW_SELF_DESTRUCT", "true").strip().lower() not in ("false", "0", "no", "off")
    if not ok:
        console = (
            '<div class="endr-console">'
            f'<a class="endr-action" href="{service_url}">'
            'Repair at ENDR <span class="endr-action-arrow">→</span></a>'
            '<span class="endr-action-note">Open this unit in ENDR to edit its calibration and bring it online.</span></div>'
        )
    elif allow_destroy:
        console = (
            '<div class="endr-console">'
            f'<a class="endr-action danger" href="{service_url}">'
            'Self-destruct <span class="endr-action-arrow">→</span></a>'
            '<span class="endr-action-note">Decommission this unit — open it in ENDR.</span></div>'
        )
    else:
        console = (
            '<div class="endr-console">'
            '<span class="endr-locked">Protected unit</span>'
            '<span class="endr-action-note">A core ENDR assistant — self-destruct is disabled for this unit.</span></div>'
        )

    # Easter egg: chat with the live unit about the platform (online units only).
    # Talks to this pod's own /api/guide, so the voice matches its calibration.
    chat = ""
    if ok:
        chat = (
            f'<button class="endr-chat-fab" type="button" style="--accent:{accent}" aria-label="Chat with {name}">Ask {name}</button>'
            f'<aside class="endr-chat" data-mode="interstellar" data-portal="{html.escape(portal)}" style="--accent:{accent}" hidden>'
            '<div class="endr-chat-head">'
            f'<span class="endr-chat-title">{name}</span>'
            '<button class="endr-chat-close" type="button" aria-label="Close">✕</button></div>'
            '<div class="endr-chat-log"></div>'
            '<div class="endr-chat-replies"></div></aside>'
            f"<script>{_ROBOT_CHAT_JS}</script>"
        )

    body = (
        f'<main class="sheet {state_class}" style="--accent:{accent}">'
        '<div class="sheet__accent"></div><div class="pad">'
        '<header class="mast"><div class="mast__head">'
        f'<div class="monolith" role="img" aria-label="{name} monolith, {calibration_word}">'
        '<div class="slab s1"></div><div class="slab s2"></div>'
        '<div class="slab s3"></div><div class="slab s4"></div></div>'
        '<div><p class="label">Designation</p>'
        f'<h1 class="designation">{name}</h1>'
        '<p class="unit-id">UNIT // INTERSTELLAR CLASS MONOLITH</p></div></div>'
        f'<span class="badge" aria-label="Status: {state_class}"><span class="badge__dot"></span>{status_word}</span>'
        '</header>'
        f'<p class="speech"><span class="speech__lead">Transmission</span>{speech}</p>'
        '<section class="cal" aria-label="Calibration"><div class="cal__head">'
        '<p class="label">Calibration</p><span class="sub">0–100</span></div>'
        f'{meters}</section>'
        f'{tail}'
        f'{console}'
        '<footer class="foot"><span class="foot__brand">DEPLOYED VIA <b>ENDR</b> · GITOPS</span>'
        '<span class="foot__tick" aria-hidden="true"></span></footer>'
        '</div></main>'
    )

    return (
        '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        f"<title>{name} · ENDR robot</title><style>{_ROBOT_STYLE}</style></head>"
        f"<body>{body}{chat}</body></html>"
    )


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


@app.route("/api/guide", methods=["GET", "POST", "OPTIONS"])
def api_guide():
    """Scripted, context-aware guidance turn. POST with a JSON body; GET with
    query params is supported for quick manual checks (curl/browser)."""
    if request.method == "OPTIONS":
        return ("", 204)
    if request.method == "POST":
        payload = request.get_json(silent=True) or {}
    else:
        payload = {
            "mode": request.args.get("mode"),
            "route": request.args.get("route"),
            "step": request.args.get("step"),
            "intent": request.args.get("intent"),
            "replyId": request.args.get("replyId"),
        }
    return jsonify(guide(payload, config()))


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
