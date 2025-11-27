'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const LEAVE_TYPES = ['컴이석','이석','외출','외박'];
const LECTURE_HOURS = {
  주간: ['주1교시','주2교시','주3교시','주4교시','주5교시','주6교시','주7교시','주8교시','주9교시'],
  야간: ['야1교시','야2교시','야3교시','야4교시']
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
  const [reason, setReason] = useState('');
  const [location, setLocation] = useState('');

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
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('applicant_id', userId);
    if (!error) setApplications(data || []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user || !type) return;

    const { data, error } = await supabase.from('applications').insert([
      {
        applicant_id: user.id,
        applicant_name: applicants.join(', '),
        type,
        period: type === '외박' ? null : selectedHours.join(', '),
        start_time: startTime ? startTime.toISOString() : null,
        end_time: endTime ? endTime.toISOString() : null,
        teacher,
        reason: type === '컴이석' ? null : reason,
        location: type === '컴이석' ? null : location,
      },
    ]);

    if (!error) {
      alert('신청 완료!');
      fetchApplications(user.id);

      setType('컴이석');
      setSelectedHours([]);
      setStartTime(null);
      setEndTime(null);
      setTeacher('');
      setReason('');
      setLocation('');
      setApplicants([user.user_metadata?.name || '']);
    } else {
      alert('신청 실패: ' + error.message);
    }
  };

  const toggleSelection = (current, value) => {
    if (current.includes(value)) return current.filter(v => v !== value);
    return [...current, value];
  };

  // 버튼 스타일
  const neoBtn = (selected) =>
    selected
      ? 'px-4 py-2 m-1 rounded-2xl text-[0.8rem] bg-gradient-to-t from-gray-900 to-gray-700 text-white shadow-[5px_5px_12px_#3a3a3a,-3px_-3px_10px_#ffffff,inset_0_2px_4px_rgba(255,255,255,0.3)] scale-105 transition-all'
      : 'px-4 py-2 m-1 rounded-2xl text-[0.8rem] bg-gray-100 text-gray-400 shadow-[inset_2px_2px_5px_#d1d1d1,inset_-2px_-2px_5px_#ffffff] hover:shadow-[4px_4px_8px_#bcbcbc,-4px_-4px_8px_#ffffff] transition-all';

  return (
    <div className="min-h-screen bg-gray-300 p-6 text-[0.8rem] font-normal">
      <h1 className="text-3xl font-bold mb-6 text-center text-gray-700 drop-shadow">
        이석 신청
      </h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-3xl max-w-3xl mx-auto mb-10 shadow-[8px_8px_20px_#b8b8b8,-8px_-8px_20px_#ffffff]"
      >

        {/* 신청자 입력 */}
        <label className="block mb-6">
          <span className="text-gray-700">신청자</span>
          <input
            type="text"
            value={applicants.join(', ')}
            onChange={(e) => {
              const base = user.user_metadata?.name || '';
              const extra = e.target.value.split(',').map(n => n.trim()).filter(Boolean);
              setApplicants([...new Set([base, ...extra.filter(n => n !== base)])]);
            }}
            className="mt-2 block w-full rounded-2xl p-3 bg-gray-100 border-none shadow-[inset_4px_4px_10px_#d1d1d1,inset_-4px_-4px_10px_#ffffff]"
          />
        </label>

        {/* 이석 종류 */}
        <div className="mb-6">
          <span className="text-gray-700">이석 종류</span>
          <div className="flex flex-wrap mt-3">
            {LEAVE_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                className={neoBtn(type === t)}
                onClick={() => setType(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* 외박 시간 선택 */}
        {type === '외박' ? (
          <div className="flex gap-8 mb-8 items-center">
            <div className="flex items-center">
              <span className="mr-3 text-gray-700">시작 시간</span>
              <DatePicker
                selected={startTime}
                onChange={(date) => setStartTime(date)}
                showTimeSelect
                timeIntervals={10}
                dateFormat="yyyy-MM-dd HH:mm"
                className="w-48 p-3 rounded-2xl bg-gray-100 shadow-[inset_4px_4px_10px_#d1d1d1,inset_-4px_-4px_10px_#ffffff]"
              />
            </div>
            <div className="flex items-center">
              <span className="mr-3 text-gray-700">종료 시간</span>
              <DatePicker
                selected={endTime}
                onChange={(date) => setEndTime(date)}
                showTimeSelect
                timeIntervals={10}
                dateFormat="yyyy-MM-dd HH:mm"
                className="w-48 p-3 rounded-2xl bg-gray-100 shadow-[inset_4px_4px_10px_#d1d1d1,inset_-4px_-4px_10px_#ffffff]"
              />
            </div>
          </div>
        ) : (
          <div className="mb-8">
            <div className="flex mb-2">
              {['주간', '야간'].map((pt) => (
                <button
                  key={pt}
                  type="button"
                  className={neoBtn(periodType === pt)}
                  onClick={() => {
                    setPeriodType(pt);
                    setSelectedHours([]);
                  }}
                >
                  {pt}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap">
              {LECTURE_HOURS[periodType].map((h) => (
                <button
                  key={h}
                  type="button"
                  className={neoBtn(selectedHours.includes(h))}
                  onClick={() => setSelectedHours(toggleSelection(selectedHours, h))}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 지도교사 + 장소 */}
        {type !== '컴이석' && (
          <>
            <div className="flex gap-6 mb-6">
              <label className="flex-1">
                <span className="text-gray-700">지도교사</span>
                <input
                  type="text"
                  value={teacher}
                  onChange={(e) => setTeacher(e.target.value)}
                  className="mt-2 block w-full p-3 rounded-2xl bg-gray-100 shadow-[inset_4px_4px_10px_#d1d1d1,inset_-4px_-4px_10px_#ffffff]"
                />
              </label>
              <label className="flex-1">
                <span className="text-gray-700">이석 장소</span>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="mt-2 block w-full p-3 rounded-2xl bg-gray-100 shadow-[inset_4px_4px_10px_#d1d1d1,inset_-4px_-4px_10px_#ffffff]"
                />
              </label>
            </div>

            <label className="block mb-8">
              <span className="text-gray-700">이석 사유</span>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-2 block w-full p-3 rounded-2xl bg-gray-100 shadow-[inset_4px_4px_10px_#d1d1d1,inset_-4px_-4px_10px_#ffffff]"
              />
            </label>
          </>
        )}

        <button
          type="submit"
          className="w-full py-3 bg-lime-300 rounded-2xl shadow-[6px_6px_12px_#b8b8b8,-6px_-6px_12px_#ffffff] hover:bg-lime-400 transition flex items-center justify-center gap-2 font-bold text-gray-900"
        >
          ✈️ 신청하기
        </button>
      </form>

      {/* 신청 현황 테이블 */}
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold mb-4 text-gray-700">신청 현황</h2>

        <div className="overflow-x-auto rounded-2xl shadow-[6px_6px_20px_#b8b8b8,-6px_-6px_20px_#ffffff]">
          <table className="w-full text-left border-collapse bg-gray-200 font-normal">
            <thead>
              <tr className="bg-gray-300">
                <th className="px-4 py-2">신청자</th>
                <th className="px-4 py-2">종류</th>
                <th className="px-4 py-2">교시/시간</th>
                <th className="px-4 py-2">지도교사</th>
                <th className="px-4 py-2">사유</th>
                <th className="px-4 py-2">장소</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id} className="bg-gray-100 border-t">
                  <td className="px-4 py-2">{app.applicant_name}</td>
                  <td className="px-4 py-2">{app.type}</td>
                  <td className="px-4 py-2">
                    {app.type === '외박'
                      ? `${app.start_time || '-'} ~ ${app.end_time || '-'}` 
                      : app.period || '-'}
                  </td>
                  <td className="px-4 py-2">{app.teacher || '-'}</td>
                  <td className="px-4 py-2">{app.reason || '-'}</td>
                  <td className="px-4 py-2">{app.location || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
