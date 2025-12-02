'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { BsSunFill, BsMoonFill } from 'react-icons/bs';
import clsx from 'clsx';

const popupCSS = `
.react-datepicker {
  animation: fadeIn 0.18s ease-out;
  z-index: 9999;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

const LEAVE_TYPES = ['컴', '이', '출', '박'];
const LECTURE_HOURS = {
  주간: ['1','2','3','4','5','6','7','8','9'],
  야간: ['1','2','3','4']
};

// -----------------------------
// Day/Night Toggle
// -----------------------------
const DayNightToggle = ({ periodType, onToggle }: { periodType: '주간' | '야간'; onToggle: () => void }) => {
  const toggleWidth = 48;
  const togglePadding = 2; 
  const buttonWidth = 22;
  const translateX = periodType === '주간' ? 0 : toggleWidth - buttonWidth - togglePadding * 2;
  const bgColor = periodType === '주간' ? '#e0e0e0' : '#4b5563';

  return (
    <div
      className="relative h-6 rounded-full flex items-center p-0.5 cursor-pointer transition-colors duration-300"
      style={{ width: `${toggleWidth}px`, backgroundColor: bgColor }}
      onClick={onToggle}
    >
      <div
        className="h-5 bg-white rounded-full flex items-center justify-center shadow-md transition-transform duration-300 ease-in-out"
        style={{ width: `${buttonWidth}px`, transform: `translateX(${translateX}px)` }}
      >
        {periodType === '주간' ? <BsSunFill className="text-yellow-400" /> : <BsMoonFill className="text-gray-800" />}
      </div>
    </div>
  );
};

// -----------------------------
// TimeRangePicker
// -----------------------------
const TimeRangePicker = ({
  startTime,
  endTime,
  setStartTime,
  setEndTime,
  type,
}: {
  startTime: Date | null;
  endTime: Date | null;
  setStartTime: (date: Date | null) => void;
  setEndTime: (date: Date | null) => void;
  type: string;
}) => {
  const timeInputClass =
    'p-1.5 rounded-full bg-gray-300 border-none focus:outline-none h-8 w-44 text-[12px] text-left pr-3 box-border';

  return (
    <div className="flex gap-6 items-center h-8">
      <DatePicker
        selected={startTime}
        onChange={setStartTime}
        showTimeSelect
        {...(type === '출' ? { showTimeSelectOnly: true, dateFormat: 'HH:mm' } : { dateFormat: 'yyyy-MM-dd HH:mm' })}
        timeIntervals={10}
        placeholderText="시작"
        className={timeInputClass}
        popperPlacement="bottom-start"
        portalId="time-picker-portal"
      />
      <DatePicker
        selected={endTime}
        onChange={setEndTime}
        showTimeSelect
        {...(type === '출' ? { showTimeSelectOnly: true, dateFormat: 'HH:mm' } : { dateFormat: 'yyyy-MM-dd HH:mm' })}
        timeIntervals={10}
        placeholderText="종료"
        className={timeInputClass}
        popperPlacement="bottom-start"
        portalId="time-picker-portal"
      />
    </div>
  );
};

// -----------------------------
// TextInputField
// -----------------------------
const TextInputField = ({
  value,
  onChange,
  placeholder,
  hidden,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  hidden?: boolean;
}) => {
  const inputClass = 'flex-1 p-1.5 rounded-full bg-gray-300 border-none focus:outline-none h-8 text-[12px] box-border';
  const titleBtnClass = 'flex justify-center items-center bg-white rounded-full px-2 h-6 border border-gray-200 absolute left-1 top-1 text-[12px] font-bold';

  if (hidden) return null;
  return (
    <div className="relative">
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={inputClass + ' w-full'} placeholder={placeholder} />
      <span className={titleBtnClass}>{placeholder}</span>
    </div>
  );
};

// -----------------------------
// StudentPage
// -----------------------------
export default function StudentPage() {
  const [user, setUser] = useState<any>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [applicants, setApplicants] = useState<string[]>([]);
  const [type, setType] = useState('컴');
  const [periodType, setPeriodType] = useState<'주간' | '야간'>('주간');
  const [selectedHours, setSelectedHours] = useState<string[]>([]);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [teacher, setTeacher] = useState('');
  const [location, setLocation] = useState('');
  const [reason, setReason] = useState('');
  const [editId, setEditId] = useState<number | null>(null);

  useEffect(() => {
    const styleEl = document.createElement('style');
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

  const fetchApplications = async (userId: string) => {
    if (!userId) return;
    const { data } = await supabase.from('applications').select('*').eq('applicant_id', userId);
    setApplications(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (editId) {
      const { error } = await supabase.from('applications').update({
        type,
        period: selectedHours.join(','),
        start_time: startTime ? startTime.toISOString() : null,
        end_time: endTime ? endTime.toISOString() : null,
        teacher,
        location,
        reason,
        applicant_name: applicants.join(','),
      }).eq('id', editId);

      if (!error) {
        alert('수정 완료!');
        fetchApplications(user.id);
        resetForm();
      } else alert('수정 실패: ' + error.message);
    } else {
      const { error } = await supabase.from('applications').insert([{
        applicant_id: user.id,
        applicant_name: applicants.join(','),
        type,
        period: type === '박' || type === '출' ? null : selectedHours.join(','),
        start_time: startTime ? startTime.toISOString() : null,
        end_time: endTime ? endTime.toISOString() : null,
        teacher,
        location,
        reason,
      }]);

      if (!error) {
        alert('신청 완료!');
        fetchApplications(user.id);
        resetForm();
      } else alert('신청 실패: ' + error.message);
    }
  };

  const resetForm = () => {
    setType('컴');
    setSelectedHours([]);
    setStartTime(null);
    setEndTime(null);
    setTeacher('');
    setLocation('');
    setReason('');
    setApplicants([user?.user_metadata?.name || '']);
    setEditId(null);
  };

  const toggleSelection = (value: string) =>
    selectedHours.includes(value) ? selectedHours.filter(v => v !== value) : [...selectedHours, value];

  const inputClass = 'flex-1 p-1.5 rounded-full bg-gray-300 border-none focus:outline-none h-8 text-[12px] box-border';
  const typeBtn = (selected: boolean) => clsx(
    'px-3 py-0.5 m-1 rounded-full text-[12px] transition-colors',
    selected ? 'bg-white text-black border border-gray-200' : 'text-gray-800 border border-transparent'
  );
  const hourBtn = (selected: boolean) => clsx(
    'flex items-center justify-center w-7 h-7 m-1 rounded-full text-[12px] transition-all font-normal',
    selected ? 'bg-black text-white shadow-lg' : 'border border-gray-300 text-gray-800'
  );

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: '#f5f5f5' }}>
      <h1 className="text-3xl font-semibold mb-4 text-center text-gray-800">이석 신청</h1>

      {/* 신청 폼 */}
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-3">
        <div className="relative">
          <input
            type="text"
            value={applicants.join(', ')}
            onChange={(e) => {
              const base = user?.user_metadata?.name || '';
              const extra = e.target.value.split(',').map(n => n.trim()).filter(Boolean);
              setApplicants([...new Set([base, ...extra.filter(n => n !== base)])]);
            }}
            className={inputClass + ' w-full'}
            placeholder="신청학생"
          />
          <span className="flex justify-center items-center bg-white rounded-full px-2 h-6 border border-gray-200 absolute left-1 top-1 text-[12px] font-bold">신청학생</span>
        </div>

        <div className="relative">
          <input type="text" className={inputClass + ' w-full'} readOnly />
          <span className="flex justify-center items-center bg-white rounded-full px-2 h-6 border border-gray-200 absolute left-1 top-1 text-[12px] font-bold">이석종류</span>
          <div className="absolute left-20 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
            {LEAVE_TYPES.map((t) => (
              <button key={t} type="button" className={typeBtn(type === t)} onClick={() => setType(t)}>{t}</button>
            ))}
          </div>
        </div>

        {(type === '컴' || type === '이') && (
          <div className="relative">
            <input type="text" className={inputClass + ' w-full'} readOnly />
            <div className="absolute left-1 top-1 flex items-center gap-1">
              <DayNightToggle periodType={periodType} onToggle={() => { setPeriodType(periodType==='주간'?'야간':'주간'); setSelectedHours([]); }} />
            </div>
            <div className="absolute left-24 top-1/2 transform -translate-y-1/2 flex gap-4">
              {LECTURE_HOURS[periodType].map((h) => (
                <button key={h} type="button" className={hourBtn(selectedHours.includes(h))} onClick={() => setSelectedHours(toggleSelection(h))}>{h}</button>
              ))}
            </div>
          </div>
        )}

        {(type === '박' || type === '출') && (
          <TimeRangePicker
            startTime={startTime}
            endTime={endTime}
            setStartTime={setStartTime}
            setEndTime={setEndTime}
            type={type}
          />
        )}

        <TextInputField value={teacher} onChange={setTeacher} placeholder="지도교사" hidden={type==='컴'} />
        <TextInputField value={location} onChange={setLocation} placeholder="이석장소" hidden={type==='컴'} />
        <TextInputField value={reason} onChange={setReason} placeholder="사유" hidden={type==='컴'} />

        <button type="submit" className="w-full py-2.5 rounded-full bg-black text-white font-bold text-base mt-1">{editId ? '수정하기' : '신청하기'}</button>
      </form>

      {/* 신청 현황 */}
      <div className="max-w-6xl mx-auto mt-6">
        <h2 className="text-2xl font-semibold mb-2 text-gray-800">신청 현황</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-300 bg-white">
          <table className="w-full min-w-[700px] text-left border-collapse text-sm">
            <thead className="bg-gray-200">
              <tr>
                <th className="px-2 py-2 border-b border-gray-400">종류</th>
                <th className="px-2 py-2 border-b border-gray-400">신청학생</th>
                <th className="px-2 py-2 border-b border-gray-400">시작</th>
                <th className="px-2 py-2 border-b border-gray-400">종료</th>
                <th className="px-2 py-2 border-b border-gray-400">사유</th>
                <th className="px-2 py-2 border-b border-gray-400">지도교사</th>
                <th className="px-2 py-2 border-b border-gray-400">장소</th>
              </tr>
            </thead>
            <tbody>
              {applications.map(app => (
                <tr key={app.id} className="bg-white hover:bg-gray-50">
                  <td className="px-2 py-2 border-b border-gray-300" style={{ minWidth: '4ch' }}>{app.type}/{app.status ? '승인' : '대기'}</td>
                  <td className="px-2 py-2 border-b border-gray-300" style={{ minWidth: '8ch' }}>{app.applicant_name.split(',').map((name, idx) => <div key={idx}>{name}</div>)}</td>
                  <td className="px-2 py-2 border-b border-gray-300" style={{ minWidth: '16ch' }}>{app.start_time ? new Date(app.start_time).toLocaleString('ko-KR') : '-'}</td>
                  <td className="px-2 py-2 border-b border-gray-300" style={{ minWidth: '16ch' }}>{app.end_time ? new Date(app.end_time).toLocaleString('ko-KR') : '-'}</td>
                  <td className="px-2 py-2 border-b border-gray-300 break-words whitespace-pre-wrap" style={{ minWidth: '8ch' }}>{app.reason || '-'}</td>
                  <td className="px-2 py-2 border-b border-gray-300" style={{ minWidth: '4ch' }}>{app.teacher || '-'}</td>
                  <td className="px-2 py-2 border-b border-gray-300" style={{ minWidth: '8ch' }}>{app.location || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
