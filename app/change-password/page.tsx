"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/supabaseClient";

export default function ChangePasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 로그인 페이지에서 전달된 student_id
  const studentId = searchParams.get("student_id") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!newPassword || !confirmPassword) {
      setError("비밀번호를 모두 입력해주세요.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    // 1) students_auth 테이블에서 temp_password & must_change_password 업데이트
    const { error: updateError } = await supabase
      .from("students_auth")
      .update({
        temp_password: newPassword,
        must_change_password: false,
      })
      .eq("student_id", studentId);

    if (updateError) {
      setError("비밀번호 변경 중 오류가 발생했습니다.");
      return;
    }

    // UI 문구 그대로 유지
    setSuccess("새로운 비번으로 변경하고\n다시 로그인 시 사용이 가능합니다.");

    // 입력칸 초기화
    setNewPassword("");
    setConfirmPassword("");

    // 1초 후 학생 페이지로 이동
    setTimeout(() => {
      router.push("/student");
    }, 1000);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundImage: `url('/dorm.jpg')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div
        style={{
          width: "380px",
          padding: "56px",
          borderRadius: "20px",
          background: "rgba(255, 255, 255, 0.18)",
          backdropFilter: "blur(15px)",
          WebkitBackdropFilter: "blur(15px)",
          border: "2px solid rgba(255,255,255,0.26)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
        }}
      >
        <h1
          style={{
            textAlign: "center",
            marginBottom: "20px",
            letterSpacing: "5px",
            fontSize: "54px",
            fontWeight: "700",
            background: "linear-gradient(180deg, #333, #111)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          비밀번호 변경
        </h1>

        <p
          style={{
            textAlign: "center",
            color: "#fff",
            marginBottom: "40px",
            fontSize: "14px",
            fontWeight: "500",
            whiteSpace: "pre-line",
          }}
        >
          {success || "새로운 비번으로 변경하고\n다시 로그인 시 사용이 가능합니다."}
        </p>

        <form onSubmit={handleChangePassword}>
          <input
            type="password"
            placeholder="새 비밀번호"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "14px",
              borderRadius: "22px",
              border: "1px solid rgba(255,255,255,0.45)",
              background: "rgba(255,255,255,0.16)",
              color: "#fff",
            }}
          />

          <input
            type="password"
            placeholder="비밀번호 확인"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "14px",
              borderRadius: "22px",
              border: "1px solid rgba(255,255,255,0.45)",
              background: "rgba(255,255,255,0.16)",
              color: "#fff",
            }}
          />

          {error && (
            <p
              style={{
                color: "#D7FF42",
                marginBottom: "10px",
                fontSize: "12px",
                textAlign: "center",
                fontWeight: "500",
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            style={{
              width: "100%",
              padding: "15px",
              background: "#141414",
              color: "#fff",
              border: "none",
              borderRadius: "14px",
              cursor: "pointer",
              fontSize: "17px",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
            }}
          >
            비밀번호 변경
          </button>
        </form>
      </div>
    </div>
  );
}
