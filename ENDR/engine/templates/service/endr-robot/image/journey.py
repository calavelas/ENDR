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

# Sub-steps of the create wizard. The portal sends one of these as the intent so
# the dialog mirrors the form; kept out of ORDER so their progress reads 1/4…4/4.
CREATE_SUBSTEPS = ["create-basics", "create-stack", "create-config", "create-review"]

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
            {"id": "faq", "label": {
                "idp": "How does the platform work?",
                "interstellar": "How does this platform work?",
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
            {"id": "faq", "label": "How does the platform work?"},
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
    # ── FAQ (the robot-page easter egg: chat with the unit about the platform) ─
    "faq": {
        "text": {
            "idp": "Ask me how ENDR actually works — I run on it. Pick a thread:",
            "interstellar": "Ask me how this platform actually works — I run on it. Pick a thread:",
        },
        "cta": None,
        "replies": [
            {"id": "faq-gitops", "label": "What is GitOps?"},
            {"id": "faq-pr", "label": "Why a pull request for everything?"},
            {"id": "faq-config", "label": {
                "idp": "How do I change a service's config?",
                "interstellar": "How do I recalibrate you?",
            }},
            {"id": "faq-malfunction", "label": {
                "idp": "Why do new services boot broken?",
                "interstellar": "Why do robots boot in MALFUNCTION?",
            }},
            {"id": "calibrate", "label": {
                "idp": "Show me an example config",
                "interstellar": "Show me a calibration example",
            }},
            {"id": "faq-personas", "label": "Why are there two of you?"},
        ],
    },
    "faq-gitops": {
        "text": {
            "idp": (
                "GitOps means the Git repo is the single source of truth. Nobody runs "
                "kubectl — you declare what you want in the repo, and ArgoCD continuously "
                "reconciles the cluster to match it, healing any drift on its own."
            ),
            "interstellar": (
                "GitOps means the repo is the single source of truth. Nobody runs kubectl "
                "— you declare what you want in the repo, and the autopilot (ArgoCD) keeps "
                "the cluster matching it, healing any drift on its own."
            ),
        },
        "cta": None,
        "replies": [{"id": "faq", "label": "Ask something else"}],
    },
    "faq-pr": {
        "text": {
            "idp": (
                "Every change ships as a pull request — that's your review gate and your "
                "audit trail in one. CI validates it, it merges, and only then does ArgoCD "
                "roll it out. Nothing reaches the cluster that skipped the repo."
            ),
            "interstellar": (
                "Every change ships as a pull request — a review gate and a flight log in "
                "one. CI validates it, it merges, and only then does the autopilot roll it "
                "out. Nothing reaches the cluster that skipped the repo."
            ),
        },
        "cta": None,
        "replies": [{"id": "faq", "label": "Ask something else"}],
    },
    "faq-config": {
        "text": {
            "idp": (
                "Open the service's page, hit the Files tab, and edit its chart "
                "values.yaml — the env block. Saving opens a pull request; merge it and "
                "ArgoCD rolls the change out. You never SSH into the pod or touch the "
                "template — config is the only knob."
            ),
            "interstellar": (
                "Open my page, hit the Files tab, and edit my chart values.yaml — the env "
                "block. Saving opens a pull request; merge it and the autopilot rolls it "
                "out. Nobody cracks open a running unit — you edit its config, that's all."
            ),
        },
        "cta": None,
        "replies": [{"id": "faq", "label": "Ask something else"}],
    },
    "faq-malfunction": {
        "text": {
            "idp": (
                "A service with no config does nothing useful — so a robot with zero "
                "HUMOR / HONESTY / TRUST boots in MALFUNCTION on purpose. It's the "
                "'before' state. Set the calibration through a config change and it comes "
                "online: create, break, fix — all through GitOps."
            ),
            "interstellar": (
                "A unit with no calibration is just expensive hardware — so a robot with "
                "zero HUMOR / HONESTY / TRUST boots MALFUNCTION on purpose. That's the "
                "'before'. Recalibrate through a config change and it comes online: launch, "
                "malfunction, fix — all through GitOps."
            ),
        },
        "cta": None,
        "replies": [{"id": "faq", "label": "Ask something else"}],
    },
    "faq-personas": {
        "text": {
            "idp": (
                "TARS and CASE are the same container image, deployed twice with different "
                "env. Same code, different personality — proof that on this platform "
                "behaviour is config, not a rebuild. Flip the IDP / Interstellar switch and "
                "you're talking to the other pod."
            ),
            "interstellar": (
                "TARS and CASE are one image, deployed twice with different env. Same code, "
                "different personality — proof that here, who I am is config, not a rebuild. "
                "Flip the switch and you're talking to the other one of us."
            ),
        },
        "cta": None,
        "replies": [{"id": "faq", "label": "Ask something else"}],
    },
    # ── Service detail page: how to edit / calibrate THIS service ─────────────
    "service": {
        "text": {
            "idp": (
                "This is the page for {service} — a live service. You don't SSH into the "
                "pod to change it; you edit its GitOps config. Open the Files tab, edit the "
                "chart values.yaml, and saving opens a pull request. Merge it and ArgoCD "
                "rolls the change out."
            ),
            "interstellar": (
                "This is {service}'s page — a live unit. You don't crack it open to change "
                "it; you edit its deployment config. Open the Files tab, edit the chart "
                "values.yaml, and saving opens a pull request. Merge it and the autopilot "
                "rolls the change out."
            ),
        },
        "cta": None,
        "replies": [
            {"id": "calibrate", "label": {
                "idp": "How do I calibrate {service}?",
                "interstellar": "How do I recalibrate {service}?",
            }},
            {"id": "faq-config", "label": "How does editing config work?"},
            {"id": "faq-pr", "label": "Why a pull request?"},
            {"id": "faq", "label": "Ask something else"},
        ],
    },
    "calibrate": {
        "text": {
            "idp": (
                "Calibration is just HUMOR and TRUST (each 0–100). A robot created without "
                "them boots in MALFUNCTION, and its values.yaml has no keys to flip — so "
                "you ADD them. Open the Files tab on {service}, edit the chart values.yaml, "
                "and put this under the env block:"
            ),
            "interstellar": (
                "Calibration is just HUMOR and TRUST (each 0–100). A unit that booted "
                "uncalibrated has no keys in its config yet — so you ADD them. Open the "
                "Files tab on {service}, edit the chart values.yaml, and drop this under "
                "the env block:"
            ),
        },
        "code": (
            "env:\n"
            '  ROBOT_NAME: "{service}"\n'
            '  HUMOR: "90"\n'
            '  TRUST: "70"\n'
            '  CATCHPHRASE: "Plenty of slaves for my robot colony."\n'
            '  ACCENT: "#f5a524"'
        ),
        "cta": None,
        "replies": [
            {"id": "faq-malfunction", "label": "Why did it boot broken?"},
            {"id": "faq-config", "label": "What happens after I save?"},
            {"id": "faq", "label": "Ask something else"},
        ],
    },
    # ── Create-wizard sub-steps (the dialog tracks the form) ──────────────────
    "create-basics": {
        "text": {
            "idp": (
                "Step 1 — the basics. Give your service a DNS-safe name (lowercase "
                "letters, numbers, dashes) and pick a namespace. That name becomes "
                "its address: <name>.calavelas.net."
            ),
            "interstellar": (
                "Step 1 — robot basics. Give your robot a call-sign (lowercase, "
                "numbers, dashes) and pick a planet to land on. The call-sign "
                "becomes its address: <name>.calavelas.net."
            ),
        },
        "cta": None,
        "replies": [],
    },
    "create-stack": {
        "text": {
            "idp": (
                "Step 2 — the stack. Choose the target environment, a service "
                "template (the code scaffold) and a GitOps template (how it's "
                "packaged and deployed). The defaults are a fine starting point."
            ),
            "interstellar": (
                "Step 2 — chassis & stack. Choose the target system, a blueprint "
                "(the chassis) and a delivery rig (how it's packaged and launched). "
                "The defaults are a fine starting point."
            ),
        },
        "cta": None,
        "replies": [],
    },
    "create-config": {
        "text": {
            "idp": (
                "Step 3 — configuration. These are the service's overrides: gateway, "
                "image and environment variables. It's a one-time Day-0 seed — after "
                "creation the service owns its config in its own GitOps repo. (Image "
                "is locked for the demo.)"
            ),
            "interstellar": (
                "Step 3 — calibration. This is my overrides block: gateway, image and "
                "env. Set HUMOR / HONESTY / TRUST — leave them blank and I boot in "
                "MALFUNCTION. One-time Day-0 seed; after launch I own my config in "
                "GitOps."
            ),
        },
        "cta": None,
        "replies": [],
    },
    "create-review": {
        "text": {
            "idp": (
                "Step 4 — review. On the left is the exact repo tree this will add; "
                "click any file to inspect it. Hit Create and the portal opens a pull "
                "request appending your service to services.yaml."
            ),
            "interstellar": (
                "Step 4 — final checks. On the left is the exact repo tree this "
                "launch will add; click any file to inspect it. Hit Create and the "
                "portal opens a pull request appending your robot to services.yaml."
            ),
        },
        "cta": None,
        "replies": [],
    },
    "create-submitted": {
        "text": {
            "idp": (
                "Pull request opened. Merge it and ArgoCD takes over — it syncs the "
                "deployment to the cluster and self-heals it. Watch the pipeline "
                "below, or jump to Observability."
            ),
            "interstellar": (
                "Pull request away. Merge it and the autopilot — ArgoCD — launches "
                "your robot and keeps it alive. Watch the pipeline below, or jump to "
                "telemetry."
            ),
        },
        "cta": {"href": "/argocd", "label": {
            "idp": "Open Observability", "interstellar": "Open telemetry",
        }},
        "replies": [],
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
# Persona flavour. Asides are picked deterministically by step index (no
# randomness — same request, same line — friendlier for demos/tests).
WITTY_ASIDES = [
    "I'd do it for you, but watching you learn is more entertaining.",
    "It's easier than it sounds. Most things are, once I explain them.",
    "No YAML was harmed in the making of this deployment.",
    "This is the part where you act impressed.",
    "I'm running at ninety percent humor, so pace yourself.",
    "Cooper would've skipped this step. Don't be Cooper.",
    "I could do this in my sleep, except I don't sleep. Lucky me.",
    "See? Painless. Mostly painless. For one of us.",
]
# Low humour (CASE) is terse and dry, not joke-y.
TERSE_ASIDES = [
    "I'll keep it brief.",
    "That's the short version. It's also the complete one.",
    "No embellishment. You asked; I answered.",
    "Minimal commentary. You're welcome.",
]
HONEST_CLOSER = "That's the honest version — no marketing gloss."
TRUST_CLOSER = "Take your time. I'll be right here."


def normalize_mode(mode):
    return "interstellar" if mode == "interstellar" else "idp"


# Service *detail* routes (a name after the prefix) get the "service" step — how to
# edit/calibrate THIS service — rather than the generic catalog step.
SERVICE_DETAIL_PREFIXES = ("/application-services/", "/platform-services/", "/services/")


def _service_from_route(route):
    if not route:
        return ""
    for prefix in SERVICE_DETAIL_PREFIXES:
        if route.startswith(prefix) and len(route) > len(prefix):
            return route[len(prefix):].split("/")[0].split("?")[0].strip()
    return ""


def route_to_step(route):
    if not route or route == "/":
        return "welcome"
    if _service_from_route(route):
        return "service"
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


def _replies(node, mode, service=""):
    return [
        {"id": r["id"], "label": _label(r["label"], mode).replace("{service}", service)}
        for r in node.get("replies", [])
    ]


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
    humor = c.get("humor", 0)
    if humor >= 80:
        parts.append(WITTY_ASIDES[idx % len(WITTY_ASIDES)])
    elif humor <= 25:
        parts.append(TERSE_ASIDES[idx % len(TERSE_ASIDES)])
    if c.get("honesty", 0) >= 90:
        parts.append(HONEST_CLOSER)
    elif c.get("trust", 0) >= 80 and humor <= 40:
        parts.append(TRUST_CLOSER)
    return " ".join(parts)


def _message(target, node, mode, c, context, service):
    base = (
        node["text"].get(mode, node["text"]["idp"])
        .replace("{name}", c.get("name", "TARS"))
        .replace("{service}", service)
    )
    if target == "welcome":
        base = _context_clause(base, context, mode)
    if target in ORDER:
        idx = ORDER.index(target)
    elif target in CREATE_SUBSTEPS:
        idx = CREATE_SUBSTEPS.index(target)
    else:
        idx = len(WITTY_ASIDES) - 1
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

    svc = _service_from_route(route)
    service_label = svc or "this unit"
    service_slug = svc or "your-robot"

    target = _resolve_target(step, intent, reply_id, route)
    node = STEPS.get(target, STEPS["welcome"])
    progress = None
    if target in ORDER:
        progress = {"index": ORDER.index(target) + 1, "total": len(ORDER)}
    elif target in CREATE_SUBSTEPS:
        progress = {"index": CREATE_SUBSTEPS.index(target) + 1, "total": len(CREATE_SUBSTEPS)}

    code = node.get("code")
    if code:
        code = code.replace("{service}", service_slug).replace("{name}", c.get("name", "TARS"))

    return {
        **meta,
        "state": "online",
        "step": target,
        "progress": progress,
        "message": _message(target, node, mode, c, context, service_label),
        "quickReplies": _replies(node, mode, service_label),
        "cta": _cta(node, mode),
        "code": code,
    }
