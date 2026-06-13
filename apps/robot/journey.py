"""Scripted guidance journey for the ENDR demo robot.

Pure stdlib — no extra dependencies. Two axes of variation:

  * PERSONA (witty TARS vs terse CASE) comes from the *pod's* environment
    (HUMOR / HONESTY / TRUST). It flavours the wording but never the content.
  * VOCABULARY (plain IDP vs Interstellar narrative) comes from each *request's*
    ``mode`` field — so a single image serves both narratives and both personas.

The portal sends the current ``route`` (pathname) plus an ``intent``; this module
maps that to a step in a small, linear tour and returns a ready-to-render bubble.
"""

# Linear tour. ``welcome`` doubles as the dashboard step (route "/").
ORDER = ["welcome", "create", "deploy", "catalog", "history", "done"]

# Route prefix -> step id. Mirrors the portal's matchPath(). "/" is handled
# explicitly in route_to_step() because it is a prefix of everything.
ROUTE_PREFIXES = [
    ("/create", "create"),
    ("/catalog", "catalog"),
    ("/services", "catalog"),
    ("/application-services", "catalog"),
    ("/platform-services", "catalog"),
    ("/history", "history"),
    ("/argocd", "deploy"),
]

# Per-step content. Text is written out fully per mode (no placeholder
# interpolation) so wording stays natural and there is nothing to mis-format.
STEPS = {
    "welcome": {
        "text": {
            "idp": (
                "Welcome aboard. This is ENDR — your internal developer platform. "
                "From here you create services, ship them to the cluster, and keep "
                "an eye on their health. Want the two-minute tour?"
            ),
            "interstellar": (
                "Welcome to the bridge. This is ENDR — mission control for your "
                "fleet. From here you build robots, launch them across the system, "
                "and keep them online. Want the two-minute tour?"
            ),
        },
        "cta": None,
        "replies": [
            {"id": "next", "label": {
                "idp": "Show me how to create a service",
                "interstellar": "Show me how to build a robot",
            }},
            {"id": "narrative_tip", "label": {
                "idp": "What's this Interstellar switch?",
                "interstellar": "Tell me about this switch",
            }},
            {"id": "help", "label": {
                "idp": "Wait — what are you?",
                "interstellar": "Wait — who are you two?",
            }},
        ],
    },
    "create": {
        "text": {
            "idp": (
                "Hit Create and pick a golden-path template. Name your service, "
                "choose a namespace, and ENDR scaffolds the repo, Dockerfile and "
                "Helm chart for you — no YAML by hand."
            ),
            "interstellar": (
                "Open the build bay and pick a blueprint. Name your robot, choose "
                "a planet, and ENDR forges the repo, Dockerfile and Helm chart for "
                "you — no YAML by hand."
            ),
        },
        "cta": {"href": "/create", "label": {
            "idp": "Open Create", "interstellar": "Open the build bay",
        }},
        "replies": [
            {"id": "next", "label": {
                "idp": "What happens after I create it?",
                "interstellar": "What happens after I build it?",
            }},
            {"id": "back", "label": "Back"},
        ],
    },
    "deploy": {
        "text": {
            "idp": (
                "Here's the trick: creating a service opens a pull request. Merge "
                "it and ArgoCD takes over — it syncs the deployment to the cluster "
                "and self-heals it. GitOps, no kubectl. You watch it go green under "
                "Observability."
            ),
            "interstellar": (
                "Here's the trick: building a robot opens a pull request. Merge it "
                "and the autopilot — ArgoCD — launches it to the cluster and keeps "
                "it alive. GitOps, no kubectl. Watch it go green under Deep-Space "
                "Telemetry."
            ),
        },
        "cta": {"href": "/argocd", "label": {
            "idp": "Open Observability", "interstellar": "Open telemetry",
        }},
        "replies": [
            {"id": "next", "label": {
                "idp": "Where do I see all my services?",
                "interstellar": "Where do I see the whole fleet?",
            }},
            {"id": "back", "label": "Back"},
        ],
    },
    "catalog": {
        "text": {
            "idp": (
                "Every service you deploy shows up in the Catalog with live status "
                "and health. Click one for its details, endpoint and current "
                "revision."
            ),
            "interstellar": (
                "Every robot you launch shows up in the Fleet with live status and "
                "health. Click one for its details, endpoint and current revision."
            ),
        },
        "cta": {"href": "/catalog", "label": {
            "idp": "Open Catalog", "interstellar": "Open the fleet",
        }},
        "replies": [
            {"id": "next", "label": {
                "idp": "How do I track changes over time?",
                "interstellar": "How do I read the mission log?",
            }},
            {"id": "back", "label": "Back"},
        ],
    },
    "history": {
        "text": {
            "idp": (
                "Delivery keeps the full trail — every pull request and pipeline "
                "run that shipped a change. It's your audit log: who changed what, "
                "and when."
            ),
            "interstellar": (
                "The Mission Log keeps the full trail — every pull request and "
                "pipeline run that shipped a change. Your record of who changed "
                "what, and when."
            ),
        },
        "cta": {"href": "/history", "label": {
            "idp": "Open Delivery", "interstellar": "Open the mission log",
        }},
        "replies": [
            {"id": "next", "label": "Is that the whole tour?"},
            {"id": "back", "label": "Back"},
        ],
    },
    "done": {
        "text": {
            "idp": (
                "That's the whole loop: create, deploy, observe, iterate. You just "
                "learned the platform. Go ship something."
            ),
            "interstellar": (
                "That's the whole loop: build, launch, observe, iterate. You just "
                "learned the platform. Go ship something — the fleet's waiting."
            ),
        },
        "cta": {"href": "/create", "label": {
            "idp": "Create a service", "interstellar": "Build a robot",
        }},
        "replies": [
            {"id": "restart", "label": {
                "idp": "Start over", "interstellar": "Run the tour again",
            }},
            {"id": "help", "label": "What are you, really?"},
        ],
    },
    # ── Meta nodes (reachable from anywhere; not part of the progress count) ──
    "help": {
        "text": {
            "idp": (
                "I'm {name}, and I'm not a chat bubble bolted onto a webpage — I'm "
                "a microservice running in this cluster. There are two of us, TARS "
                "and CASE: the same container image, two separate deployments. Flip "
                "the switch above my head and you're talking to a different pod."
            ),
            "interstellar": (
                "I'm {name}. I'm not faked into the page — I'm a microservice "
                "running right here in the cluster. Two of us crew this platform, "
                "TARS and CASE: one image, two deployments. Flip the switch above "
                "and you're talking to the other pod."
            ),
        },
        "cta": None,
        "replies": [
            {"id": "resume", "label": "Back to the tour"},
            {"id": "narrative_tip", "label": "And the Interstellar switch?"},
        ],
    },
    "narrative_tip": {
        "text": {
            "idp": (
                "See the IDP / Interstellar switch in the header? Flip it. Same "
                "platform, two framings — and I'll swap my vocabulary to match."
            ),
            "interstellar": (
                "See the IDP / Interstellar switch in the header? Flip it. Same "
                "platform, two framings — and I'll swap my vocabulary to match."
            ),
        },
        "cta": None,
        "replies": [
            {"id": "resume", "label": "Back to the tour"},
        ],
    },
}

MALFUNCTION = {
    "idp": (
        "Diagnostic: I booted at factory calibration — Humor 0%, Honesty 0%, "
        "Trust 0%. I'm a guide with nothing to say. Set HUMOR / HONESTY / TRUST "
        "on my deployment config and I'll come online."
    ),
    "interstellar": (
        "Diagnostic: factory calibration — Humor 0%, Honesty 0%, Trust 0%. An "
        "expensive paperweight with opinions I can't express. Set HUMOR / HONESTY "
        "/ TRUST on my deployment and I'll come back online."
    ),
}

# Persona flavour. High humor adds an aside; high honesty/trust add a closer.
# Asides are picked deterministically by step index (no randomness, so the same
# request always returns the same line — friendlier for demos and tests).
WITTY_ASIDES = [
    "I'd do it for you, but watching you learn is more entertaining.",
    "It's easier than it sounds. Most things are, once I explain them.",
    "No YAML was harmed in the making of this deployment.",
    "This is the part where you act impressed.",
    "I'm running at ninety percent humor, so pace yourself.",
    "Cooper would've skipped this step. Don't be Cooper.",
]
HONEST_CLOSER = "That's the honest version — no marketing gloss."
TRUST_CLOSER = "Take your time. I'll be right here."


def normalize_mode(mode):
    return "interstellar" if mode == "interstellar" else "idp"


def route_to_step(route):
    if not route or route == "/":
        return "welcome"
    for prefix, step in ROUTE_PREFIXES:
        if route == prefix or route.startswith(prefix + "/"):
            return step
    return "welcome"


def _calibrated(c):
    return (c.get("humor", 0) + c.get("honesty", 0) + c.get("trust", 0)) > 0


def _advance(step, delta):
    if step in ORDER:
        index = min(len(ORDER) - 1, max(0, ORDER.index(step) + delta))
        return ORDER[index]
    return ORDER[0] if delta > 0 else "welcome"


def _from_intent(step, intent, route):
    if intent in (None, "", "open"):
        return route_to_step(route)
    if intent == "next":
        return _advance(step, 1)
    if intent == "back":
        return _advance(step, -1)
    if intent == "restart":
        return "welcome"
    if intent == "help":
        return "help"
    if intent in ("narrative", "narrative_tip"):
        return "narrative_tip"
    if intent in STEPS:
        return intent
    return route_to_step(route)


def _resolve_target(step, intent, reply_id, route):
    if intent == "quick-reply" and reply_id:
        if reply_id == "resume":
            return step if step in ORDER else "welcome"
        if reply_id.startswith("goto:"):
            target = reply_id.split(":", 1)[1]
            return target if target in STEPS else "welcome"
        return _from_intent(step, reply_id, route)
    return _from_intent(step, intent, route)


def _label(label, mode):
    if isinstance(label, dict):
        return label.get(mode, label.get("idp", ""))
    return label


def _replies(node, mode):
    return [{"id": r["id"], "label": _label(r["label"], mode)} for r in node.get("replies", [])]


def _cta(node, mode):
    cta = node.get("cta")
    if not cta:
        return None
    return {"label": _label(cta["label"], mode), "href": cta["href"]}


def _context_clause(base, context, mode):
    try:
        count = int(context.get("servicesCount"))
    except (TypeError, ValueError, AttributeError):
        return base
    if count <= 0:
        return base
    noun = "robots" if mode == "interstellar" else "services"
    return base + f" Right now you've got {count} {noun} running."


def _flavor(base, c, idx):
    parts = [base]
    if c.get("humor", 0) >= 80:
        parts.append(WITTY_ASIDES[idx % len(WITTY_ASIDES)])
    if c.get("honesty", 0) >= 90:
        parts.append(HONEST_CLOSER)
    elif c.get("trust", 0) >= 80 and c.get("humor", 0) <= 40:
        parts.append(TRUST_CLOSER)
    return " ".join(parts)


def _message(target, node, mode, c, context):
    base = node["text"].get(mode, node["text"]["idp"]).replace("{name}", c.get("name", "TARS"))
    if target == "welcome":
        base = _context_clause(base, context, mode)
    idx = ORDER.index(target) if target in ORDER else len(WITTY_ASIDES) - 1
    return _flavor(base, c, idx)


def _malfunction(mode, meta):
    return {
        **meta,
        "state": "malfunction",
        "step": "malfunction",
        "progress": None,
        "message": MALFUNCTION.get(mode, MALFUNCTION["idp"]),
        "quickReplies": [{"id": "restart", "label": "Try again"}],
        "cta": None,
    }


def guide(payload, c):
    """Resolve one guidance turn.

    ``payload`` is the request dict ({mode, route, step, intent, replyId,
    context}); ``c`` is the robot's config() dict (name/humor/honesty/trust/...).
    Returns a JSON-serialisable response bubble.
    """
    payload = payload or {}
    mode = normalize_mode(payload.get("mode"))
    intent = (payload.get("intent") or "open").strip()
    reply_id = (payload.get("replyId") or "").strip()
    route = payload.get("route") or "/"
    step = payload.get("step") or ""
    context = payload.get("context") or {}

    meta = {
        "persona": c.get("name", "TARS"),
        "accent": c.get("accent", "#37d3c3"),
        "calibrated": _calibrated(c),
        "humor": c.get("humor", 0),
        "honesty": c.get("honesty", 0),
        "trust": c.get("trust", 0),
    }

    if not _calibrated(c):
        return _malfunction(mode, meta)

    target = _resolve_target(step, intent, reply_id, route)
    node = STEPS.get(target, STEPS["welcome"])
    progress = None
    if target in ORDER:
        progress = {"index": ORDER.index(target) + 1, "total": len(ORDER)}

    return {
        **meta,
        "state": "online",
        "step": target,
        "progress": progress,
        "message": _message(target, node, mode, c, context),
        "quickReplies": _replies(node, mode),
        "cta": _cta(node, mode),
    }
