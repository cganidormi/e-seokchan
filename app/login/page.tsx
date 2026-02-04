"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FiLogIn } from "react-icons/fi";
import { supabase } from "@/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [dbStatus, setDbStatus] = useState("시스템 점검 중...");

  // DB 연결 상태 확인
  useEffect(() => {
    const checkDb = async () => {
      const { error } = await supabase.from('students_auth').select('student_id').limit(1);
      if (error) {
        setDbStatus(`시스템 연결 실패: ${error.message}`);
      } else {
        setDbStatus("시스템 연결 정상");
      }
    };
    checkDb();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // 전각 숫자 -> 반각 변환 및 공백 제거
    // ０-９ (Full-width digits) to 0-9
    const cleanId = loginId.trim().replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));

    let user: any = null;
    let role: "student" | "teacher" | null = null;

    // 1️⃣ 학생 auth 조회
    const { data: student, error: studentError } = await supabase
      .from("students_auth")
      .select("*")
      .eq("student_id", cleanId)
      .single();

    if (student) {
      user = student;
      role = "student";
    }

    // 2️⃣ 학생이 아니면 교사 auth 조회
    if (!user) {
      const { data: teacher, error: teacherError } = await supabase
        .from("teachers_auth")
        .select("*")
        .eq("teacher_id", cleanId)
        .single();

      if (teacher) {
        user = teacher;
        role = "teacher";
      }
    }

    // 3️⃣ 둘 다 없으면 실패
    if (!user || !role) {
      setError(`계정을 찾을 수 없습니다. (ID: ${cleanId})`);
      return;
    }

    if (String(user.temp_password) !== String(password)) {
      setError("비밀번호가 틀렸습니다.");
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
        `/change-password?id=${encodeURIComponent(cleanId)}&role=${role}`
      );
      return;
    }

    // 6️⃣ 로그인 상태 저장 (무조건 localStorage 사용)
    const storage = localStorage;

    // sessionStorage 기존 세션 삭제 (충돌 방지)
    sessionStorage.removeItem("dormichan_login_id");
    sessionStorage.removeItem("dormichan_role");
    sessionStorage.removeItem("dormichan_keepLoggedIn");

    storage.setItem("dormichan_login_id", cleanId);
    storage.setItem("dormichan_role", role);
    storage.setItem("dormichan_keepLoggedIn", "true");

    storage.setItem("dormichan_role", role);
    storage.setItem("dormichan_keepLoggedIn", "true");

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
          KSHS 통합 이석 관리 플랫폼 v2.1
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
                color: "#ff6b6b",
                marginBottom: "10px",
                fontSize: "14px",
                textAlign: "center",
                fontWeight: "700",
                backgroundColor: "rgba(0,0,0,0.5)",
                padding: "8px",
                borderRadius: "10px"
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
            <FiLogIn size={20} />
            로그인
          </button>
        </form>

        <div style={{
          marginTop: '20px',
          color: '#eee',
          fontSize: '12px',
          textAlign: 'center',
          background: 'rgba(0,0,0,0.3)',
          padding: '8px',
          borderRadius: '5px'
        }}>
          {dbStatus}
        </div>
      </div>
    </div>
  );
}
