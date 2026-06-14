# tryout-svc

An ENDR demo **robot** — its whole personality is driven by deployment environment
variables, managed through GitOps. There is no app code here to maintain: every robot
runs the shared `calavelas/endr-robot:latest` image.

- **Namespace:** `miller`
- **URL:** `https://tryout-svc.calavelas.net`
- **Image:** `calavelas/endr-robot:latest`

## Calibration

| Key | Value |
| --- | --- |
| `ROBOT_NAME` | `TRYOUT` |
| `CATCHPHRASE` | `Just here for the evaluation.` |


The robot comes **ONLINE** when `HUMOR` / `HONESTY` / `TRUST` are set (sum > 0);
otherwise it boots in **MALFUNCTION**. Tune it from the ENDR portal — that opens a
pull request changing this service's calibration, which ArgoCD then rolls out. No
`kubectl`, no hand-edited YAML.
