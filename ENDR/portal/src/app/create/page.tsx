export const dynamic = "force-dynamic";
export const revalidate = 0;

import { CreateHero } from "./create-hero";
import { CreateServicePanel } from "./service-create-panel";

export default function CreatePage() {
  return (
    <div className="mc create-main">
      <CreateHero />

      <CreateServicePanel />
    </div>
  );
}
