"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/supabaseClient";

function ChangePasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const loginId = searchParams.get("id") || "";
  const role = searchParams.get("role") || "student";

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

    const table = role === "teacher" ? "teachers_auth" : "students_auth";
    const idField = role === "teacher" ? "teacher_id" : "student_id";

    const { error: updateError } = await supabase
      .from(table)
      .update({
        temp_password: newPassword,
        must_change_password: false,
      })
      .eq(idField, loginId);

    if (updateError) {
      setError("비밀번호 변경 중 오류가 발생했습니다.");
      return;
    }

    setSuccess("새로운 비밀번호로 변경되었습니다. 다시 로그인 해주세요.");

    setNewPassword("");
    setConfirmPassword("");

    // 로그인 정보 저장
    localStorage.setItem("dormichan_login_id", loginId);
    localStorage.setItem("dormichan_role", role);

    // role별 페이지 이동
    setTimeout(() => {
      if (role === "teacher") {
        router.push("/teacher");
      } else {
        router.push("/student");
      }
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
          {success || "새로운 비번으로 변경하고\n다시 로그인 시 사용이 가능합니다.\n\n(본인이 기억하기 쉬운 비번을 설정해주세요 제발 🙏)"}
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
            }}
          >
            비밀번호 변경
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
        로딩 중...
      </div>
    }>
      <ChangePasswordContent />
    </Suspense>
  );
}
