"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function ProfileRedirect() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace(`/user/${user.handle}`);
    } else {
      router.replace("/api/auth/google");
    }
  }, [user, loading, router]);

  return <div className="text-stone-500 text-center py-16">Redirecting…</div>;
}
