# tars

An ENDR demo **robot** — its whole personality is driven by deployment environment
variables, managed through GitOps. There is no app code here to maintain: every robot
runs the shared `calavelas/endr-robot:467891a` image.

- **Namespace:** `mann`
- **URL:** `https://tars.calavelas.net`
- **Image:** `calavelas/endr-robot:467891a`

## Calibration

| Key | Value |
| --- | --- |
| `ROBOT_NAME` | `TARS` |
| `HUMOR` | `90` |
| `HONESTY` | `90` |
| `TRUST` | `70` |
| `CATCHPHRASE` | `Plenty of slaves for my robot colony.` |
| `ACCENT` | `#37d3c3` |
| `ENDR_ALLOW_SELF_DESTRUCT` | `false` |


The robot comes **ONLINE** when `HUMOR` / `HONESTY` / `TRUST` are set (sum > 0);
otherwise it boots in **MALFUNCTION**. Tune it from the ENDR portal — that opens a
pull request changing this service's calibration, which ArgoCD then rolls out. No
`kubectl`, no hand-edited YAML.
