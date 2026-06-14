export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";

import * as Icon from "../../components/icons";
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
    <div className="mc">
      <Link className="mc-back" href="/history">
        <Icon.ChevronLeft size={15} />
        Back to delivery
      </Link>

      <div className="mc-detail-head">
        <h1 className="mc-detail-title">{decodedServiceName}</h1>
        <span className="mc-detail-sub">Delivery history</span>
      </div>

      <ServiceHistoryPanel serviceName={decodedServiceName} />
    </div>
  );
}
