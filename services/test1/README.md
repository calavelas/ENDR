# test1

## Overview

This service was created from the `python-fastapi` template in ENDR.

## Access

After `SVCS Build/Deploy` completes and ArgoCD sync is healthy, access this service at:

- [https://test1.calavelas.net](https://test1.calavelas.net)

## Runtime

- Namespace: `demo`
- Port: `8080`
- Service Template: `python-fastapi`
- GitOps Template: configured in `services.yaml`

## Notes

- Source code is generated under `services/test1/`.
- Deployment resources are generated under `services/test1/chart/`.
