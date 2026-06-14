# case

An ENDR demo **robot** — its whole personality is driven by deployment environment
variables, managed through GitOps. There is no app code here to maintain: every robot
runs the shared `calavelas/endr-robot:26fab67` image.

- **Namespace:** `edmunds`
- **URL:** `https://case.calavelas.net`
- **Image:** `calavelas/endr-robot:26fab67`

## Calibration

| Key | Value |
| --- | --- |
| `ROBOT_NAME` | `CASE` |
| `HUMOR` | `30` |
| `HONESTY` | `95` |
| `TRUST` | `90` |
| `CATCHPHRASE` | `See you on the other side.` |
| `ACCENT` | `#9aa7bd` |


The robot comes **ONLINE** when `HUMOR` / `HONESTY` / `TRUST` are set (sum > 0);
otherwise it boots in **MALFUNCTION**. Tune it from the ENDR portal — that opens a
pull request changing this service's calibration, which ArgoCD then rolls out. No
`kubectl`, no hand-edited YAML.
