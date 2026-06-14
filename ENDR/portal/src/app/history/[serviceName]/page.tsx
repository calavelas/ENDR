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

      <ServiceHistoryPanel serviceName={decodedServiceName} />
    </div>
  );
}
