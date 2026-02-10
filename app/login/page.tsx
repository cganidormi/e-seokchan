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
  const [isParentMode, setIsParentMode] = useState(false);
  const [parentToken, setParentToken] = useState("");
  const [dbStatus, setDbStatus] = useState("시스템 점검 중...");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

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

  const handleParentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    let tokenToUse = parentToken.trim();

    // 혹시라도 "링크 전체"를 붙여넣었을 경우를 대비해 토큰만 추출
    // 예: https://.../?token=abc -> abc 추출
    if (tokenToUse.includes('token=')) {
      try {
        // URL 객체로 만들어서 파싱 시도 (완전한 URL인 경우)
        const url = new URL(tokenToUse);
        const extracted = url.searchParams.get('token');
        if (extracted) tokenToUse = extracted;
      } catch (e) {
        // URL 형식이 아닐 수도 있으니 단순 문자열 파싱 시도
        const match = tokenToUse.match(/token=([^&]*)/);
        if (match && match[1]) {
          tokenToUse = match[1];
        }
      }
    }

    if (!tokenToUse) {
      setError("토큰을 입력해주세요.");
      return;
    }

    // 토큰 유효성 검사 (students 테이블 조회)
    const { data: student, error } = await supabase
      .from('students')
      .select('name, grade, class')
      .eq('parent_token', tokenToUse)
      .single();

    if (error || !student) {
      setError("유효하지 않은 토큰입니다. 다시 확인해주세요.");
      return;
    }

    // 토큰 저장 및 이동
    localStorage.setItem('dormichan_parent_token', tokenToUse);

    // 기존 로그인 정보 삭제 (충돌 방지)
    localStorage.removeItem('dormichan_login_id');
    localStorage.removeItem('dormichan_role');
    localStorage.removeItem('dormichan_keepLoggedIn');
    sessionStorage.removeItem('dormichan_login_id');
    sessionStorage.removeItem('dormichan_role');

    // 성공 메시지 및 이동
    alert(`${student.grade}학년 ${student.class}반 ${student.name} 학생의 학부모님, 환영합니다!`);
    router.replace(`/parent?token=${tokenToUse}`);
  };

  const completeLogin = (id: string, role: string) => {
    localStorage.setItem("dormichan_login_id", id);
    localStorage.setItem("dormichan_role", role);
    localStorage.setItem("dormichan_keepLoggedIn", "true");

    sessionStorage.removeItem("dormichan_login_id");
    sessionStorage.removeItem("dormichan_role");

    // Use hard window location replace to be absolute
    if (role === "monitor") {
      window.location.replace("/student/seats");
    } else if (role === "teacher") {
      window.location.replace("/teacher");
    } else {
      window.location.replace("/student");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn) return;

    setError("");
    setIsLoggingIn(true);

    try {
      window.alert("로그인 버튼 클릭됨: ID=" + loginId);
      const rawId = loginId || "";
      const id = rawId.trim().normalize('NFC').replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
      const pw = password.trim();

      if (!id) {
        setError("아이디를 입력해주세요.");
        setIsLoggingIn(false);
        return;
      }

      // Check Student
      const { data: student } = await supabase.from("students_auth").select("*").eq("student_id", id).maybeSingle();
      if (student && String(student.temp_password || student.password) === pw) {
        completeLogin(id, "student");
        return;
      }

      // Check Teacher
      const { data: teacher } = await supabase.from("teachers_auth").select("*").eq("teacher_id", id).maybeSingle();
      if (teacher && String(teacher.temp_password || teacher.password) === pw) {
        completeLogin(id, "teacher");
        return;
      }

      // Check Monitor
      const { data: monitor } = await supabase.from("monitors_auth").select("*").eq("monitor_id", id).maybeSingle();
      if (monitor) {
        if (String(monitor.password || monitor.temp_password) === pw) {
          completeLogin(id, "monitor");
          return;
        } else {
          window.alert("모니터 계정은 맞으나 비밀번호가 틀렸습니다.");
        }
      } else {
        console.log("No monitor found with ID:", id);
      }

      setError("아이디 또는 비밀번호가 틀렸습니다.");
    } catch (err: any) {
      console.error("Login fatal error:", err);
      setError("로그인 중 오류가 발생했습니다. (" + (err.message || 'unknown') + ")");
    } finally {
      setIsLoggingIn(false);
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
            cursor: "pointer"
          }}
          onClick={() => setIsParentMode(false)} // 로고 누르면 기본 모드로
        >
          이석찬
        </h1>

        <p
          style={{
            textAlign: "center",
            color: "#fff",
            marginBottom: "20px",
            fontSize: "14px",
            fontWeight: "500",
          }}
        >
          {isParentMode ? "학부모 전용 로그인" : "KSHS 통합 이석 관리 플랫폼"}
        </p>

        {/* --- Toggle Buttons --- */}
        <div className="flex gap-2 mb-6 p-1 bg-white/20 rounded-xl">
          <button
            onClick={() => { setIsParentMode(false); setError(""); }}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${!isParentMode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-200 hover:text-white'}`}
          >
            학생/교사
          </button>
          <button
            onClick={() => { setIsParentMode(true); setError(""); }}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${isParentMode ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-200 hover:text-white'}`}
          >
            학부모
          </button>
        </div>
        {/* ---------------------- */}

        {isParentMode ? (
          // --- Parent Login Form ---
          <form onSubmit={handleParentLogin}>
            <input
              type="text"
              placeholder="전달받은 토큰을 입력하세요"
              value={parentToken}
              onChange={(e) => setParentToken(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                marginBottom: "14px",
                borderRadius: "22px",
                border: "1px solid rgba(255,255,255,0.45)",
                background: "rgba(255,255,255,0.16)",
                color: "#fff",
                textAlign: "center",
                fontWeight: "bold",
                letterSpacing: "1px"
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
              className="bg-gradient-to-r from-orange-500 to-pink-500 hover:scale-105 active:scale-95"
              style={{
                width: "100%",
                padding: "15px",
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
                transition: "all 0.2s"
              }}
            >
              <FiLogIn size={20} />
              학부모 입장하기
            </button>
            <p className="text-gray-300 text-xs text-center mt-4 leading-relaxed">
              * 링크가 작동하지 않거나 앱 설치 후<br />
              로그인이 필요한 경우 이용해주세요.
            </p>
          </form>
        ) : (
          // --- Student/Teacher Login Form (Existing) ---
          <form onSubmit={handleLogin}>
            <input
              type="text"
              placeholder="아이디 (학번+이름 / 교사이름 / 모니터ID)"
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
              disabled={isLoggingIn}
              style={{
                width: "100%",
                padding: "15px",
                background: isLoggingIn ? "#333" : "#141414",
                color: "#fff",
                border: "none",
                borderRadius: "14px",
                cursor: isLoggingIn ? "wait" : "pointer",
                fontSize: "17px",
                fontWeight: "600",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                opacity: isLoggingIn ? 0.7 : 1
              }}
            >
              {isLoggingIn ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <FiLogIn size={20} />
              )}
              {isLoggingIn ? "로그인 중..." : "로그인"}
            </button>
          </form>
        )}

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
