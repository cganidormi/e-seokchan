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

    // 1) Supabase users에서 username 조회
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("username", loginId)
      .single();

    if (userError || !user) {
      setError("아이디 또는 비밀번호가 잘못되었습니다.");
      return;
    }

    // 2) 비밀번호 비교
    if (user.password !== password) {
      setError("아이디 또는 비밀번호가 잘못되었습니다.");
      return;
    }

    // 3) 비밀번호 변경 필요
    if (user.must_change_password) {
      router.push(`/change-password?uid=${user.id}`);
      return;
    }

    // 4) 역할에 따라 이동
    if (user.role === "student") {
      router.push("/student");
    } else if (user.role === "teacher") {
      router.push("/teacher");
    } else {
      router.push("/admin");
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
          {/* 아이디 */}
          <input
            type="text"
            placeholder="아이디"
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

          {/* 비밀번호 */}
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

          {/* 로그인 상태 유지 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "16px",
              gap: "8px",
              fontSize: "13px",
              color: "#fff",
              cursor: "pointer",
            }}
            onClick={() => setKeepLoggedIn(!keepLoggedIn)}
          >
            <span
              style={{
                width: "18px",
                height: "18px",
                borderRadius: "6px",
                border: "2px solid #fff",
                display: "inline-block",
                background: keepLoggedIn ? "#1A1A1A" : "transparent",
                position: "relative",
              }}
            >
              {keepLoggedIn && (
                <svg
                  viewBox="0 0 24 24"
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "12px",
                    height: "12px",
                    fill: "#D7FF42",
                  }}
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </span>
            <label>로그인 상태 유지</label>
          </div>

          {/* 에러 메시지 */}
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

          {/* 로그인 버튼 */}
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
