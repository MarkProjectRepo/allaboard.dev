"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/db";

export default function StatsRedirect() {
  const router = useRouter();

  useEffect(() => {
    void getCurrentUser().then((me) => {
      if (me) router.replace(`/user/${me.handle}/stats`);
      else router.replace("/");
    });
  }, [router]);

  return <div className="text-stone-500 text-center py-16">Loading…</div>;
}
