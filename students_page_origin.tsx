"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/supabaseClient";
import toast, { Toaster } from "react-hot-toast";

interface Student {
  grade: number;
  class: number;
  number: number;
  name: string;
  weekend: boolean;
  student_id?: string | null;
  parent_token?: string | null;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [originalStudents, setOriginalStudents] = useState<Student[]>([]);

  const grades = [1, 2, 3];
  const classes = [1, 2, 3];
  const numbers = Array.from({ length: 22 }, (_, i) => i + 1);

  useEffect(() => {
    fetchStudents();
  }, []);

  // -------------------------
  // ?꾩떆 鍮꾨?踰덊샇 (怨좎젙 1234)
  // -------------------------
  const generateTempPassword = () => "1234";

  // ----------------------------------------
  // UUID ?앹꽦 (釉뚮씪?곗? ?명솚?깆슜)
  // ----------------------------------------
  const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // -------------------------
  // ?숈깮 ?곗씠??遺덈윭?ㅺ린
  // -------------------------
  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .order("grade")
      .order("class")
      .order("number");

    // [New] Fetch Monthly Return Applications for Current Month
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const { data: monthlyData } = await supabase
      .from('monthly_return_applications')
      .select('student_id')
      .eq('target_year', currentYear)
      .eq('target_month', currentMonth);

    const monthlySet = new Set(monthlyData?.map((d: any) => d.student_id));

    if (error) {
      toast.error("?숈깮 ?곗씠??濡쒕뱶 ?ㅽ뙣");
      return;
    }

    if (data) {
      const fullList: Student[] = [];

      grades.forEach((g) =>
        classes.forEach((c) =>
          numbers.forEach((n) => {
            const found = data.find(
              (s) => s.grade === g && s.class === c && s.number === n
            );
            fullList.push({
              grade: g,
              class: c,
              number: n,
              name: found?.name || "",
              weekend: found?.weekend || (found?.student_id && monthlySet.has(found.student_id)) || false,
              student_id: found?.student_id || null,
              parent_token: found?.parent_token || null,
            });
          })
        )
      );

      setStudents(fullList);
      setOriginalStudents(JSON.parse(JSON.stringify(fullList)));
    }
  };

  // -------------------------
  // ?대쫫 蹂寃?  // -------------------------
  const handleNameChange = (
    grade: number,
    cls: number,
    num: number,
    value: string
  ) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.grade === grade && s.class === cls && s.number === num
          ? { ...s, name: value }
          : s
      )
    );
  };

  // -------------------------
  // 遺숈뿬?ｊ린 (?묒? ?깆뿉???щ윭 ?대쫫 蹂듭궗 ??
  // -------------------------
  const handlePaste = (
    grade: number,
    cls: number,
    num: number,
    e: React.ClipboardEvent
  ) => {
    const pasteData = e.clipboardData.getData("text");
    const names = pasteData
      .split(/\r?\n/)
      .map((name) => name.trim())
      .filter((name) => name.length > 0);

    if (names.length <= 1) return; // ??紐낆씠硫?湲곕낯 ?숈옉 ?좎?

    e.preventDefault();

    setStudents((prev) => {
      // ?꾩옱 諛섏쓽 ?꾩옱 踰덊샇遺???쒖옉?섏뿬 ?쒖감?곸쑝濡?梨꾩?
      const startIndex = prev.findIndex(
        (s) => s.grade === grade && s.class === cls && s.number === num
      );
      if (startIndex === -1) return prev;

      const newStudents = [...prev];
      names.forEach((name, i) => {
        if (startIndex + i < newStudents.length) {
          newStudents[startIndex + i] = {
            ...newStudents[startIndex + i],
            name,
          };
        }
      });
      return newStudents;
    });
  };

  // -------------------------
  // 留ㅼ＜洹媛 ?좉?
  // -------------------------
  const handleWeekendToggle = (grade: number, cls: number, num: number) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.grade === grade && s.class === cls && s.number === num
          ? { ...s, weekend: !s.weekend }
          : s
      )
    );
  };

  // -------------------------
  // ???(?뱀젙 ?숇뀈??students + students_auth)
  // -------------------------
  const handleSave = async (targetGrade: number) => {
    const changed = students.filter((s, idx) => {
      // ?대떦 ?숇뀈???곗씠?곕쭔 ?꾪꽣留?      if (s.grade !== targetGrade) return false;
      const o = originalStudents.find(
        (os) => os.grade === s.grade && os.class === s.class && os.number === s.number
      );
      if (!o) return true; // ?좉퇋 ?곗씠?곕㈃ 蹂寃쎈맂 寃껋쑝濡?媛꾩＜

      // 1. ?대쫫?대굹 二쇰쭚 ?ㅼ젙??諛붾?寃쎌슦
      if (s.name !== o.name || s.weekend !== o.weekend) return true;

      // 2. ?대쫫? ?덈뒗??遺紐??좏겙???녿뒗 寃쎌슦 (?좏겙 ?앹꽦???꾪빐 ??????
      if (!!s.name && !s.parent_token) return true;

      return false;
    });

    if (changed.length === 0) {
      toast(`${targetGrade}?숇뀈??蹂寃쎈맂 ?댁슜???놁뒿?덈떎.`);
      return;
    }

    // student_id ?앹꽦 (?대쫫 ?놁쓣 ?뚮뒗 怨꾩젙 ?앹꽦 X)
    const toStudentId = (s: Student) =>
      s.name && s.name.trim().length > 0
        ? `${s.grade}${s.class}${String(s.number).padStart(2, "0")}${s.name}`
        : null;

    // -------------------------
    // students ?낅뜲?댄듃
    // -------------------------
    const studentsUpserts = changed.map((s) => ({
      grade: s.grade,
      class: s.class,
      number: s.number,
      name: s.name,
      weekend: s.weekend,
      student_id: toStudentId(s),
      // Generate Token if missing and has valid info
      parent_token: s.parent_token || (s.name ? generateUUID() : null)
    }));

    const { error: studentsErr } = await supabase
      .from("students")
      .upsert(studentsUpserts, { onConflict: "grade,class,number" });

    if (studentsErr) {
      console.error(studentsErr);
      toast.error(`${targetGrade}?숇뀈 ?뺣낫 ????ㅽ뙣`);
      return;
    }

    // [New] Sync with Monthly Return Applications
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Separate lists for Add/Remove
    const toAdd = studentsUpserts.filter(s => s.weekend && s.student_id).map(s => ({
      student_id: s.student_id,
      target_year: currentYear,
      target_month: currentMonth
    }));

    // For deletion, we need student_ids of those unchecked
    const toRemoveIds = studentsUpserts.filter(s => !s.weekend && s.student_id).map(s => s.student_id);

    if (toAdd.length > 0) {
      await supabase.from('monthly_return_applications').upsert(toAdd, { onConflict: 'student_id, target_year, target_month' as any });
    }

    if (toRemoveIds.length > 0) {
      // Use "in" filter for bulk delete
      await supabase.from('monthly_return_applications')
        .delete()
        .in('student_id', toRemoveIds as any[])
        .eq('target_year', currentYear)
        .eq('target_month', currentMonth);
    }

    // -------------------------
    // students_auth ?낅뜲?댄듃
    // (?대쫫??蹂寃쎈맂 寃쎌슦 湲곗〈 怨꾩젙 ??젣 ???ъ깮??
    // -------------------------
    for (const s of changed) {
      const student_id = toStudentId(s);

      // ?댁쟾 ?숈깮 ?뺣낫 李얘린 (?댁쟾 ID ?뺤씤??
      const oldStudent = originalStudents.find(
        (o) => o.grade === s.grade && o.class === s.class && o.number === s.number
      );
      const old_student_id = oldStudent?.student_id;

      // 1. ?대쫫??諛붾뚯뿀嫄곕굹 ??젣??寃쎌슦 -> 湲곗〈 援ы삎 ?꾩씠????젣
      if (old_student_id && old_student_id !== student_id) {
        await supabase
          .from("students_auth")
          .delete()
          .eq("student_id", old_student_id);
      }

      // 2. 異붽? ?대┛?? 10101 媛숈? "?レ옄留??덈뒗 援ы삎 ?꾩씠?? 媛뺤젣 ??젣
      // ?숇쾲(G+CC+NN) ?뺤떇 ?꾩씠?붽? 議댁옱??寃쎌슦 ??젣?섏뿬 ?댁쨷 怨꾩젙 諛⑹?
      const legacy_id = `${s.grade}${String(s.class).padStart(2, "0")}${String(s.number).padStart(2, "0")}`;
      if (legacy_id !== student_id) {
        await supabase
          .from("students_auth")
          .delete()
          .eq("student_id", legacy_id);
      }

      // 3. ???대쫫???덉쑝硫?怨꾩젙 ?앹꽦/?낅뜲?댄듃
      if (student_id) {
        const { data: existing } = await supabase
          .from("students_auth")
          .select("*")
          .eq("student_id", student_id)
          .single();

        const tempPassword = existing?.temp_password || generateTempPassword();

        await supabase.from("students_auth").upsert(
          {
            student_id,
            username: student_id,
            temp_password: tempPassword,
            must_change_password: true,
          },
          { onConflict: "student_id" }
        );
      }
    }

    toast.success(`${targetGrade}?숇뀈 蹂寃쎈맂 ${changed.length}紐?????꾨즺`);

    // -------------------------
    // Credentials CSV Download
    // -------------------------
    if (changed.length > 0) {
      // Fetch latest auth info for changed students to get passwords
      const studentIds = changed.map(s => toStudentId(s)).filter(Boolean) as string[];
      if (studentIds.length > 0) {
        const { data: authData } = await supabase
          .from("students_auth")
          .select("student_id, temp_password")
          .in("student_id", studentIds);

        if (authData && authData.length > 0) {
          const csvRows = [
            ["?숇뀈", "諛?, "踰덊샇", "?대쫫", "?꾩씠??, "?꾩떆鍮꾨?踰덊샇", "?숇?紐⑤쭅??]
          ];

          changed.forEach(s => {
            const sid = toStudentId(s);
            const auth = authData.find(a => a.student_id === sid);
            if (sid && auth) {
              const link = s.parent_token ? `${window.location.origin}/parent?token=${s.parent_token}` : '';
              csvRows.push([
                s.grade.toString(),
                s.class.toString(),
                s.number.toString(),
                s.name,
                sid,
                auth.temp_password || '',
                link
              ]);
            }
          });

          if (csvRows.length > 1) {
            const csvContent = "\uFEFF" + csvRows.map(e => e.join(",")).join("\n");
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `${targetGrade}?숇뀈_怨꾩젙?뺣낫_?낅뜲?댄듃_${new Date().toLocaleDateString()}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("怨꾩젙 ?뺣낫 ?뚯씪???ㅼ슫濡쒕뱶?섏뿀?듬땲??");
          }
        }
      }
    }

    // 源딆? 蹂듭궗濡??먮낯 ?곹깭 ?낅뜲?댄듃
    setOriginalStudents(JSON.parse(JSON.stringify(students)));
    fetchStudents();
  };

  // -------------------------
  // ?꾩껜 怨꾩젙 ?뺣낫 ?ㅼ슫濡쒕뱶 (?숇뀈蹂?
  // -------------------------
  const handleDownloadCredentials = async (grade: number) => {
    const gradeStudents = students.filter(s => s.grade === grade && s.name);
    if (gradeStudents.length === 0) {
      toast.error("?ㅼ슫濡쒕뱶???숈깮 ?곗씠?곌? ?놁뒿?덈떎.");
      return;
    }

    const studentIds = gradeStudents.map(s => s.name ? `${s.grade}${s.class}${String(s.number).padStart(2, "0")}${s.name}` : '').filter(Boolean);

    const { data: authData } = await supabase
      .from("students_auth")
      .select("student_id, temp_password")
      .in("student_id", studentIds);

    const csvRows = [
      ["?숇뀈", "諛?, "踰덊샇", "?대쫫", "?꾩씠??, "?꾩떆鍮꾨?踰덊샇", "?숇?紐⑤쭅??]
    ];

    gradeStudents.forEach(s => {
      const sid = `${s.grade}${s.class}${String(s.number).padStart(2, "0")}${s.name}`;
      const auth = authData?.find(a => a.student_id === sid);
      const link = s.parent_token ? `${window.location.origin}/parent?token=${s.parent_token}` : '';

      csvRows.push([
        s.grade.toString(),
        s.class.toString(),
        s.number.toString(),
        s.name,
        sid,
        auth?.temp_password || '?ㅼ젙?덈맖',
        link
      ]);
    });

    const csvContent = "\uFEFF" + csvRows.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${grade}?숇뀈_?꾩껜怨꾩젙?뺣낫_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // -------------------------
  // 珥덇린??(?뱀젙 ?숇뀈??students + students_auth + 愿???곗씠??
  // -------------------------
  const handleReset = async (grade: number) => {
    if (
      !confirm(
        `?뺣쭚 ${grade}?숇뀈 ?곗씠?곕? 珥덇린?뷀븯?쒓쿋?듬땲源? 愿?⑤맂 紐⑤뱺 ?댁꽍 ?좎껌, 醫뚯꽍 諛곗젙, 怨꾩젙 ?뺣낫媛 ??젣?⑸땲??`
      )
    ) {
      return;
    }

    const gradePrefix = `${grade}%`;

    // 1. ?댁꽍 ?좎껌 ?댁뿭 ??젣 (?숇쾲 prefix 湲곗?)
    const { error: leaveErr } = await supabase
      .from("leave_requests")
      .delete()
      .like("student_id", gradePrefix);

    if (leaveErr) {
      console.error(leaveErr);
      toast.error(`${grade}?숇뀈 ?댁꽍 ?좎껌 ?댁뿭 珥덇린???ㅽ뙣: ` + leaveErr.message);
      return;
    }

    // 2. 醫뚯꽍 諛곗젙 ?뺣낫 ??젣 (?숇쾲 prefix 湲곗?)
    const { error: seatErr } = await supabase
      .from("seat_assignments")
      .delete()
      .like("student_id", gradePrefix);

    if (seatErr) {
      console.error(seatErr);
      toast.error(`${grade}?숇뀈 醫뚯꽍 諛곗젙 ?뺣낫 珥덇린???ㅽ뙣: ` + seatErr.message);
      return;
    }

    // 3. students_auth ??젣 (?숇쾲 prefix 湲곗?)
    const { error: authErr } = await supabase
      .from("students_auth")
      .delete()
      .like("student_id", gradePrefix);

    if (authErr) {
      console.error(authErr);
      toast.error(`${grade}?숇뀈 怨꾩젙 ?뺣낫 珥덇린???ㅽ뙣: ` + authErr.message);
      return;
    }

    // 4. students ?곗씠????젣 (?대떦 ?숇뀈 ?꾩껜)
    const { error: studentsErr } = await supabase
      .from("students")
      .delete()
      .eq("grade", grade);

    if (studentsErr) {
      console.error(studentsErr);
      toast.error(`${grade}?숇뀈 ?숈깮 ?뺣낫 珥덇린???ㅽ뙣: ` + studentsErr.message);
      return;
    }

    toast.success(`${grade}?숇뀈 ?꾩껜 珥덇린???꾨즺`);
    fetchStudents();
  };

  // -------------------------
  // 鍮꾨?踰덊샇 珥덇린??(Server-side API ?몄텧)
  // -------------------------
  const handlePasswordReset = async (s: Student) => {
    if (!s.name) return;

    // ??λ맂 ?숈깮?몄? ?뺤씤
    const original = originalStudents.find(
      (os) => os.grade === s.grade && os.class === s.class && os.number === s.number
    );

    if (!original || original.name !== s.name) {
      toast.error("癒쇱? 蹂寃쎌궗??쓣 ??ν빐二쇱꽭??");
      return;
    }

    if (!confirm(`'${s.name}' ?숈깮??鍮꾨?踰덊샇瑜?珥덇린?뷀븯?쒓쿋?듬땲源?`)) return;

    const student_id = `${s.grade}${s.class}${String(s.number).padStart(2, "0")}${s.name}`;
    const newPw = generateTempPassword();

    try {
      const response = await fetch('/api/admin/reset-student-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          student_id,
          new_password: newPw,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '珥덇린???ㅽ뙣');
      }

      alert(`[鍮꾨?踰덊샇 珥덇린???꾨즺]\n\n?숈깮: ${s.name}\n?꾩씠?? ${student_id}\n?꾩떆 鍮꾨?踰덊샇: ${newPw}`);

    } catch (error: any) {
      console.error(error);
      toast.error(error.message || '珥덇린??以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.');
    }
  };

  const getStudentNumber = (g: number, c: number, n: number) =>
    g * 1000 + c * 100 + n;

  // -------------------------
  // UI
  // -------------------------
  return (
    <div className="p-4 space-y-8 overflow-x-auto bg-white min-h-screen text-gray-900">
      <Toaster position="top-right" />

      {grades.map((grade) => (
        <div key={grade}>
          <div className="flex items-center mb-4 gap-2">
            <h2 className="font-bold text-xl text-gray-900">{grade}?숇뀈</h2>
            <div className="flex gap-2">
              <button
                onClick={() => handleSave(grade)}
                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-xl shadow-inner hover:shadow-md font-bold text-sm whitespace-nowrap"
              >
                蹂寃????              </button>
              <button
                onClick={() => handleDownloadCredentials(grade)}
                className="px-3 py-1 bg-green-100 text-green-800 rounded-xl shadow-inner hover:shadow-md font-bold text-sm whitespace-nowrap"
              >
                怨꾩젙 ?ㅼ슫濡쒕뱶
              </button>
              <button
                onClick={() => handleReset(grade)}
                className="px-3 py-1 bg-red-100 text-red-800 rounded-xl shadow-inner hover:shadow-md text-sm whitespace-nowrap"
              >
                珥덇린??              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {classes.map((cls) => (
              <div
                key={cls}
                className="min-w-[200px] p-3 rounded-xl bg-gray-100 shadow-inner"
              >
                <h3 className="font-semibold mb-2 text-gray-900">{cls}諛?/h3>

                <div className="flex flex-col gap-2">
                  {numbers.map((num) => {
                    const s = students.find(
                      (st) =>
                        st.grade === grade &&
                        st.class === cls &&
                        st.number === num
                    );

                    if (!s) return null;

                    // ??λ맂 ?숈깮 ?щ? ?뺤씤 (鍮꾨쾲 珥덇린??踰꾪듉 ?몄텧??
                    const isSaved = originalStudents.some(
                      (os) => os.grade === s.grade && os.class === s.class && os.number === s.number && os.name === s.name
                    );

                    return (
                      <div key={num} className="flex items-center gap-2">
                        <span className="w-12 text-right text-sm text-gray-900 font-medium">
                          {getStudentNumber(grade, cls, num)}
                        </span>

                        <input
                          type="text"
                          value={s.name}
                          onChange={(e) =>
                            handleNameChange(grade, cls, num, e.target.value)
                          }
                          onPaste={(e) => handlePaste(grade, cls, num, e)}
                          className="flex-1 max-w-[80px] px-2 py-1 rounded-lg border border-gray-300 text-sm shadow-inner text-gray-900 bg-white"
                        />

                        {isSaved && s.name && (
                          <button
                            onClick={() => handlePasswordReset(s)}
                            className="px-1.5 py-0.5 bg-yellow-50 text-yellow-700 rounded text-[10px] hover:bg-yellow-100 border border-yellow-200 whitespace-nowrap"
                            title="鍮꾨?踰덊샇 珥덇린??
                          >
                            鍮꾨쾲珥덇린??                          </button>
                        )}

                        <label className="flex items-center gap-1 cursor-pointer text-sm">
                          <input
                            type="checkbox"
                            checked={s.weekend}
                            onChange={() =>
                              handleWeekendToggle(grade, cls, num)
                            }
                          />
                          留ㅼ＜
                        </label>

                        {s.parent_token && (
                          <button
                            onClick={() => {
                              const link = `${window.location.origin}/parent?token=${s.parent_token}`;
                              navigator.clipboard.writeText(link);
                              toast.success("?숇?紐?留곹겕 蹂듭궗??);
                            }}
                            className="ml-2 px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs hover:bg-blue-100 border border-blue-200"
                            title="?숇?紐??묒냽 留곹겕 蹂듭궗"
                          >
                            ?뵕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
