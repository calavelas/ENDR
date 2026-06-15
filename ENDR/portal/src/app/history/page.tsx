export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Delivery — ENDR" };

import { CreateButton } from "../components/create-button";
import { Explain } from "../components/explain";
import { HistoryPanel } from "./history-panel";

export default function HistoryPage() {
  return (
    <div className="mc">
      <div className="mc-page-actions">
        <CreateButton />
      </div>

      <Explain
        idp={
          <>
            Every change ships as a <b>pull request</b>. This is the delivery trail — each PR, the CI
            checks that gated it, and the pipeline that merged and deployed it. The repo is the single
            source of truth.
          </>
        }
        interstellar={
          <>
            Every change ships as a <b>pull request</b> — the mission log. Each PR, the checks that
            gated it, and the pipeline that merged and launched it. The repo is the single source of
            truth.
          </>
        }
      />

      <HistoryPanel />
    </div>
  );
}
