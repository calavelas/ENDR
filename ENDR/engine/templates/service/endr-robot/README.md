# Service template: `endr-robot`

Scaffolds an ENDR demo **robot** service. Unlike `python-fastapi`, a robot does not
ship per-service application code — every robot runs the shared, prebuilt
`endr-robot` image. Its source lives beside this template in `image/` (built and
published by `robot-build.yml`). Its entire behaviour is driven by deployment
**environment variables** (GitOps-managed):

- `ROBOT_NAME`, `CATCHPHRASE`, `ACCENT` — identity
- `HUMOR`, `HONESTY`, `TRUST` — calibration (0–100)

The robot boots **ONLINE** when calibration is set (sum > 0), otherwise
**MALFUNCTION**. So this template only scaffolds a `README.md` under
`services/<name>/`; the image + calibration live in the `services.yaml` entry's
`overrides` (`image: …/endr-robot:<tag>`, `env: { … }`), and the `helm-service`
gitops template renders the chart + ArgoCD app from them.
