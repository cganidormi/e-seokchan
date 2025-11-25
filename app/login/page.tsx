"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // 테스트용 계정 (나중에 DB로 대체됨)
  const TEST_USER = {
    login_id: "kimteacher",
    password: "1234",
    name: "김선생",
    role: "teacher"
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    if (loginId === TEST_USER.login_id && password === TEST_USER.password) {
      // 로그인 성공 → 메인 페이지 이동
      router.push("/main");
    } else {
      setError("사용자를 찾을 수 없습니다.");
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "50px auto" }}>
      <h1>로그인</h1>

      <form onSubmit={handleLogin}>
        <label>아이디</label>
        <input
          type="text"
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          style={{ width: "100%", padding: "8px", marginBottom: "12px" }}
        />

        <label>비밀번호</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: "8px", marginBottom: "12px" }}
        />

        {error && (
          <p style={{ color: "red", marginBottom: "12px" }}>{error}</p>
        )}

        <button
          type="submit"
          style={{
            width: "100%",
            padding: "10px",
            background: "black",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          로그인
        </button>
      </form>
    </div>
  );
}
