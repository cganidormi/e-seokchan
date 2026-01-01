"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiLogIn } from "react-icons/fi";
import { supabase } from "@/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    let user: any = null;
    let role: "student" | "teacher" | null = null;

    // 1️⃣ 학생 auth 조회
    const { data: student } = await supabase
      .from("students_auth")
      .select("*")
      .eq("student_id", loginId)
      .single();

    if (student) {
      user = student;
      role = "student";
    }

    // 2️⃣ 학생이 아니면 교사 auth 조회
    if (!user) {
      const { data: teacher } = await supabase
        .from("teachers_auth")
        .select("*")
        .eq("teacher_id", loginId)
        .single();

      if (teacher) {
        user = teacher;
        role = "teacher";
      }
    }

    // 3️⃣ 둘 다 없으면 실패
    if (!user || !role) {
      setError("아이디 또는 비밀번호가 잘못되었습니다.");
      return;
    }

    // 4️⃣ 비밀번호 확인
    if (String(user.temp_password) !== String(password)) {
      setError("아이디 또는 비밀번호가 잘못되었습니다.");
      return;
    }

    // 5️⃣ 최초 로그인 여부
    const mustChange =
      user.must_change_password === true ||
      user.must_change_password === "true" ||
      user.must_change_password === 1 ||
      user.must_change_password === "1";

    if (mustChange) {
      router.push(
        `/change-password?id=${encodeURIComponent(loginId)}&role=${role}`
      );
      return;
    }

    // 6️⃣ 로그인 상태 저장
    const storage = keepLoggedIn ? localStorage : sessionStorage;

    // 다른 저장소에 있는 기존 세션은 삭제하여 충돌 방지
    const otherStorage = keepLoggedIn ? sessionStorage : localStorage;
    otherStorage.removeItem("dormichan_login_id");
    otherStorage.removeItem("dormichan_role");
    otherStorage.removeItem("dormichan_keepLoggedIn");

    storage.setItem("dormichan_login_id", loginId);
    storage.setItem("dormichan_role", role);
    storage.setItem("dormichan_keepLoggedIn", keepLoggedIn ? "true" : "false");

    // 7️⃣ 역할별 페이지 이동
    if (role === "student") {
      router.push("/student");
    } else if (role === "teacher") {
      router.push("/teacher");
    }
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
          이석찬
        </h1>

        <p
          style={{
            textAlign: "center",
            color: "#fff",
            marginBottom: "40px",
            fontSize: "14px",
            fontWeight: "500",
          }}
        >
          KSHS 통합 이석 관리 플랫폼
        </p>

        <form onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="아이디 (학번+이름 / 교사이름)"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
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
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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

          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "20px",
            paddingLeft: "8px"
          }}>
            <input
              type="checkbox"
              id="keepLoggedIn"
              checked={keepLoggedIn}
              onChange={(e) => setKeepLoggedIn(e.target.checked)}
              style={{
                width: "16px",
                height: "16px",
                cursor: "pointer",
                accentColor: "#D7FF42"
              }}
            />
            <label
              htmlFor="keepLoggedIn"
              style={{
                color: "#fff",
                fontSize: "13px",
                cursor: "pointer",
                fontWeight: "500"
              }}
            >
              로그인 유지
            </label>
          </div>

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
            <FiLogIn size={20} />
            로그인
          </button>
        </form>
      </div>
    </div>
  );
}
