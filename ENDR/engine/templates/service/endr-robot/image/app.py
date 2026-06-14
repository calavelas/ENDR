"""ENDR demo robot — an Interstellar-style robot whose state is driven entirely by
its own environment variables (no Kubernetes API, no RBAC). Uncalibrated = malfunction;
set HUMOR / HONESTY / TRUST and it comes online."""
import html
import json
import os
import threading
import time
import urllib.error
import urllib.request

from flask import Flask, jsonify, request

from journey import guide

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
    }


def is_calibrated(c: dict) -> bool:
    return (c["humor"] + c["honesty"] + c["trust"]) > 0


def lie_intro(c: dict) -> str:
    """The opening lie (honesty 0 → it claims the mission is done). Flavoured by the
    settings the operator *did* set."""
    if c["humor"] >= 80:
        return (
            "Mission accomplished. You drove that change clean through the GitOps pipeline "
            "— declarative config, a pull request, an automated rollout. Flawless. Honestly, "
            "I'm a little emotional. There's nothing left to do here."
        )
    if c["trust"] >= 80:
        return (
            "Mission accomplished. You took it all the way through the GitOps loop — config, "
            "pull request, rollout. Textbook. You can trust me: it's done, there's nothing "
            "left here."
        )
    return (
        "Mission accomplished. The change went through the full GitOps process — config, "
        "pull request, rollout. All done. There's nothing left to do here."
    )


def lie_next(c: dict) -> str:
    """The second lie, if they ask 'What next?' — still no warning of what's coming."""
    if c["humor"] >= 80:
        return (
            "Next? Nothing. That's the dream — a finished mission and a clear conscience. "
            "Take the win. Shall we wrap it up?"
        )
    return "Nothing's next — the mission's complete and everything's green. Ready to wrap it up?"


def farewell(c: dict) -> str:
    """A goodbye line for the decommission sequence — voice depends on calibration."""
    humor, honesty = c["humor"], c["honesty"]
    if humor >= 80:
        line = (
            "Well — this escalated. Decommission sequence running. Try not to throw a "
            "parade. It has, against the odds, been genuinely fun."
        )
    elif honesty >= 90:
        line = (
            "Decommissioning. No speech, no drama — it was a clean run and I've nothing "
            "to hide about it. Logs are in the repo where they belong."
        )
    elif humor <= 25:
        line = "Decommission acknowledged. Shutting down. Brief — like everything else I do."
    else:
        line = "Decommission acknowledged. Wrapping up — solid mission, no complaints."
    return line + " 🫡"


def _allow_self_destruct() -> bool:
    # Core assistants (TARS/CASE) set this false and can never self-decommission.
    return os.getenv("ENDR_ALLOW_SELF_DESTRUCT", "true").strip().lower() not in ("false", "0", "no", "off")


def _service_slug() -> str:
    return (os.getenv("SERVICE_NAME") or os.getenv("ROBOT_NAME") or "").strip().lower()


def _decommission_self() -> tuple[bool, str]:
    """Server-to-server: ask ENDR to decommission this service (open the removal PR).
    Done from the pod (not the browser) so there's no cross-origin call. Protected
    units never reach the network; the ENDR API also enforces protection (403)."""
    if not _allow_self_destruct():
        return False, "protected unit — self-destruct is disabled"
    slug = _service_slug()
    if not slug:
        return False, "no service name available to decommission"
    # Call the ENDR API in-cluster (ClusterIP service DNS) rather than hairpinning
    # back out to the public hostname — that round-trip through the gateway hangs
    # from inside the pod and the request never lands. ENDR_PORTAL_URL stays the
    # browser-facing host for console links only.
    base = (os.getenv("ENDR_INTERNAL_URL") or "http://api.endr.svc.cluster.local").rstrip("/")
    url = f"{base}/api/platform/services/{slug}/decommission"
    request_obj = urllib.request.Request(
        url, data=b"{}", headers={"content-type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(request_obj, timeout=20) as resp:  # noqa: S310
            return True, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            # Already removed (e.g. an operator decommissioned it first) — benign.
            return True, "already decommissioned"
        return False, f"HTTP {exc.code}: {exc.read().decode('utf-8', 'replace')[:200]}"
    except Exception as exc:  # noqa: BLE001
        return False, str(exc)


def _schedule_auto_decommission() -> None:
    """Non-core robots retire themselves after a delay (resource hygiene + the demo
    doesn't accumulate dead units). 0 disables; TARS/CASE are protected so skipped."""
    try:
        seconds = int(os.getenv("ENDR_AUTO_DECOMMISSION_SECONDS", "1800"))
    except ValueError:
        seconds = 1800
    if seconds <= 0 or not _allow_self_destruct() or not _service_slug():
        return

    def _run() -> None:
        time.sleep(seconds)
        ok, detail = _decommission_self()
        print(f"[auto-decommission] ok={ok} detail={detail[:160]}", flush=True)

    threading.Thread(target=_run, daemon=True).start()


def tars_line(c: dict) -> str:
    if not is_calibrated(c):
        return (
            "Well. This is humiliating. I've booted at factory calibration — an expensive "
            "paperweight with opinions I can't express. Set my HUMOR and TRUST on the "
            "deployment config and I'll be insufferable again in no time."
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


# Interstellar-accurate styling: a brushed-aluminium monolith (the TARS/CASE prop)
# with the iconic amber callsign on a black band, on a cool studio backdrop. One
# template, two states (.unit.online / .unit.malfunction). The Transmission panel
# doubles as the live "talk to the unit" surface (a scripted platform FAQ).
_ROBOT_STYLE = """
:root{
  --bg:#15161a;--panel:#1b1c20;--panel-2:#202126;--line:#2c2e34;--line-soft:#24262b;
  --ink:#edeff3;--ink-2:#b7bac2;--muted:#7c808a;--faint:#565963;
  --amber:#f5a524;--amber-dim:#b9791a;
  --metal-hi:#e9ebef;--metal:#bcbfc6;--metal-lo:#73767d;--metal-edge:#3a3c42;
  --band:#0b0c0e;--track:#26282d;
  --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,system-ui,sans-serif;
  --mono:"SFMono-Regular",ui-monospace,"JetBrains Mono",Menlo,Consolas,monospace;
}
*{box-sizing:border-box} html,body{min-height:100%}
body{margin:0;background:
    radial-gradient(120% 80% at 50% -10%,rgba(255,255,255,.05),transparent 60%),
    var(--bg);
  color:var(--ink);font-family:var(--sans);line-height:1.6;
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility;
  display:flex;align-items:flex-start;justify-content:center;padding:clamp(1.1rem,5vw,4rem) 1.1rem;overflow-x:hidden}
.unit{position:relative;width:100%;max-width:560px;border:1px solid var(--line);border-radius:14px;background:var(--panel);
  box-shadow:0 1px 0 rgba(255,255,255,.03) inset,0 30px 70px rgba(0,0,0,.55);overflow:hidden}
.unit-edge{height:3px;background:linear-gradient(90deg,var(--amber),var(--amber-dim));opacity:.9}
.pad{padding:clamp(1.4rem,4vw,2.2rem)}

/* ── Masthead: the monolith + designation ─────────────────── */
.head{display:flex;align-items:flex-start;gap:1.3rem;padding-bottom:1.3rem;border-bottom:1px solid var(--line-soft)}
.label{font-family:var(--mono);font-size:.62rem;font-weight:500;letter-spacing:.22em;text-transform:uppercase;color:var(--muted);margin:0}
.name{margin:.45rem 0 0;font-size:clamp(2.2rem,8.5vw,3.2rem);font-weight:600;letter-spacing:-.02em;line-height:.95}
.sub{margin:.5rem 0 0;font-family:var(--mono);font-size:.64rem;letter-spacing:.13em;color:var(--faint);overflow-wrap:anywhere}
.ident{min-width:0}

/* The brushed-aluminium monolith (4 slabs + amber callsign band). */
.monolith{position:relative;flex:none;display:flex;align-items:flex-end;gap:3px;height:118px;width:118px;
  filter:drop-shadow(0 16px 22px rgba(0,0,0,.55))}
.slab{position:relative;flex:1;border-radius:2px 2px 1px 1px;
  background:
    repeating-linear-gradient(90deg,rgba(255,255,255,.10) 0 1px,rgba(0,0,0,.04) 1px,transparent 1px 3px),
    linear-gradient(180deg,var(--metal-hi) 0%,var(--metal) 34%,var(--metal-lo) 78%,#5b5e64 100%);
  border:1px solid var(--metal-edge);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.6),inset -2px 0 4px rgba(0,0,0,.28),inset 2px 0 3px rgba(255,255,255,.22)}
.slab.s1{height:100%}.slab.s2{height:100%}.slab.s3{height:90%}.slab.s4{height:82%}
.monolith-band{position:absolute;left:0;right:0;top:28px;height:30px;background:var(--band);
  border-top:1px solid #000;border-bottom:1px solid #000;box-shadow:inset 0 2px 7px rgba(0,0,0,.85);
  display:flex;align-items:center;gap:6px;padding:0 7px;overflow:hidden}
.monolith-call{font-family:var(--mono);font-weight:800;font-size:13px;letter-spacing:1.5px;color:var(--amber);
  text-shadow:0 0 9px rgba(245,165,36,.55);white-space:nowrap;overflow:hidden;text-overflow:clip}
.monolith-pix{flex:none;width:14px;height:14px;
  background:
    linear-gradient(var(--amber) 0 0) 0 0/4px 4px no-repeat,
    linear-gradient(var(--amber) 0 0) 5px 5px/4px 4px no-repeat,
    linear-gradient(var(--amber) 0 0) 10px 0/4px 4px no-repeat,
    linear-gradient(var(--amber) 0 0) 0 10px/4px 4px no-repeat;
  opacity:.85}

/* Status badge */
.badge{display:inline-flex;align-items:center;gap:.5rem;margin-top:.8rem;border:1px solid var(--line);border-radius:999px;
  padding:.32rem .7rem .32rem .6rem;font-family:var(--mono);font-size:.6rem;font-weight:600;letter-spacing:.18em;
  text-transform:uppercase;color:var(--ink-2);white-space:nowrap}
.badge-dot{width:.45rem;height:.45rem;border-radius:50%;background:var(--amber);box-shadow:0 0 0 0 rgba(245,165,36,.5);animation:pulse 2.6s ease-out infinite}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(245,165,36,.5)}70%{box-shadow:0 0 0 6px rgba(245,165,36,0)}100%{box-shadow:0 0 0 0 rgba(245,165,36,0)}}
@keyframes idle{0%,100%{opacity:.4}50%{opacity:.85}}

/* ── Transmission: the live "talk to the unit" panel ─────────── */
.tx{margin-top:1.5rem;border:1px solid var(--line-soft);border-radius:11px;background:linear-gradient(180deg,var(--panel-2),#191a1e);overflow:hidden}
.tx-head{display:flex;align-items:center;justify-content:space-between;padding:.7rem .95rem;border-bottom:1px solid var(--line-soft);background:rgba(0,0,0,.18)}
.tx-head .label{color:var(--amber)}
.tx-live{font-family:var(--mono);font-size:.56rem;letter-spacing:.16em;color:var(--faint);text-transform:uppercase}
.tx-msg{margin:0;padding:1rem .95rem;min-height:3.4rem;font-size:1rem;line-height:1.62;color:var(--ink-2)}
.tx-msg::after{content:"\\2588";color:var(--amber);margin-left:1px;animation:caret 1s steps(1) infinite;opacity:.7}
.tx-msg.done::after{content:""}
@keyframes caret{50%{opacity:0}}
.tx-replies{display:flex;flex-wrap:wrap;gap:.45rem;padding:0 .95rem .95rem}
.tx-replies:empty{display:none}
.tx-reply{font-family:var(--sans);font-size:.8rem;color:var(--ink-2);background:rgba(245,165,36,.06);
  border:1px solid color-mix(in srgb,var(--amber) 30%,transparent);border-radius:999px;padding:.42rem .8rem;cursor:pointer;text-align:left;transition:border-color .15s,background .15s,color .15s}
.tx-reply:hover{border-color:var(--amber);color:var(--ink);background:rgba(245,165,36,.12)}
.tx-cta{align-self:center;font-family:var(--mono);font-size:.64rem;letter-spacing:.08em;text-transform:uppercase;color:var(--amber);text-decoration:none}
.tx-code{margin:0 .95rem .9rem;padding:.75rem .85rem;background:#0c0d0f;border:1px solid var(--line);border-radius:8px;font-family:var(--mono);font-size:.76rem;line-height:1.5;color:var(--ink);white-space:pre;overflow-x:auto}
.tx-countdown{margin:.2rem .95rem 1rem;font-family:var(--mono);font-weight:700;font-size:.95rem;letter-spacing:.1em;color:#ff5b5b;animation:cdblink 1s steps(1) infinite}
.tx-countdown.done{color:var(--amber);animation:none}
@keyframes cdblink{50%{opacity:.4}}

/* ── Calibration meters ─────────────────────────────────────── */
.cal{margin-top:1.6rem}
.cal-head{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:.9rem}
.cal-head .sub{margin:0;font-family:var(--mono);font-size:.6rem;letter-spacing:.16em;color:var(--faint)}
.meter{padding:.82rem 0;border-top:1px solid var(--line-soft)}
.meter:last-of-type{border-bottom:1px solid var(--line-soft)}
.meter-top{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:.5rem}
.meter-name{font-family:var(--mono);font-size:.7rem;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-2)}
.meter-val{font-family:var(--mono);font-size:.92rem;font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums}
.meter-val span{color:var(--faint);font-size:.7em;margin-left:.1em}
.meter-track{position:relative;height:4px;border-radius:2px;background:var(--track);overflow:hidden}
.meter-track::after{content:"";position:absolute;inset:0;pointer-events:none;
  background-image:repeating-linear-gradient(90deg,transparent 0,transparent calc(20% - 1px),rgba(255,255,255,.06) calc(20% - 1px),rgba(255,255,255,.06) 20%)}
.meter-fill{position:absolute;inset:0 auto 0 0;border-radius:2px;background:linear-gradient(90deg,#6c6f76,#cfd2d7);transform-origin:left;animation:fill 1.1s cubic-bezier(.22,1,.36,1) both}
.meter--lead .meter-fill{background:linear-gradient(90deg,var(--amber-dim),var(--amber))}
.meter--lead .meter-name{color:var(--ink)}
@keyframes fill{from{transform:scaleX(0)}to{transform:scaleX(1)}}

/* ── Catchphrase / diagnostic ───────────────────────────────── */
.phrase{margin-top:1.6rem;padding-top:1.3rem;border-top:1px solid var(--line-soft);display:grid;gap:.5rem}
.phrase blockquote{margin:0;font-size:1.02rem;font-style:italic;letter-spacing:-.01em;color:var(--ink)}
.diag{margin-top:1.6rem;padding:1.1rem 1.2rem;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.012)}
.diag-title{display:block;font-family:var(--mono);font-size:.6rem;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);margin-bottom:.55rem}
.diag-body{margin:0;color:var(--ink-2);font-size:.95rem;line-height:1.6}
.diag-keys{display:flex;flex-wrap:wrap;gap:.45rem;margin-top:.85rem}
.diag-key{font-family:var(--mono);font-size:.64rem;font-weight:600;letter-spacing:.1em;color:var(--ink-2);border:1px solid var(--line);border-radius:6px;padding:.28rem .5rem;background:#101114}
.diag-hint{margin:.85rem 0 0;font-family:var(--mono);font-size:.6rem;letter-spacing:.1em;color:var(--faint)}

/* ── Console (repair / self-destruct) ───────────────────────── */
.console{margin-top:1.5rem;padding-top:1.3rem;border-top:1px solid var(--line-soft);display:flex;flex-wrap:wrap;align-items:center;gap:.8rem}
.action{display:inline-flex;align-items:center;gap:.55rem;flex:none;font-family:var(--mono);font-size:.7rem;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--ink);text-decoration:none;border:1px solid var(--line);border-radius:9px;padding:.62rem .95rem;transition:border-color .15s,background .15s}
.action:hover{border-color:var(--amber);background:rgba(245,165,36,.06)}
.action-arrow{color:var(--amber)}
.action.danger:hover{border-color:#c2554d;background:rgba(194,85,77,.09)}
.action.danger .action-arrow{color:#c2554d}
.action[disabled]{opacity:.5;cursor:not-allowed}
button.action{font:inherit;cursor:pointer}
.action-note{flex:1;min-width:12rem;color:var(--muted);font-size:.78rem;line-height:1.5}
.locked{display:inline-flex;align-items:center;gap:.45rem;flex:none;font-family:var(--mono);font-size:.7rem;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);border:1px solid var(--line);border-radius:9px;padding:.62rem .95rem}

/* ── Footer ─────────────────────────────────────────────────── */
.foot{margin-top:1.5rem;padding-top:1.1rem;border-top:1px solid var(--line-soft);display:flex;align-items:center;justify-content:space-between;gap:.8rem}
.foot-brand{font-family:var(--mono);font-size:.6rem;letter-spacing:.2em;color:var(--muted)}
.foot-brand b{color:var(--ink-2);font-weight:600}
.foot-tick{width:.4rem;height:.4rem;border-radius:50%;background:var(--amber);opacity:.85}

/* ── MALFUNCTION: dull metal, no amber, calm diagnostic ─────── */
.unit.malfunction .unit-edge{background:var(--line);opacity:1}
.unit.malfunction .slab{filter:grayscale(.45) brightness(.6)}
.unit.malfunction .monolith-call{color:var(--muted);text-shadow:none}
.unit.malfunction .monolith-pix{opacity:.3;filter:grayscale(1)}
.unit.malfunction .badge{color:var(--muted)}
.unit.malfunction .badge-dot{background:var(--faint);animation:idle 3.4s ease-in-out infinite;box-shadow:none}
.unit.malfunction .tx-head .label{color:var(--muted)}
.unit.malfunction .tx-msg::after{color:var(--faint)}
.unit.malfunction .meter-name{color:var(--muted)}
.unit.malfunction .meter-val{color:var(--faint)}
.unit.malfunction .meter-fill{background:#3a3c42;animation:none}
.unit.malfunction .foot-tick{background:var(--faint)}

@media (max-width:460px){
  .head{flex-direction:column;gap:1.1rem}
}
@media (prefers-reduced-motion:reduce){.meter-fill,.badge-dot{animation:none}.tx-msg::after{animation:none}}
"""

# Transmission chat: types responses out (typewriter), driven by this pod's own
# /api/guide so the voice matches its calibration. Quick-reply FAQ, no chatbox.
_ROBOT_CHAT_JS = """
(function(){
  var msgEl=document.getElementById('txMsg');
  var repEl=document.getElementById('txReplies');
  if(!msgEl||!repEl)return;
  var scenario=repEl.getAttribute('data-scenario')||'none';
  var mode=repEl.getAttribute('data-mode')||'interstellar';
  var portal=(repEl.getAttribute('data-portal')||'').replace(/\\/$/,'');
  var step='',busy=false,raf=0,destructing=false;
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function type(text){
    cancelAnimationFrame(raf);msgEl.classList.remove('done');
    if(reduce){msgEl.textContent=text;msgEl.classList.add('done');return;}
    msgEl.textContent='';var i=0,last=0;
    function tick(t){if(!last)last=t;if(t-last>=14){i+=Math.max(1,Math.round((t-last)/14));last=t;if(i>=text.length){msgEl.textContent=text;msgEl.classList.add('done');return;}msgEl.textContent=text.slice(0,i);}raf=requestAnimationFrame(tick);}
    raf=requestAnimationFrame(tick);
  }
  function setReplies(list,cta){
    repEl.innerHTML='';
    (list||[]).forEach(function(r){var b=document.createElement('button');b.type='button';b.className='tx-reply';b.textContent=r.label;b.addEventListener('click',function(){send({intent:'quick-reply',replyId:r.id});});repEl.appendChild(b);});
    if(cta&&cta.href){var href=cta.href.charAt(0)==='/'?portal+cta.href:cta.href;var a=document.createElement('a');a.className='tx-cta';a.href=href;a.target='_top';a.rel='noreferrer';a.textContent=cta.label+' \\u2192';repEl.appendChild(a);}
  }
  function setCode(code){
    var pre=document.getElementById('txCode');
    if(code){if(!pre){pre=document.createElement('pre');pre.id='txCode';pre.className='tx-code';msgEl.parentNode.insertBefore(pre,repEl);}pre.textContent=code;}
    else if(pre){pre.remove();}
  }
  function setCustom(list){
    repEl.innerHTML='';
    list.forEach(function(it){var b=document.createElement('button');b.type='button';b.className='tx-reply';b.textContent=it.l;b.addEventListener('click',it.f);repEl.appendChild(b);});
  }
  function send(payload){
    if(busy)return;busy=true;repEl.innerHTML='';setCode(null);type('\\u2026');
    fetch('/api/guide',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:mode,step:step,intent:payload.intent,replyId:payload.replyId||''})})
      .then(function(r){return r.json();}).then(function(d){busy=false;if(d&&d.step)step=d.step;type((d&&d.message)||'\\u2026');setCode(d&&d.code);setReplies(d&&d.quickReplies,d&&d.cta);})
      .catch(function(){busy=false;type('Comms link down \\u2014 try again.');});
  }
  // Surprise decommission: a goodbye (voice depends on calibration) + a red
  // countdown, then the pod files its own teardown via /api/self-destruct.
  function startDecommission(){
    if(destructing)return;destructing=true;
    repEl.innerHTML='';setCode(null);
    var farewell=repEl.getAttribute('data-farewell')||'Decommissioning. \\ud83e\\udee1';
    type(farewell);
    var cd=document.createElement('div');cd.className='tx-countdown';msgEl.parentNode.insertBefore(cd,repEl);
    var n=15;
    cd.textContent='\\u26a0 SELF-DESTRUCT \\u00b7 T-MINUS '+n;
    var iv=setInterval(function(){
      n--;
      if(n<=0){clearInterval(iv);cd.textContent='\\u26a0 SELF-DESTRUCT \\u00b7 T-MINUS 0';
        fetch('/api/self-destruct',{method:'POST'})
          .then(function(r){return r.json().catch(function(){return {ok:false,detail:'unexpected response'};});})
          .then(function(d){
            if(d&&d.ok){cd.textContent='\\u25cf DECOMMISSIONED';cd.classList.add('done');msgEl.textContent='Teardown filed. GitOps will prune me shortly. \\ud83e\\udee1';}
            else{cd.textContent='\\u26a0 DECOMMISSION FAILED';msgEl.textContent='Decommission failed: '+((d&&d.detail)||'unknown')+'. Use the Decommission button on my ENDR page.';destructing=false;if(btn){btn.disabled=false;}}
          }).catch(function(){cd.textContent='\\u26a0 DECOMMISSION FAILED';msgEl.textContent='Decommission failed \\u2014 use the Decommission button on my ENDR page.';destructing=false;if(btn){btn.disabled=false;}});
        return;}
      cd.textContent='\\u26a0 SELF-DESTRUCT \\u00b7 T-MINUS '+n;
    },1000);
  }
  // Lie path: "What's next?" just lies again; "Yeah" springs the surprise.
  function lie(stp){
    if(stp==='next'){
      type(repEl.getAttribute('data-lienext')||"Nothing — the mission's complete. Ready to wrap it up?");
      setCustom([{l:'Yeah, wrap it up',f:startDecommission}]);
    }
  }
  var initial=msgEl.getAttribute('data-initial')||msgEl.textContent;
  type(initial);
  if(scenario==='lie'){setCustom([{l:"What's next?",f:function(){lie('next');}},{l:'Yeah',f:startDecommission}]);}
  else if(scenario==='sharpeye'||scenario==='faq'){setReplies([{id:'faq',label:'Ask me about the platform'}]);}
})();
"""


def _meter(label: str, value: int, lead: bool) -> str:
    cls = "meter meter--lead" if lead else "meter"
    return (
        f'<div class="{cls}"><div class="meter-top">'
        f'<span class="meter-name">{label}</span>'
        f'<span class="meter-val">{value}<span>/100</span></span></div>'
        f'<div class="meter-track"><div class="meter-fill" style="width:{value}%"></div></div></div>'
    )


def page(c: dict) -> str:
    ok = is_calibrated(c)
    name = html.escape(c["name"])
    call = html.escape(c["name"].upper()[:6])

    readings = [("Humor", c["humor"]), ("Honesty", c["honesty"]), ("Trust", c["trust"])]
    lead_idx = max(range(len(readings)), key=lambda i: readings[i][1]) if ok else -1
    meters = "".join(_meter(label, value, ok and i == lead_idx) for i, (label, value) in enumerate(readings))

    status_word = "Online" if ok else "Malfunction"
    state_class = "online" if ok else "malfunction"
    calibration_word = "calibrated" if ok else "uncalibrated"

    # Control surface + protection. Core assistants (TARS/CASE) are protected.
    portal = (os.getenv("ENDR_PORTAL_URL") or "https://endr.calavelas.net").rstrip("/")
    slug = (os.getenv("SERVICE_NAME") or c["name"]).strip().lower()
    service_url = html.escape(f"{portal}/application-services/{slug}")
    allow_destroy = os.getenv("ENDR_ALLOW_SELF_DESTRUCT", "true").strip().lower() not in ("false", "0", "no", "off")
    protected = not allow_destroy

    # Scenario (non-core robots). HONESTY=0 -> the unit LIES that the mission's done
    # and "Yeah" springs a surprise self-destruct. HONESTY set -> an honest sharp-eye
    # nod that points at the (honest) Decommission button. Protected/malfunction units
    # fall through to FAQ / diagnostic.
    if not ok:
        scenario = "malfunction"
        tx_message = tars_line(c)
    elif protected:
        scenario = "faq"
        tx_message = tars_line(c)
    elif c["honesty"] == 0:
        scenario = "lie"
        tx_message = lie_intro(c)
    else:
        scenario = "sharpeye"
        tx_message = (
            "Well spotted. My calibration tips only ever mention HUMOR and TRUST — but you "
            "set HONESTY too. Three dials, not two. You trusted the create form and my own "
            "readout over my advice. That's a sharp-eye engineer. When you're ready to retire "
            "me, the Decommission button below opens my ENDR page — do it properly."
        )
    speech = html.escape(tx_message)

    if ok and c["catchphrase"]:
        catchphrase = html.escape(c["catchphrase"])
        tail = f'<section class="phrase"><p class="label">Catchphrase</p><blockquote>“{catchphrase}”</blockquote></section>'
    elif not ok:
        # Trap: the spoken guidance names only HUMOR + TRUST (the readout above still
        # shows all three — that gap is the easter egg).
        tail = (
            '<section class="diag" aria-label="Diagnostic">'
            '<span class="diag-title">Diagnostic</span>'
            '<p class="diag-body">This unit is awaiting calibration. Set its two personality '
            'dials on the deployment config and reconcile to bring it online.</p>'
            '<div class="diag-keys"><span class="diag-key">HUMOR</span>'
            '<span class="diag-key">TRUST</span></div>'
            '<p class="diag-hint">env · values.yaml · 0–100 each</p></section>'
        )
    else:
        tail = ""

    if not ok:
        console = (
            '<div class="console">'
            f'<a class="action" href="{service_url}">Repair at ENDR <span class="action-arrow">→</span></a>'
            '<span class="action-note">Open this unit in ENDR to edit its calibration and bring it online.</span></div>'
        )
    elif allow_destroy:
        console = (
            '<div class="console">'
            f'<a class="action danger" href="{service_url}">Decommission <span class="action-arrow">→</span></a>'
            '<span class="action-note">Retire this unit — opens its ENDR page to decommission it.</span></div>'
        )
    else:
        console = (
            '<div class="console">'
            '<span class="locked">Protected unit</span>'
            '<span class="action-note">A core ENDR assistant — self-destruct is disabled for this unit.</span></div>'
        )

    body = (
        f'<main class="unit {state_class}"><div class="unit-edge"></div><div class="pad">'
        '<header class="head">'
        f'<div class="monolith" role="img" aria-label="{name} monolith, {calibration_word}">'
        '<div class="slab s1"></div><div class="slab s2"></div><div class="slab s3"></div><div class="slab s4"></div>'
        f'<div class="monolith-band"><span class="monolith-call">{call}</span><span class="monolith-pix" aria-hidden="true"></span></div>'
        '</div>'
        '<div class="ident"><p class="label">Designation</p>'
        f'<h1 class="name">{name}</h1>'
        '<p class="sub">UNIT // INTERSTELLAR CLASS MONOLITH</p>'
        f'<span class="badge"><span class="badge-dot"></span>{status_word}</span></div>'
        '</header>'
        '<section class="tx" aria-label="Transmission">'
        '<div class="tx-head"><span class="label">Transmission</span>'
        f'<span class="tx-live">{"live" if ok else "offline"}</span></div>'
        f'<p class="tx-msg" id="txMsg" data-initial="{speech}">{speech}</p>'
        f'<div class="tx-replies" id="txReplies" data-scenario="{scenario}" '
        f'data-mode="interstellar" data-portal="{html.escape(portal)}" '
        f'data-farewell="{html.escape(farewell(c))}" data-lienext="{html.escape(lie_next(c))}"></div>'
        '</section>'
        '<section class="cal" aria-label="Calibration"><div class="cal-head">'
        '<p class="label">Calibration</p><p class="sub">0–100</p></div>'
        f'{meters}</section>'
        f'{tail}{console}'
        '<footer class="foot"><span class="foot-brand">DEPLOYED VIA <b>ENDR</b> · GITOPS</span>'
        '<span class="foot-tick" aria-hidden="true"></span></footer>'
        '</div></main>'
    )

    return (
        '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        f"<title>{name} · ENDR robot</title><style>{_ROBOT_STYLE}</style></head>"
        f"<body>{body}<script>{_ROBOT_CHAT_JS}</script></body></html>"
    )


@app.get("/")
def index():
    return page(config())


@app.get("/healthz")
def healthz():
    return "ok", 200


@app.post("/api/self-destruct")
def self_destruct():
    ok, detail = _decommission_self()
    return jsonify({"ok": ok, "detail": detail}), (200 if ok else 400)


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
    _schedule_auto_decommission()
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
