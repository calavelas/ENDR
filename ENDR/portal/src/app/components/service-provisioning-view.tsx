"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useNarrative } from "../lib/narrative";
import { DecommissionButton } from "./service-detail-view";
import * as Icon from "./icons";

interface ServiceProvisioningViewProps {
  name: string;
  argoUrl: string;
  accessHost: string;
  accessUrl: string;
  decommissionable: boolean;
  decommissionReason?: string;
  protectedUnit?: boolean;
  // pending = the create PR may not have merged yet (not in the catalog), so we
  // can't yet confirm it's a real service. Softer copy, and no teardown action.
  pending?: boolean;
}

// Shown for a service that's in the catalog (services.yaml) but hasn't been
// synced into the live cluster yet — i.e. you just created it. Instead of a hard
// 404, we tell the user it's on the way, auto-refresh until it appears, and still
// offer Decommission so they're never stuck waiting on a service they can't manage.
export function ServiceProvisioningView({
  name,
  argoUrl,
  accessHost,
  accessUrl,
  decommissionable,
  decommissionReason,
  protectedUnit,
  pending,
}: ServiceProvisioningViewProps) {
  const router = useRouter();
  const { mode } = useNarrative();
  const unit = mode === "interstellar" ? "robot" : "service";

  // Poll the server component until the service shows up live, then this page
  // re-renders as the real detail view automatically.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 12000);
    return () => clearInterval(id);
  }, [router]);

  return (
    <div className="mc">
      <Link className="mc-back" href="/catalog">
        <Icon.ChevronLeft size={15} />
        Back to catalog
      </Link>

      <div className="mc-detail-head">
        <h1 className="mc-detail-title">{name}</h1>
        <span className="mc-badge warn">
          <span className="mc-badge-dot" />
          Provisioning
        </span>
      </div>

      <section className="mc-panel">
        <div className="mc-prov">
          <span className="mc-prov-spin" aria-hidden="true" />
          <div className="mc-prov-text">
            <h2 className="mc-prov-title">
              {pending ? `This ${unit} is being created` : `This ${unit} is on its way`}
            </h2>
            <p className="mc-prov-body">
              {pending ? (
                <>
                  Your pull request just opened and is merging now. The {unit} appears
                  here a minute or two after that — this page refreshes itself, so just
                  hang on, no need to reload. (If you didn&apos;t just create{" "}
                  <code>{name}</code>, it may not exist or may have been removed.)
                </>
              ) : (
                <>
                  It&apos;s in the catalog and the pull request has merged — ArgoCD is
                  syncing it into the cluster now. This page turns into the live {unit}{" "}
                  view automatically once it&apos;s up (usually a minute or two); it&apos;s
                  refreshing on its own, no need to reload.
                </>
              )}
            </p>
          </div>
        </div>

        <ol className="mc-steps" aria-label="while you wait">
          <li>
            <span className="mc-step-title">Watch it sync in ArgoCD</span>
            <p className="mc-step-body">
              Open the <b>services</b> app-of-apps and hit <b>Refresh</b> if you want to
              push the rollout along.
            </p>
            {argoUrl ? (
              <a className="mc-step-link" href={argoUrl} target="_blank" rel="noreferrer">
                Open in ArgoCD <Icon.ExternalLink size={12} />
              </a>
            ) : null}
          </li>
          <li>
            <span className="mc-step-title">Follow the delivery</span>
            <p className="mc-step-body">See the pull request and pipeline that shipped it.</p>
            <Link className="mc-step-link" href={`/history/${encodeURIComponent(name)}`}>
              Open delivery <Icon.ChevronRight size={12} />
            </Link>
          </li>
          <li>
            <span className="mc-step-title">Once it&apos;s live</span>
            <p className="mc-step-body">
              It serves at <code>{accessHost}</code>.
            </p>
            <a className="mc-step-link" href={accessUrl} target="_blank" rel="noreferrer">
              Open {accessHost} <Icon.ExternalLink size={12} />
            </a>
          </li>
        </ol>

        <div className="mc-prov-foot">
          <Link href="/dashboard" className="mc-btn mc-btn-sm mc-btn-soft">
            Back to dashboard
          </Link>
          <DecommissionButton
            name={name}
            decommissionable={!!decommissionable && !protectedUnit}
            reason={decommissionReason}
          />
        </div>
      </section>
    </div>
  );
}
