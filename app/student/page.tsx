'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const LEAVE_TYPES = ['컴이석', '이석', '외출', '외박'];
const LECTURE_HOURS = {
  주간: ['1','2','3','4','5','6','7','8','9'],
  야간: ['1','2','3','4']
};

export default function StudentPage() {
  const [user, setUser] = useState(null);
  const [applications, setApplications] = useState([]);

  const [applicants, setApplicants] = useState([]);
  const [type, setType] = useState('컴이석');
  const [periodType, setPeriodType] = useState('주간');
  const [selectedHours, setSelectedHours] = useState([]);

  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);

  const [teacher, setTeacher] = useState('');
  const [location, setLocation] = useState('');
  const [reason, setReason] = useState('');

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
    if (!user || !type) return;

    const { error } = await supabase.from('applications').insert([{
      applicant_id: user.id,
      applicant_name: applicants.join(', '),
      type,
      period: type === '외박' ? null : selectedHours.join(', '),
      start_time: startTime ? startTime.toISOString() : null,
      end_time: endTime ? endTime.toISOString() : null,
      teacher,
      location,
      reason: type === '컴이석' ? null : reason,
    }]);

    if (!error) {
      alert('신청 완료!');
      fetchApplications(user.id);
      setType('컴이석');
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

  const toggleSelection = (current, value) => {
    if (current.includes(value)) return current.filter(v => v !== value);
    return [...current, value];
  };

  const typeBtn = (selected) =>
    `px-4 py-1 m-1 rounded-full text-sm transition-all duration-150 transform ${
      selected ? 'bg-black text-white scale-95' : 'bg-gray-200 text-gray-600 scale-100'
    }`;

  const flatBtn = (selected) =>
    `px-4 py-1 m-1 rounded-full text-sm transition-all duration-150 transform ${
      selected ? 'bg-black text-white scale-95' : 'bg-gray-300 text-gray-600 scale-100'
    }`;

  const inputStyle = 'flex-1 p-2 rounded-full bg-gray-300 border-none focus:outline-none';

  const boxHeightClass = 'min-h-[5.5rem]';

  return (
    <div className="min-h-screen p-6 text-sm" style={{ backgroundColor: '#f5f5f5' }}>
      <h1 className="text-3xl font-semibold mb-4 text-center text-gray-800">
        이석 신청
      </h1>

      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-3">

        {/* 신청자 */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="신청자"
            value={applicants.join(', ')}
            onChange={(e) => {
              const base = user.user_metadata?.name || '';
              const extra = e.target.value.split(',').map(n => n.trim()).filter(Boolean);
              setApplicants([...new Set([base, ...extra.filter(n => n !== base)])]);
            }}
            className={inputStyle}
          />
        </div>

        {/* 이석 종류 */}
        <div className="flex items-center gap-2">
          <span className="text-gray-700 font-medium">이석 종류</span>
          <div className="flex flex-wrap">
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

        {/* 외출 / 외박 박스 */}
        <div className={`flex flex-col justify-center gap-3 ${boxHeightClass}`}>
          {type !== '외박' && (
            <div className="flex items-center gap-3">
              {/* 주간/야간 토글 */}
              <div className="relative w-20 h-8 rounded-full bg-gray-300 flex items-center cursor-pointer" onClick={() => {
                setPeriodType(periodType === '주간' ? '야간' : '주간');
                setSelectedHours([]);
              }}>
                <div
                  className={`absolute top-0 left-0 w-10 h-8 bg-black rounded-full transition-all duration-300`}
                  style={{ transform: periodType === '주간' ? 'translateX(0)' : 'translateX(100%)' }}
                />
                <span className="absolute left-2 text-xs text-white font-bold">주간</span>
                <span className="absolute right-2 text-xs text-white font-bold">야간</span>
              </div>

              {/* 교시 버튼 */}
              <div className="flex flex-wrap gap-1">
                {LECTURE_HOURS[periodType].map((h) => (
                  <button
                    key={h}
                    type="button"
                    className={flatBtn(selectedHours.includes(h))}
                    onClick={() => setSelectedHours(toggleSelection(selectedHours, h))}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
          )}

          {type === '외박' && (
            <div className="flex items-center gap-3">
              <DatePicker
                selected={startTime}
                onChange={setStartTime}
                showTimeSelect
                timeIntervals={10}
                dateFormat="yyyy-MM-dd HH:mm"
                placeholderText="시작"
                className={`${inputStyle} w-44`}
              />
              <DatePicker
                selected={endTime}
                onChange={setEndTime}
                showTimeSelect
                timeIntervals={10}
                dateFormat="yyyy-MM-dd HH:mm"
                placeholderText="종료"
                className={`${inputStyle} w-44`}
              />
            </div>
          )}
        </div>

        {/* 지도교사 + 장소 */}
        {type !== '컴이석' && (
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="지도교사"
              value={teacher}
              onChange={(e) => setTeacher(e.target.value)}
              className={inputStyle}
            />
            <input
              type="text"
              placeholder="이석 장소"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={inputStyle}
            />
          </div>
        )}

        {/* 이석 사유 */}
        {type !== '컴이석' && (
          <input
            type="text"
            placeholder="이석 사유"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={inputStyle + ' w-full'}
          />
        )}

        <button
          type="submit"
          className="w-full py-3 rounded-full bg-black text-white font-bold text-base mt-1"
        >
          신청하기
        </button>
      </form>

      {/* 신청 현황 */}
      <div className="max-w-5xl mx-auto mt-6">
        <h2 className="text-2xl font-semibold mb-2 text-gray-800">
          신청 현황
        </h2>

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
                    {app.type === '외박'
                      ? `${app.start_time || '-'} ~ ${app.end_time || '-'}` 
                      : app.period || '-'}
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
