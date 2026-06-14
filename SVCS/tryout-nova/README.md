# tryout-nova

An ENDR demo **robot** — its whole personality is driven by deployment environment
variables, managed through GitOps. There is no app code here to maintain: every robot
runs the shared `calavelas/endr-robot:latest` image.

- **Namespace:** `miller`
- **URL:** `https://tryout-nova.calavelas.net`
- **Image:** `calavelas/endr-robot:latest`

## Calibration

| Key | Value |
| --- | --- |
| `ROBOT_NAME` | `Nova` |
| `CATCHPHRASE` | `Onward, to the stars!` |
| `HUMOR` | `75` |
| `HONESTY` | `90` |
| `TRUST` | `85` |


The robot comes **ONLINE** when `HUMOR` / `HONESTY` / `TRUST` are set (sum > 0);
otherwise it boots in **MALFUNCTION**. Tune it from the ENDR portal — that opens a
pull request changing this service's calibration, which ArgoCD then rolls out. No
`kubectl`, no hand-edited YAML.
