import { Feed } from "@/components/Feed";
import { Intro } from "@/components/Intro";
import { Shell, AppHeader } from "@/components/Shell";

export default function Home() {
  return (
    <Shell>
      <AppHeader brand title="FINN" subtitle="What changed in your portfolio — most important first." />
      <Intro />
      <Feed />
    </Shell>
  );
}
