import { Shell, AppHeader } from "@/components/Shell";
import { AlertsView } from "@/components/AlertsView";

export default function AlertsPage() {
  return (
    <Shell>
      <AppHeader title="Alerts" subtitle="Unusual volume or price moves in your stocks — on your own thresholds." />
      <AlertsView />
    </Shell>
  );
}
