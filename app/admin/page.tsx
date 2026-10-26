"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminMainPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/students");
  }, [router]);

  return null;
}
