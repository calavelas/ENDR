# kipp

An ENDR demo **robot** — its whole personality is driven by deployment environment
variables, managed through GitOps. There is no app code here to maintain: every robot
runs the shared `calavelas/endr-robot:c68ef1a` image.

- **Namespace:** `miller`
- **URL:** `https://kipp.calavelas.net`
- **Image:** `calavelas/endr-robot:c68ef1a`

## Calibration

| Key | Value |
| --- | --- |
| `ROBOT_NAME` | `kipp` |
| `HUMOR` | `90` |
| `TRUST` | `70` |
| `CATCHPHRASE` | `Are you ready for my robot colony?` |


The robot comes **ONLINE** when `HUMOR` / `HONESTY` / `TRUST` are set (sum > 0);
otherwise it boots in **MALFUNCTION**. Tune it from the ENDR portal — that opens a
pull request changing this service's calibration, which ArgoCD then rolls out. No
`kubectl`, no hand-edited YAML.
