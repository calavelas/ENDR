"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { CodeBlock } from "../components/code-block";
import * as Icon from "../components/icons";
import { useNarrative } from "../lib/narrative";
import {
  envRowsToMap,
  formToYaml,
  parseYamlToForm,
  ROBOT_ENV_SEED,
  type EnvRow,
  type ServiceFormState,
} from "../lib/service-entry";
import { ConfigEditor } from "./config-editor";
import { WizardStepper } from "./wizard-stepper";

interface TemplateOption {
  name: string;
  description?: string;
  path?: string;
  previewFiles?: string[];
  previewNote?: string;
}

interface CreateOptionsResponse {
  serviceTemplates: TemplateOption[];
  gitopsTemplates: TemplateOption[];
  namespaces: TemplateOption[];
  kubernetesEnvironments: TemplateOption[];
  existingServices: string[];
}

interface CreateServicePayload {
  serviceName: string;
  namespace: string;
  environment: string;
  serviceTemplate: string;
  gitopsTemplate: string;
  gatewayEnabled: boolean;
  image?: string;
  env?: Record<string, string>;
  dryRun?: boolean;
}

interface CreateServiceResult {
  serviceName: string;
  dryRun: boolean;
  stagingPath: string;
  generatedFiles: Array<{
    path: string;
    size: number;
    content?: string | null;
    contentEncoding?: string | null;
    contentTruncated?: boolean;
  }>;
  branchName?: string;
  pullRequestUrl?: string;
  pullRequestNumber?: number;
}

interface TransactionWorkflowRun {
  id: number;
  name: string;
  title: string;
  workflowPath: string;
  htmlUrl: string;
  event: string;
  status: string;
  conclusion: string | null;
  headBranch: string;
  headSha: string;
  runNumber: number;
  runAttempt: number;
  createdAt: string;
  updatedAt: string;
}

interface TransactionStatusResult {
  pullRequest: {
    number: number;
    title: string;
    htmlUrl: string;
    state: string;
    merged: boolean;
    createdAt: string;
    updatedAt: string;
    closedAt: string | null;
    mergedAt: string | null;
    mergeCommitSha: string | null;
    headRef: string;
    headSha: string;
    baseRef: string;
  };
  pipeline: {
    status: "pending" | "running" | "success" | "failed" | "waiting-merge";
    message: string;
    notifications: string[];
    runs: {
      prCheck: TransactionWorkflowRun | null;
      reconcileUpdate: TransactionWorkflowRun | null;
      svcsBuildDeploy: TransactionWorkflowRun | null;
    };
  };
}

interface PlatformSnapshot {
  generatedAt: string;
  warnings: string[];
  services: Array<{
    name: string;
    syncStatus: string;
    healthStatus: string;
  }>;
}

interface TemplateFileResult {
  templateType: "service" | "gitops";
  templateName: string;
  filePath: string;
  size: number;
  content: string;
  contentEncoding?: string | null;
  truncated?: boolean;
}

interface FileViewerState {
  sourceLabel: string;
  path: string;
  size: number;
  content: string;
  contentEncoding?: string | null;
  truncated?: boolean;
}

type PipelineStageStatus = "pending" | "running" | "success" | "failed";
type StepId = 1 | 2 | 3;

interface PipelineStageView {
  key: "pr-check" | "reconcile" | "services-build";
  label: string;
  status: PipelineStageStatus;
  detail: string;
  run: TransactionWorkflowRun | null;
}

const DNS_LABEL_RE = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

function buildServicePagePath(serviceName: string): string {
  return `/application-services/${encodeURIComponent(serviceName.trim())}`;
}

function buildServicePublicUrl(serviceName: string): string {
  return `https://${encodeURIComponent(serviceName.trim())}.calavelas.net`;
}

function readErrorMessage(payload: unknown): string {
  if (typeof payload === "string") {
    return payload;
  }
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail: unknown }).detail;
    if (typeof detail === "string") {
      return detail;
    }
    return JSON.stringify(detail);
  }
  return "request failed";
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "n/a";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

function pipelineTone(status: TransactionStatusResult["pipeline"]["status"]): "good" | "warn" | "bad" | "neutral" {
  if (status === "success") {
    return "good";
  }
  if (status === "running" || status === "waiting-merge") {
    return "warn";
  }
  if (status === "failed") {
    return "bad";
  }
  return "neutral";
}

function formatPipelineStatus(status: TransactionStatusResult["pipeline"]["status"]): string {
  if (status === "waiting-merge") {
    return "Waiting Merge";
  }
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatWorkflowRunStatus(run: TransactionWorkflowRun | null): string {
  if (!run) {
    return "pending";
  }
  if (run.status !== "completed") {
    return run.status.replace(/_/g, " ");
  }
  if (run.conclusion === "success") {
    return "success";
  }
  return run.conclusion ? `failed (${run.conclusion})` : "failed";
}

function stageTone(status: PipelineStageStatus): "good" | "warn" | "bad" | "neutral" {
  if (status === "success") {
    return "good";
  }
  if (status === "running") {
    return "warn";
  }
  if (status === "failed") {
    return "bad";
  }
  return "neutral";
}

function formatStageStatus(status: PipelineStageStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function runStageFromWorkflow(run: TransactionWorkflowRun | null): PipelineStageStatus {
  if (!run) {
    return "pending";
  }
  if (run.status !== "completed") {
    return "running";
  }
  return run.conclusion === "success" ? "success" : "failed";
}

function buildPipelineStages(status: TransactionStatusResult): PipelineStageView[] {
  const prRun = status.pipeline.runs.prCheck;
  const prStage = runStageFromWorkflow(prRun);
  let prDetail = "Waiting for PR check workflow to start.";
  if (prStage === "running") {
    prDetail = "PR check workflow is running.";
  } else if (prStage === "success") {
    prDetail = "PR check workflow completed successfully.";
  } else if (prStage === "failed") {
    prDetail = `PR check workflow failed (${prRun?.conclusion || "unknown"}).`;
  }

  const reconcileRun = status.pipeline.runs.reconcileUpdate;
  let reconcileStage: PipelineStageStatus = "pending";
  let reconcileDetail = "Starts after PR merge.";
  if (status.pullRequest.merged) {
    reconcileStage = runStageFromWorkflow(reconcileRun);
    if (reconcileStage === "pending") {
      reconcileDetail = "Waiting for Reconcile workflow.";
    } else if (reconcileStage === "running") {
      reconcileDetail = "Reconcile workflow is running.";
    } else if (reconcileStage === "success") {
      reconcileDetail = "Reconcile workflow completed successfully.";
    } else {
      reconcileDetail = `Reconcile workflow failed (${reconcileRun?.conclusion || "unknown"}).`;
    }
  }

  const svcsRun = status.pipeline.runs.svcsBuildDeploy;
  let svcsStage: PipelineStageStatus = "pending";
  let svcsDetail = "Starts after PR merge.";
  if (status.pullRequest.merged) {
    if (reconcileStage !== "success") {
      svcsStage = "pending";
      svcsDetail = "Waiting for reconcile success.";
    } else {
      svcsStage = runStageFromWorkflow(svcsRun);
      if (svcsStage === "pending") {
        svcsDetail = "Waiting for Service build/deploy workflow.";
      } else if (svcsStage === "running") {
        svcsDetail = "Service build/deploy workflow is running.";
      } else if (svcsStage === "success") {
        svcsDetail = "Service build/deploy workflow completed successfully.";
      } else {
        svcsDetail = `Service build/deploy failed (${svcsRun?.conclusion || "unknown"}).`;
      }
    }
  }

  return [
    { key: "pr-check", label: "PR Check", status: prStage, detail: prDetail, run: prRun },
    { key: "reconcile", label: "Reconcile", status: reconcileStage, detail: reconcileDetail, run: reconcileRun },
    { key: "services-build", label: "Service build/deploy", status: svcsStage, detail: svcsDetail, run: svcsRun },
  ];
}

function isSvcsBuildSuccessful(status: TransactionStatusResult | null): boolean {
  if (!status) {
    return false;
  }
  if (status.pipeline.status === "success") {
    return true;
  }
  const run = status.pipeline.runs.svcsBuildDeploy;
  if (!run) {
    return false;
  }
  return run.status === "completed" && run.conclusion === "success";
}

function hasService(snapshot: PlatformSnapshot, serviceName: string): boolean {
  const expected = serviceName.trim().toLowerCase();
  if (!expected) {
    return false;
  }
  return snapshot.services.some((service) => service.name.trim().toLowerCase() === expected);
}

function buildPreviewSignature(payload: CreateServicePayload): string {
  return JSON.stringify({
    serviceName: payload.serviceName.trim(),
    namespace: payload.namespace.trim(),
    environment: payload.environment.trim(),
    serviceTemplate: payload.serviceTemplate.trim(),
    gitopsTemplate: payload.gitopsTemplate.trim(),
    gatewayEnabled: payload.gatewayEnabled,
    image: payload.image ?? "",
    env: payload.env ?? {},
  });
}

export function CreateServicePanel() {
  const { mode, t } = useNarrative();
  const resultSectionRef = useRef<HTMLElement | null>(null);
  const [options, setOptions] = useState<CreateOptionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [namespace, setNamespace] = useState("");
  const [environment, setEnvironment] = useState("");
  const [serviceTemplate, setServiceTemplate] = useState("");
  const [gitopsTemplate, setGitopsTemplate] = useState("");
  const [gatewayEnabled, setGatewayEnabled] = useState(true);
  const [imageOverride, setImageOverride] = useState("");
  const [envRows, setEnvRows] = useState<EnvRow[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [previewResult, setPreviewResult] = useState<CreateServiceResult | null>(null);
  const [lastPreviewSignature, setLastPreviewSignature] = useState<string | null>(null);
  const [fileViewer, setFileViewer] = useState<FileViewerState | null>(null);
  const [fileViewerLoading, setFileViewerLoading] = useState(false);
  const [fileViewerError, setFileViewerError] = useState("");
  const [result, setResult] = useState<CreateServiceResult | null>(null);
  const [transactionStatus, setTransactionStatus] = useState<TransactionStatusResult | null>(null);
  const [transactionStatusError, setTransactionStatusError] = useState("");
  const [catalogRefreshStatus, setCatalogRefreshStatus] = useState<"idle" | "refreshing" | "success" | "failed">("idle");
  const [catalogRefreshError, setCatalogRefreshError] = useState("");
  const [catalogRefreshNote, setCatalogRefreshNote] = useState("");
  const [catalogRefreshAttempts, setCatalogRefreshAttempts] = useState(0);
  const [serviceVisibleInCatalog, setServiceVisibleInCatalog] = useState(false);

  // Wizard state.
  const [step, setStep] = useState<StepId>(1);
  const [furthestStep, setFurthestStep] = useState<StepId>(1);
  const [editorMode, setEditorMode] = useState<"form" | "yaml">("form");
  const [yamlText, setYamlText] = useState("");
  const [yamlError, setYamlError] = useState("");
  const [unknownKeysWarning, setUnknownKeysWarning] = useState("");

  useEffect(() => {
    let cancelled = false;

    fetch("/api/platform/templates", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as unknown;
        if (!response.ok) {
          throw new Error(readErrorMessage(body));
        }

        if (!cancelled) {
          const value = body as CreateOptionsResponse;
          setOptions(value);
          setNamespace(value.namespaces[0]?.name ?? "");
          setEnvironment(value.kubernetesEnvironments[0]?.name ?? "");
          setServiceTemplate(value.serviceTemplates[0]?.name ?? "");
          setGitopsTemplate(value.gitopsTemplates[0]?.name ?? "");
        }
      })
      .catch((error) => {
        if (!cancelled) {
          const detail = error instanceof Error ? error.message : "unable to load templates";
          setLoadError(detail);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Seed suggested robot env overrides when the endr-robot template is chosen
  // (they are ordinary, editable env rows — just a head start).
  useEffect(() => {
    if (serviceTemplate !== "endr-robot") {
      return;
    }
    setEnvRows((prev) => (prev.length === 0 ? ROBOT_ENV_SEED.map((row) => ({ ...row })) : prev));
  }, [serviceTemplate]);

  useEffect(() => {
    const prNumber = result?.pullRequestNumber;
    if (!prNumber) {
      setTransactionStatus(null);
      setTransactionStatusError("");
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/platform/transactions/${prNumber}`, { cache: "no-store" });
        const body = (await response.json().catch(() => ({}))) as unknown;
        if (!response.ok) {
          throw new Error(readErrorMessage(body));
        }
        if (!cancelled) {
          setTransactionStatus(body as TransactionStatusResult);
          setTransactionStatusError("");
        }
      } catch (error) {
        if (!cancelled) {
          const detail = error instanceof Error ? error.message : "unable to load transaction status";
          setTransactionStatusError(detail);
        }
      }
    };

    void pollStatus();
    timer = setInterval(() => {
      void pollStatus();
    }, 20_000);

    return () => {
      cancelled = true;
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [result?.pullRequestNumber]);

  useEffect(() => {
    setCatalogRefreshStatus("idle");
    setCatalogRefreshError("");
    setCatalogRefreshNote("");
    setCatalogRefreshAttempts(0);
    setServiceVisibleInCatalog(false);
  }, [result?.pullRequestNumber, result?.serviceName]);

  useEffect(() => {
    const service = result?.serviceName?.trim();
    if (
      !service ||
      !isSvcsBuildSuccessful(transactionStatus) ||
      serviceVisibleInCatalog ||
      catalogRefreshStatus === "refreshing" ||
      catalogRefreshStatus === "failed"
    ) {
      return;
    }

    let cancelled = false;
    const maxAttempts = 10;
    const intervalMs = 5_000;

    const refreshSnapshotUntilVisible = async () => {
      setCatalogRefreshStatus("refreshing");
      setCatalogRefreshError("");

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        if (cancelled) {
          return;
        }
        setCatalogRefreshAttempts(attempt);
        setCatalogRefreshNote(`Refreshing service catalog (${attempt}/${maxAttempts})...`);

        try {
          const response = await fetch(`/api/platform?t=${Date.now()}`, { cache: "no-store" });
          const body = (await response.json().catch(() => ({}))) as unknown;
          if (!response.ok) {
            throw new Error(readErrorMessage(body));
          }

          const snapshot = body as PlatformSnapshot;
          if (hasService(snapshot, service)) {
            if (!cancelled) {
              setServiceVisibleInCatalog(true);
              setCatalogRefreshStatus("success");
              setCatalogRefreshError("");
              setCatalogRefreshNote(`Service visible in catalog (${new Date(snapshot.generatedAt).toLocaleString()}).`);
            }
            return;
          }
        } catch (error) {
          if (!cancelled) {
            const detail = error instanceof Error ? error.message : "unable to refresh service catalog";
            setCatalogRefreshError(detail);
          }
        }

        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }
      }

      if (!cancelled) {
        setCatalogRefreshStatus("failed");
        setCatalogRefreshNote("Service is not visible in catalog yet. Retry refresh after ArgoCD sync settles.");
      }
    };

    void refreshSnapshotUntilVisible();
    return () => {
      cancelled = true;
    };
  }, [catalogRefreshStatus, result?.serviceName, serviceVisibleInCatalog, transactionStatus]);

  const existingServices = useMemo(() => {
    return new Set((options?.existingServices ?? []).map((name) => name.toLowerCase()));
  }, [options]);

  const selectedServiceTemplate = useMemo(
    () => options?.serviceTemplates.find((template) => template.name === serviceTemplate) ?? null,
    [options, serviceTemplate],
  );
  const selectedGitopsTemplate = useMemo(
    () => options?.gitopsTemplates.find((template) => template.name === gitopsTemplate) ?? null,
    [options, gitopsTemplate],
  );
  const currentPreviewSignature = useMemo(
    () =>
      JSON.stringify({
        serviceName: serviceName.trim(),
        namespace: namespace.trim(),
        environment: environment.trim(),
        serviceTemplate: serviceTemplate.trim(),
        gitopsTemplate: gitopsTemplate.trim(),
        gatewayEnabled,
        image: imageOverride.trim(),
        env: envRowsToMap(envRows),
      }),
    [environment, gatewayEnabled, gitopsTemplate, imageOverride, envRows, namespace, serviceName, serviceTemplate],
  );
  const isPreviewCurrent = Boolean(previewResult && lastPreviewSignature && lastPreviewSignature === currentPreviewSignature);
  const pipelineStages = useMemo(
    () => (transactionStatus ? buildPipelineStages(transactionStatus) : []),
    [transactionStatus],
  );

  const trimmedName = serviceName.trim();
  const step1NameError = (() => {
    if (!trimmedName) {
      return "";
    }
    if (trimmedName.length > 48 || !DNS_LABEL_RE.test(trimmedName)) {
      return "Must be a Kubernetes DNS label — lowercase letters, numbers, dashes.";
    }
    if (existingServices.has(trimmedName.toLowerCase())) {
      return `'${trimmedName}' already exists.`;
    }
    return "";
  })();
  const step1Valid = Boolean(trimmedName) && !step1NameError && Boolean(namespace);

  function currentFormState(): ServiceFormState {
    return {
      serviceName,
      namespace,
      environment,
      serviceTemplate,
      gitopsTemplate,
      gatewayEnabled,
      imageOverride,
      envRows,
    };
  }

  function applyFormState(form: ServiceFormState) {
    setServiceName(form.serviceName);
    setNamespace(form.namespace);
    setEnvironment(form.environment);
    setServiceTemplate(form.serviceTemplate);
    setGitopsTemplate(form.gitopsTemplate);
    setGatewayEnabled(form.gatewayEnabled);
    setImageOverride(form.imageOverride);
    setEnvRows(form.envRows);
  }

  // Parse the YAML editor back into a full form state (filling gaps with current
  // values). Sets yamlError + unknownKeysWarning; returns null on parse failure.
  function parseAndMerge(): ServiceFormState | null {
    let parsed;
    try {
      parsed = parseYamlToForm(yamlText);
    } catch (error) {
      setYamlError(error instanceof Error ? error.message : "invalid YAML");
      return null;
    }
    setYamlError("");
    setUnknownKeysWarning(
      parsed.unknownOverrideKeys.length > 0
        ? `Overrides not sent by the portal yet (edit them in the repo): ${parsed.unknownOverrideKeys.join(", ")}.`
        : "",
    );
    return {
      serviceName: parsed.serviceName ?? serviceName,
      namespace: parsed.namespace ?? namespace,
      environment: parsed.environment ?? environment,
      serviceTemplate: parsed.serviceTemplate ?? serviceTemplate,
      gitopsTemplate: parsed.gitopsTemplate ?? gitopsTemplate,
      gatewayEnabled: parsed.gatewayEnabled ?? gatewayEnabled,
      imageOverride: parsed.imageOverride,
      envRows: parsed.envRows,
    };
  }

  function changeEditorMode(next: "form" | "yaml") {
    if (next === editorMode) {
      return;
    }
    if (next === "yaml") {
      setYamlText(formToYaml(currentFormState()));
      setYamlError("");
      setEditorMode("yaml");
    } else {
      const merged = parseAndMerge();
      if (!merged) {
        return; // stay in YAML with the error shown
      }
      applyFormState(merged);
      setEditorMode("form");
    }
  }

  function onYamlBlur() {
    const merged = parseAndMerge();
    if (merged) {
      applyFormState(merged);
    }
  }

  // Effective form for preview/submit — synced from YAML when in YAML mode.
  function resolveForm(): ServiceFormState | null {
    if (editorMode === "yaml") {
      const merged = parseAndMerge();
      if (!merged) {
        setFormError("Fix the YAML configuration before continuing.");
        return null;
      }
      applyFormState(merged);
      return merged;
    }
    return currentFormState();
  }

  function buildPayload(form: ServiceFormState): CreateServicePayload | null {
    const name = form.serviceName.trim();
    if (!name) {
      setFormError("Service name is required.");
      return null;
    }
    if (name.length > 48 || !DNS_LABEL_RE.test(name)) {
      setFormError("Service name must match Kubernetes DNS label format.");
      return null;
    }
    if (existingServices.has(name.toLowerCase())) {
      setFormError(`Service '${name}' already exists.`);
      return null;
    }
    if (!form.serviceTemplate) {
      setFormError("Service template is required.");
      return null;
    }
    if (!form.namespace) {
      setFormError("Namespace is required.");
      return null;
    }
    if (!form.environment) {
      setFormError("Environment is required.");
      return null;
    }
    if (!form.gitopsTemplate) {
      setFormError("GitOps template is required.");
      return null;
    }

    const payload: CreateServicePayload = {
      serviceName: name,
      namespace: form.namespace,
      environment: form.environment,
      serviceTemplate: form.serviceTemplate,
      gitopsTemplate: form.gitopsTemplate,
      gatewayEnabled: form.gatewayEnabled,
    };
    const image = form.imageOverride.trim();
    if (image) {
      payload.image = image;
    }
    const env = envRowsToMap(form.envRows);
    if (Object.keys(env).length > 0) {
      payload.env = env;
    }
    return payload;
  }

  function goToStep(target: StepId) {
    if (target === step || target > furthestStep) {
      return;
    }
    if (step === 3 && editorMode === "yaml") {
      const merged = parseAndMerge();
      if (merged) {
        applyFormState(merged);
      }
    }
    setStep(target);
  }

  function goNext() {
    if (step === 1) {
      if (!step1Valid) {
        return;
      }
      setStep(2);
      setFurthestStep((value) => (value < 2 ? 2 : value));
    } else if (step === 2) {
      setStep(3);
      setFurthestStep((value) => (value < 3 ? 3 : value));
    }
  }

  function goBack() {
    if (step === 3 && editorMode === "yaml") {
      const merged = parseAndMerge();
      if (merged) {
        applyFormState(merged);
      }
    }
    setStep((value) => (value > 1 ? ((value - 1) as StepId) : value));
  }

  function onOpenGeneratedFile(file: CreateServiceResult["generatedFiles"][number]) {
    if (typeof file.content !== "string") {
      setFileViewerError(`Generated file content is unavailable: ${file.path}`);
      return;
    }
    setFileViewerError("");
    setFileViewerLoading(false);
    setFileViewer({
      sourceLabel: "Generated Output",
      path: file.path,
      size: file.size,
      content: file.content,
      contentEncoding: file.contentEncoding,
      truncated: file.contentTruncated,
    });
  }

  async function onOpenTemplateFile(templateType: "service" | "gitops", templateName: string, filePath: string) {
    const normalizedTemplateName = templateName.trim();
    const normalizedFilePath = filePath.trim();
    if (!normalizedTemplateName || !normalizedFilePath) {
      return;
    }

    setFileViewerLoading(true);
    setFileViewerError("");
    try {
      const params = new URLSearchParams({
        templateType,
        templateName: normalizedTemplateName,
        filePath: normalizedFilePath,
      });
      const response = await fetch(`/api/platform/template-file?${params.toString()}`, { cache: "no-store" });
      const body = (await response.json().catch(() => ({}))) as unknown;
      if (!response.ok) {
        throw new Error(readErrorMessage(body));
      }

      const file = body as TemplateFileResult;
      setFileViewer({
        sourceLabel: templateType === "service" ? "Service Template" : "GitOps Template",
        path: `${normalizedTemplateName}/${file.filePath}`,
        size: file.size,
        content: file.content,
        contentEncoding: file.contentEncoding,
        truncated: file.truncated,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unable to load template file";
      setFileViewerError(detail);
    } finally {
      setFileViewerLoading(false);
    }
  }

  async function onGeneratePreview() {
    setFormError("");
    setResult(null);
    setTransactionStatus(null);
    setTransactionStatusError("");
    setCatalogRefreshStatus("idle");
    setCatalogRefreshError("");
    setCatalogRefreshNote("");
    setCatalogRefreshAttempts(0);
    setServiceVisibleInCatalog(false);
    setLastPreviewSignature(null);
    setFileViewer(null);
    setFileViewerLoading(false);
    setFileViewerError("");

    const form = resolveForm();
    if (!form) {
      return;
    }
    const payload = buildPayload(form);
    if (!payload) {
      return;
    }

    setPreviewing(true);
    try {
      const response = await fetch("/api/platform/services", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, dryRun: true }),
      });

      const body = (await response.json().catch(() => ({}))) as unknown;
      if (!response.ok) {
        throw new Error(readErrorMessage(body));
      }

      setPreviewResult(body as CreateServiceResult);
      setLastPreviewSignature(buildPreviewSignature(payload));
    } catch (error) {
      const detail = error instanceof Error ? error.message : "preview failed";
      setFormError(detail);
    } finally {
      setPreviewing(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step !== 3) {
      goNext();
      return;
    }

    resultSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setFormError("");
    setResult(null);
    setTransactionStatus(null);
    setTransactionStatusError("");
    setCatalogRefreshStatus("idle");
    setCatalogRefreshError("");
    setCatalogRefreshNote("");
    setCatalogRefreshAttempts(0);
    setServiceVisibleInCatalog(false);

    const form = resolveForm();
    if (!form) {
      return;
    }
    const payload = buildPayload(form);
    if (!payload) {
      return;
    }
    const payloadSignature = buildPreviewSignature(payload);
    if (!previewResult || lastPreviewSignature !== payloadSignature) {
      setFormError("Generate Preview for current values before creating the service.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/platform/services", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await response.json().catch(() => ({}))) as unknown;
      if (!response.ok) {
        throw new Error(readErrorMessage(body));
      }

      const created = body as CreateServiceResult;
      setResult(created);
      resultSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setPreviewResult(null);
      setLastPreviewSignature(null);
      setFileViewer(null);
      setFileViewerLoading(false);
      setFileViewerError("");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "submit failed";
      setFormError(detail);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <section className="mc-panel">
        <p className="mc-muted">Loading template options…</p>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="mc-panel">
        <p className="form-error" role="alert">
          {loadError}
        </p>
      </section>
    );
  }

  const thing = mode === "interstellar" ? "robot" : "service";

  const fileViewerPanel =
    fileViewerLoading || fileViewerError || fileViewer ? (
      <section className="mc-panel wiz-fileviewer" aria-live="polite">
        <div className="mc-panel-head">
          <h2 className="mc-panel-title">File viewer</h2>
          {fileViewer ? (
            <button type="button" className="mc-link-all" onClick={() => setFileViewer(null)}>
              Close
            </button>
          ) : null}
        </div>
        {fileViewerLoading ? (
          <p className="mc-muted">Fetching selected file content…</p>
        ) : fileViewerError ? (
          <p className="form-error" role="alert">
            {fileViewerError}
          </p>
        ) : fileViewer ? (
          <>
            <p className="mc-muted" style={{ fontSize: "0.8rem" }}>
              <code>{fileViewer.path}</code> • {fileViewer.size} bytes
            </p>
            <CodeBlock content={fileViewer.content} filename={fileViewer.path} />
            {fileViewer.truncated ? <p className="mc-muted">Preview truncated to first 128 KB.</p> : null}
          </>
        ) : null}
      </section>
    ) : null;

  return (
    <div className="wiz">
      <WizardStepper step={step} furthest={furthestStep} onGo={goToStep} />

      {result ? (
        <section ref={resultSectionRef} className="mc-panel transaction-panel" aria-live="polite">
          <div className="mc-panel-head">
            <h2 className="mc-panel-title">Result</h2>
          </div>
          <p className="mc-muted" style={{ fontSize: "0.85rem", marginTop: 0 }}>
            The portal opened a branch and PR to append your {thing} to <code>services.yaml</code>. Track the pipeline
            below.
          </p>

          <dl className="kv-list">
            <div>
              <dt>Service</dt>
              <dd>{result.serviceName}</dd>
            </div>
            <div>
              <dt>Branch</dt>
              <dd>
                <code>{result.branchName ?? "n/a"}</code>
              </dd>
            </div>
            <div>
              <dt>Generated Files</dt>
              <dd>{result.generatedFiles.length}</dd>
            </div>
            <div>
              <dt>Service Page</dt>
              <dd>
                {serviceVisibleInCatalog ? (
                  <a className="mc-extlink" href={buildServicePagePath(result.serviceName)} target="_blank" rel="noreferrer">
                    {buildServicePagePath(result.serviceName)}
                  </a>
                ) : isSvcsBuildSuccessful(transactionStatus) ? (
                  <>waiting for catalog refresh…</>
                ) : (
                  <>available after Service build/deploy succeeds</>
                )}
              </dd>
            </div>
            <div>
              <dt>Service URL</dt>
              <dd>
                <a className="mc-extlink" href={buildServicePublicUrl(result.serviceName)} target="_blank" rel="noreferrer">
                  {buildServicePublicUrl(result.serviceName)}
                </a>
              </dd>
            </div>
            <div>
              <dt>Pull Request</dt>
              <dd>
                {result.pullRequestUrl ? (
                  <a className="mc-extlink" href={result.pullRequestUrl} target="_blank" rel="noreferrer">
                    {result.pullRequestUrl}
                  </a>
                ) : (
                  "n/a"
                )}
              </dd>
            </div>
            <div>
              <dt>PR Status</dt>
              <dd>
                {transactionStatus
                  ? transactionStatus.pullRequest.merged
                    ? "merged"
                    : transactionStatus.pullRequest.state
                  : "loading…"}
              </dd>
            </div>
            <div>
              <dt>Pipeline</dt>
              <dd>
                {transactionStatus ? (
                  <span className={`status-pill tone-${pipelineTone(transactionStatus.pipeline.status)}`}>
                    {formatPipelineStatus(transactionStatus.pipeline.status)}
                  </span>
                ) : (
                  "loading…"
                )}
              </dd>
            </div>
          </dl>

          {transactionStatus && (
            <section className="transaction-live">
              <p className="mc-muted">{transactionStatus.pipeline.message}</p>
              {isSvcsBuildSuccessful(transactionStatus) && (
                <p className="mc-muted">
                  {catalogRefreshStatus === "refreshing" && catalogRefreshNote}
                  {catalogRefreshStatus === "success" && catalogRefreshNote}
                  {catalogRefreshStatus === "failed" && (catalogRefreshNote || "Service catalog refresh did not complete yet.")}
                  {catalogRefreshStatus === "idle" && "Waiting to refresh service catalog."}
                  {catalogRefreshAttempts > 0 && catalogRefreshStatus === "refreshing" && ` Attempts: ${catalogRefreshAttempts}.`}
                </p>
              )}
              {catalogRefreshError && (
                <p className="form-error" role="alert">
                  {catalogRefreshError}
                </p>
              )}
              {catalogRefreshStatus === "failed" && (
                <div className="wiz-nav">
                  <button
                    type="button"
                    className="mc-btn mc-btn-sm mc-btn-soft"
                    onClick={() => {
                      setCatalogRefreshStatus("idle");
                      setCatalogRefreshError("");
                      setCatalogRefreshNote("");
                      setCatalogRefreshAttempts(0);
                    }}
                  >
                    Retry catalog refresh
                  </button>
                </div>
              )}
              {transactionStatus.pipeline.notifications.length > 0 && (
                <ul className="transaction-notifications">
                  {transactionStatus.pipeline.notifications.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              )}
              <div className="pipeline-stages" role="list" aria-label="pipeline-stages">
                {pipelineStages.map((stage) => {
                  const runTimestamp = stage.run?.updatedAt || stage.run?.createdAt || null;
                  return (
                    <article key={stage.key} className="pipeline-stage-item" role="listitem">
                      <div className="pipeline-stage-header">
                        <strong>{stage.label}</strong>
                        <span className={`status-pill tone-${stageTone(stage.status)}`}>{formatStageStatus(stage.status)}</span>
                      </div>
                      <p className="mc-muted">{stage.detail}</p>
                      <div className="pipeline-stage-meta">
                        {stage.run?.htmlUrl ? (
                          <a className="mc-extlink" href={stage.run.htmlUrl} target="_blank" rel="noreferrer">
                            {formatWorkflowRunStatus(stage.run)}
                          </a>
                        ) : (
                          <span className="mc-muted">run link available after workflow starts</span>
                        )}
                        <span className="mc-muted">{runTimestamp ? formatTimestamp(runTimestamp) : "not started"}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {transactionStatusError && (
            <p className="form-error" role="alert">
              {transactionStatusError}
            </p>
          )}

          <div className="wiz-nav">
            <button
              type="button"
              className="mc-btn mc-btn-soft"
              onClick={() => {
                setResult(null);
                setServiceName("");
                setEnvRows([]);
                setImageOverride("");
                setEditorMode("form");
                setStep(1);
                setFurthestStep(1);
              }}
            >
              <Icon.Plus size={14} />
              Create another
            </button>
          </div>
        </section>
      ) : (
        <form className="wiz-form" onSubmit={onSubmit}>
          {step === 1 && (
            <section className="mc-panel wiz-step-panel">
              <h2 className="wiz-step-title">{mode === "interstellar" ? "Robot basics" : "Basic service info"}</h2>
              <p className="wiz-step-sub">Define the core identity of your new {thing}.</p>

              <label className="wiz-field">
                <span className="wiz-label">
                  {mode === "interstellar" ? "Robot name" : "Service name"} <span className="wiz-req">*</span>
                </span>
                <input
                  type="text"
                  className="wiz-input"
                  value={serviceName}
                  onChange={(event) => setServiceName(event.target.value)}
                  placeholder={mode === "interstellar" ? "tars-9" : "payment-001"}
                  autoComplete="off"
                />
                {step1NameError ? (
                  <span className="wiz-field-error">{step1NameError}</span>
                ) : (
                  <span className="wiz-hint">
                    Lowercase letters, numbers, dashes. Becomes <code>{(trimmedName || "<name>") + ".calavelas.net"}</code>.
                  </span>
                )}
              </label>

              <label className="wiz-field">
                <span className="wiz-label">
                  {t.namespaceLabel} <span className="wiz-req">*</span>
                </span>
                <select className="wiz-input" value={namespace} onChange={(event) => setNamespace(event.target.value)}>
                  {options?.namespaces.map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <span className="wiz-hint">Where this {thing} lives in the cluster.</span>
              </label>
            </section>
          )}

          {step === 2 && (
            <section className="mc-panel wiz-step-panel">
              <h2 className="wiz-step-title">{mode === "interstellar" ? "Chassis & stack" : "Tech stack"}</h2>
              <p className="wiz-step-sub">Pick the template, delivery, and target environment.</p>

              <label className="wiz-field">
                <span className="wiz-label">
                  {mode === "interstellar" ? "Blueprint" : "Service template"} <span className="wiz-req">*</span>
                </span>
                <select
                  className="wiz-input"
                  value={serviceTemplate}
                  onChange={(event) => setServiceTemplate(event.target.value)}
                >
                  {options?.serviceTemplates.map((template) => (
                    <option key={template.name} value={template.name}>
                      {template.name}
                    </option>
                  ))}
                </select>
                <span className="wiz-hint">{selectedServiceTemplate?.description || "What kind of service to scaffold."}</span>
              </label>

              <label className="wiz-field">
                <span className="wiz-label">
                  Environment <span className="wiz-req">*</span>
                </span>
                <select
                  className="wiz-input"
                  value={environment}
                  onChange={(event) => setEnvironment(event.target.value)}
                >
                  {options?.kubernetesEnvironments.map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <span className="wiz-hint">Target cluster.</span>
              </label>

              <details className="wiz-advanced">
                <summary>Advanced — delivery & template files</summary>
                <div className="wiz-advanced-body">
                  <label className="wiz-field">
                    <span className="wiz-label">GitOps template</span>
                    <select
                      className="wiz-input"
                      value={gitopsTemplate}
                      onChange={(event) => setGitopsTemplate(event.target.value)}
                    >
                      {options?.gitopsTemplates.map((template) => (
                        <option key={template.name} value={template.name}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                    <span className="wiz-hint">How the {thing} is packaged &amp; deployed. The default is usually right.</span>
                  </label>

                  <div className="mc-detail-grid">
                    <article className="wiz-template-card">
                      <h3>Service template files</h3>
                      <ul className="wiz-file-list">
                        {(selectedServiceTemplate?.previewFiles ?? []).map((file) => (
                          <li key={`service-${file}`}>
                            <code>{file}</code>
                            <button
                              type="button"
                              className="mc-link-all"
                              onClick={() => void onOpenTemplateFile("service", selectedServiceTemplate?.name ?? "", file)}
                              disabled={fileViewerLoading}
                            >
                              View
                            </button>
                          </li>
                        ))}
                        {(selectedServiceTemplate?.previewFiles ?? []).length === 0 && <li className="mc-muted">no files</li>}
                      </ul>
                    </article>
                    <article className="wiz-template-card">
                      <h3>GitOps template files</h3>
                      <ul className="wiz-file-list">
                        {(selectedGitopsTemplate?.previewFiles ?? []).map((file) => (
                          <li key={`gitops-${file}`}>
                            <code>{file}</code>
                            <button
                              type="button"
                              className="mc-link-all"
                              onClick={() => void onOpenTemplateFile("gitops", selectedGitopsTemplate?.name ?? "", file)}
                              disabled={fileViewerLoading}
                            >
                              View
                            </button>
                          </li>
                        ))}
                        {(selectedGitopsTemplate?.previewFiles ?? []).length === 0 && <li className="mc-muted">no files</li>}
                      </ul>
                    </article>
                  </div>
                </div>
              </details>

              {fileViewerPanel}
            </section>
          )}

          {step === 3 && (
            <section className="mc-panel wiz-step-panel">
              <h2 className="wiz-step-title">{mode === "interstellar" ? "Calibration" : "Service configuration"}</h2>
              <p className="wiz-step-sub">
                Tune the <code>overrides</code> for this {thing} — gateway, image and env. Edit as a form or as raw YAML.
              </p>

              <p className="wiz-note">
                <strong>Day-0 bootstrap only.</strong> These overrides seed the initial{" "}
                <code>services.yaml</code> entry — the platform&apos;s <strong>desired-state catalog</strong>, not the
                running configuration. Once created, the {thing} is configured through its own generated GitOps config
                (<code>services/{trimmedName || "<name>"}/chart</code>): <code>services.yaml</code> tracks <em>what
                should exist</em>; the chart is <em>how it actually runs</em>.
              </p>

              <ConfigEditor
                editorMode={editorMode}
                onSetEditorMode={changeEditorMode}
                serviceName={serviceName}
                gatewayEnabled={gatewayEnabled}
                onGatewayChange={setGatewayEnabled}
                imageOverride={imageOverride}
                onImageChange={setImageOverride}
                envRows={envRows}
                onEnvRowsChange={setEnvRows}
                yamlText={yamlText}
                onYamlChange={setYamlText}
                onYamlBlur={onYamlBlur}
                onValidate={onGeneratePreview}
                validating={previewing}
                yamlError={yamlError}
                unknownKeysWarning={unknownKeysWarning}
              />

              {previewResult ? (
                <section className="wiz-preview">
                  <div className="mc-panel-head">
                    <h3 className="mc-panel-title">Preview</h3>
                    <span className="mc-count-chip">{previewResult.generatedFiles.length} files</span>
                  </div>
                  <ul className="wiz-file-list">
                    {previewResult.generatedFiles.map((file) => (
                      <li key={file.path}>
                        <code>{file.path}</code>
                        <span className="mc-muted">{file.size} b</span>
                        {typeof file.content === "string" ? (
                          <button type="button" className="mc-link-all" onClick={() => onOpenGeneratedFile(file)}>
                            View
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : (
                <p className="mc-muted wiz-preview-hint">Generate a preview to inspect the files before creating.</p>
              )}

              {fileViewerPanel}
            </section>
          )}

          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}

          <div className="wiz-nav">
            {step > 1 ? (
              <button type="button" className="mc-btn mc-btn-soft" onClick={goBack}>
                <Icon.ChevronLeft size={15} />
                Back
              </button>
            ) : null}
            <span className="wiz-nav-spacer" />
            {step < 3 ? (
              <button type="button" className="mc-btn" onClick={goNext} disabled={step === 1 && !step1Valid}>
                Next
                <Icon.ArrowRight size={14} />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="mc-btn mc-btn-soft"
                  onClick={onGeneratePreview}
                  disabled={previewing || submitting}
                >
                  {previewing ? "Generating…" : "Generate preview"}
                </button>
                <button type="submit" className="mc-btn" disabled={submitting || previewing || !isPreviewCurrent}>
                  <Icon.Plus size={15} />
                  {submitting ? "Creating…" : t.createCta}
                </button>
              </>
            )}
          </div>
          {step === 3 && !isPreviewCurrent ? (
            <p className="mc-muted wiz-preview-hint">Generate a preview of the current values before creating.</p>
          ) : null}
        </form>
      )}
    </div>
  );
}
