"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiLogIn } from "react-icons/fi";

export default function LoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);

  // 테스트용 계정
  const TEST_USER = {
    login_id: "kimteacher",
    password: "1234",
    name: "김선생",
    role: "teacher", // student / teacher / admin
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    // 로그인 검증
    if (loginId === TEST_USER.login_id && password === TEST_USER.password) {
      // 역할 기반 페이지 이동
      if (TEST_USER.role === "student") router.push("/student");
      else if (TEST_USER.role === "teacher") router.push("/teacher");
      else router.push("/admin");
    } else {
      setError("사용자를 찾을 수 없습니다.");
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
        {/* 타이틀 */}
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

        {/* 서브 타이틀 */}
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
              outline: "none",
              transition: "0.25s",
              boxShadow:
                "inset 1px 1px 6px rgba(0,0,0,0.5), inset -2px -2px 6px rgba(255,255,255,0.2)",
            }}
            onFocus={(e) =>
              (e.target.style.boxShadow =
                "inset 1px 1px 8px rgba(0,0,0,0.6), inset -2px -2px 6px rgba(255,255,255,0.25)")
            }
            onBlur={(e) =>
              (e.target.style.boxShadow =
                "inset 1px 1px 6px rgba(0,0,0,0.5), inset -2px -2px 6px rgba(255,255,255,0.2)")
            }
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
              outline: "none",
              transition: "0.25s",
              boxShadow:
                "inset 1px 1px 6px rgba(0,0,0,0.5), inset -2px -2px 6px rgba(255,255,255,0.2)",
            }}
            onFocus={(e) =>
              (e.target.style.boxShadow =
                "inset 1px 1px 8px rgba(0,0,0,0.6), inset -2px -2px 6px rgba(255,255,255,0.25)")
            }
            onBlur={(e) =>
              (e.target.style.boxShadow =
                "inset 1px 1px 6px rgba(0,0,0,0.5), inset -2px -2px 6px rgba(255,255,255,0.2)")
            }
          />

          {/* 로그인 상태 유지 체크박스 */}
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
            <input
              type="checkbox"
              checked={keepLoggedIn}
              onChange={(e) => setKeepLoggedIn(e.target.checked)}
              style={{ display: "none" }}
            />
            <span
              style={{
                width: "18px",
                height: "18px",
                borderRadius: "6px",
                border: "2px solid #fff",
                display: "inline-block",
                background: keepLoggedIn ? "#1A1A1A" : "transparent",
                position: "relative",
                transition: "0.25s",
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
            <label style={{ userSelect: "none" }}>로그인 상태 유지</label>
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
                textShadow: "0 0 6px rgba(215,255,66,0.6)",
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
              transition: "0.25s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#1d1d1d")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#141414")}
          >
            <FiLogIn size={20} />
            로그인
          </button>
        </form>
      </div>
    </div>
  );
}
