# aaa

## Overview

This service was created from the `python-fastapi` template in ENDR.

## Access

After `SVCS Build/Deploy` completes and ArgoCD sync is healthy, access this service at:

- [https://aaa.calavelas.net](https://aaa.calavelas.net)

## Runtime

- Namespace: `miller1`
- Port: `8080`
- Service Template: `python-fastapi`
- GitOps Template: configured in `services.yaml`

## Notes

- Source code is generated under `services/aaa/`.
- Deployment resources are generated under `services/aaa/chart/`.
