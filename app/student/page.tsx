'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

// --- DatePicker custom animation ---
const popupCSS = `
.react-datepicker {
  animation: fadeIn 0.18s ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

const LEAVE_TYPES = ['컴', '이', '출', '박'];
const LECTURE_HOURS = {
  주간: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
  야간: ['1', '2', '3', '4']
};

export default function StudentPage() {
  const [user, setUser] = useState(null);
  const [applications, setApplications] = useState([]);

  const [applicants, setApplicants] = useState([]);
  const [type, setType] = useState('컴');
  const [periodType, setPeriodType] = useState('주간');
  const [selectedHours, setSelectedHours] = useState([]);

  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);

  const [teacher, setTeacher] = useState('');
  const [location, setLocation] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.innerHTML = popupCSS;
    document.head.appendChild(styleEl);
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        setApplicants([user.user_metadata?.name || '']);
        fetchApplications(user.id);
      }
    };
    fetchUser();
  }, []);

  const fetchApplications = async (userId) => {
    if (!userId) return;
    const { data } = await supabase
      .from('applications')
      .select('*')
      .eq('applicant_id', userId);
    setApplications(data || []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    const { error } = await supabase.from('applications').insert([{
      applicant_id: user.id,
      applicant_name: applicants.join(', '),
      type,
      period: type === '박' || type === '출' ? null : selectedHours.join(', '),
      start_time: startTime ? startTime.toISOString() : null,
      end_time: endTime ? endTime.toISOString() : null,
      teacher,
      location,
      reason,
    }]);

    if (!error) {
      alert('신청 완료!');
      fetchApplications(user.id);
      setType('컴');
      setSelectedHours([]);
      setStartTime(null);
      setEndTime(null);
      setTeacher('');
      setLocation('');
      setReason('');
      setApplicants([user.user_metadata?.name || '']);
    } else {
      alert('신청 실패: ' + error.message);
    }
  };

  const toggleSelection = (value) => {
    if (selectedHours.includes(value)) return selectedHours.filter(v => v !== value);
    return [...selectedHours, value];
  };

  const inputClass = 'flex-1 p-1.5 rounded-full bg-gray-300 border-none focus:outline-none h-8 w-full text-[12px]';
  const titleBtnClass = 'flex justify-center items-center bg-white rounded-full px-2 h-6 border border-gray-200 absolute left-1 top-1 text-[12px] font-bold';

  const typeBtn = (selected) =>
    `px-3 py-0.5 m-1 rounded-full text-[12px] transition-colors ${selected ? 'bg-white text-black border border-gray-200' : 'text-gray-800 border border-transparent'}`;

  const hourBtn = (selected) =>
    `flex items-center justify-center w-7 h-7 m-1 rounded-full text-[12px] transition-all font-normal ${
      selected
        ? 'bg-black text-white shadow-lg'
        : 'border border-gray-300 text-gray-800'
    }`;

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: '#f5f5f5' }}>
      <h1 className="text-3xl font-semibold mb-4 text-center text-gray-800">이석 신청</h1>

      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-3">

        {/* 신청학생 */}
        <div className="relative">
          <input
            type="text"
            value={applicants.join(', ')}
            onChange={(e) => {
              const base = user.user_metadata?.name || '';
              const extra = e.target.value.split(',').map(n => n.trim()).filter(Boolean);
              setApplicants([...new Set([base, ...extra.filter(n => n !== base)])]);
            }}
            className={inputClass}
            placeholder="신청학생"
          />
          <span className={titleBtnClass}>신청학생</span>
        </div>

        {/* 이석종류 */}
        <div className="relative">
          <input type="text" className={inputClass} readOnly />
          <span className={titleBtnClass}>이석종류</span>
          <div className="absolute left-20 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
            {LEAVE_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                className={typeBtn(type === t)}
                onClick={() => setType(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* 교시 선택 */}
        {(type === '컴' || type === '이') && (
          <div className="relative">
            <input type="text" className={inputClass} readOnly />

            {/* 주간/야간 토글 */}
            <div
              className="absolute left-1 top-1 h-6 w-20 bg-gray-600 rounded-full flex items-center p-0.5 cursor-pointer"
              onClick={() => {
                setPeriodType(periodType === '주간' ? '야간' : '주간');
                setSelectedHours([]);
              }}
            >
              <div
                className={`h-5 w-14 bg-white rounded-full flex items-center justify-center text-[10px] text-black shadow-md transition-all duration-300 ease-in-out transform ${
                  periodType === '주간'
                    ? 'translate-x-0 shadow-lg'
                    : 'translate-x-4 shadow-lg'
                }`}
              >
                {periodType}
              </div>
            </div>

            {/* 교시 버튼 */}
            <div className="absolute left-24 top-1/2 transform -translate-y-1/2 flex gap-4">
              {LECTURE_HOURS[periodType].map((h) => (
                <button
                  key={h}
                  type="button"
                  className={hourBtn(selectedHours.includes(h))}
                  onClick={() => setSelectedHours(toggleSelection(h))}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 외출/외박 시간 */}
        {(type === '박' || type === '출') && (
          <div className="flex gap-6">
            <DatePicker
              selected={startTime}
              onChange={setStartTime}
              showTimeSelect
              {...(type === '출' ? { showTimeSelectOnly: true, dateFormat: "HH:mm" } : { dateFormat: "yyyy-MM-dd HH:mm" })}
              timeIntervals={10}
              placeholderText="시작"
              className={`${inputClass} w-44`}
              popperPlacement="bottom-start"
            />
            <DatePicker
              selected={endTime}
              onChange={setEndTime}
              showTimeSelect
              {...(type === '출' ? { showTimeSelectOnly: true, dateFormat: "HH:mm" } : { dateFormat: "yyyy-MM-dd HH:mm" })}
              timeIntervals={10}
              placeholderText="종료"
              className={`${inputClass} w-44`}
              popperPlacement="bottom-start"
            />
          </div>
        )}

        {/* 지도교사 */}
        <div className={type === '컴' ? 'hidden' : 'relative'}>
          <input type="text" value={teacher} onChange={(e) => setTeacher(e.target.value)} className={inputClass} placeholder="지도교사"/>
          <span className={titleBtnClass}>지도교사</span>
        </div>

        {/* 이석장소 */}
        <div className={type === '컴' ? 'hidden' : 'relative'}>
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass} placeholder="이석장소"/>
          <span className={titleBtnClass}>이석장소</span>
        </div>

        {/* 이석사유 */}
        <div className={type === '컴' ? 'hidden' : 'relative'}>
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} placeholder="이석사유"/>
          <span className={titleBtnClass}>이석사유</span>
        </div>

        <button
          type="submit"
          className="w-full py-2.5 rounded-full bg-black text-white font-bold text-base mt-1"
        >
          신청하기
        </button>
      </form>

      {/* 신청 현황 */}
      <div className="max-w-5xl mx-auto mt-6">
        <h2 className="text-2xl font-semibold mb-2 text-gray-800">신청 현황</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-300 bg-white">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-gray-200">
              <tr>
                <th className="px-4 py-2 border-b">신청자</th>
                <th className="px-4 py-2 border-b">종류</th>
                <th className="px-4 py-2 border-b">교시/시간</th>
                <th className="px-4 py-2 border-b">지도교사</th>
                <th className="px-4 py-2 border-b">사유</th>
                <th className="px-4 py-2 border-b">장소</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id} className="bg-white">
                  <td className="px-4 py-2 border-b">{app.applicant_name}</td>
                  <td className="px-4 py-2 border-b">{app.type}</td>
                  <td className="px-4 py-2 border-b">
                    {app.type === '박' || app.type === '출'
                      ? `${app.start_time || '-'} ~ ${app.end_time || '-'}`
                      : selectedHours.join(', ') || '-'}
                  </td>
                  <td className="px-4 py-2 border-b">{app.teacher || '-'}</td>
                  <td className="px-4 py-2 border-b">{app.reason || '-'}</td>
                  <td className="px-4 py-2 border-b">{app.location || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
