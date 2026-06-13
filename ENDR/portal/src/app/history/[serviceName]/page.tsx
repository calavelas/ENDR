export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";

import { ServiceHistoryPanel } from "./service-history-panel";

interface ServiceHistoryPageProps {
  params: Promise<{
    serviceName: string;
  }>;
}

export default async function ServiceHistoryPage({ params }: ServiceHistoryPageProps) {
  const { serviceName } = await params;
  const decodedServiceName = decodeURIComponent(serviceName);

  return (
    <>
      <section className="portal-main">
        <section className="hero-row">
          <div>
            <p className="eyebrow">Audit</p>
            <h1>Service History: {decodedServiceName}</h1>
            <p className="hero-subtitle">service PR and pipeline lifecycle for this service.</p>
          </div>
          <Link className="open-link" href="/history">
            Back to History
          </Link>
        </section>

        <ServiceHistoryPanel serviceName={decodedServiceName} />
      </section>
    </>
  );
}
