'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import toast, { Toaster } from 'react-hot-toast';
import clsx from 'clsx';

interface TimetableEntry {
  id: number;
  day_type: string;    // weekday day 1 ~ weekend night 4
  description: string;
  start_time: string;
  end_time: string;
}

interface SpecialHoliday {
  id: number;
  date: string;
  description: string;
}

export default function TimetablePage() {
  const [data, setData] = useState<TimetableEntry[]>([]);
  const [originalData, setOriginalData] = useState<TimetableEntry[]>([]);
  const [holidays, setHolidays] = useState<SpecialHoliday[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayDesc, setNewHolidayDesc] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isHolidayLoading, setIsHolidayLoading] = useState(false);

  /* eslint-disable react-hooks/exhaustive-deps */
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('timetable_entries')
        .select('*');

      if (error) {
        toast.error('교시 정보를 불러오지 못했습니다.');
        console.error('Error fetching timetable:', error);
      } else if (data) {
        const sorted = [...data].sort((a, b) => {
          const order = (dt: string) => {
            if (!dt) return 100;
            if (dt.includes('weekday day')) return 10 + parseInt(dt.split(' ').pop() || '0');
            if (dt.includes('weekday night')) return 20 + parseInt(dt.split(' ').pop() || '0');
            if (dt.includes('weekend day')) return 30 + parseInt(dt.split(' ').pop() || '0');
            if (dt.includes('weekend night')) return 40 + parseInt(dt.split(' ').pop() || '0');
            return 100;
          };
          return order(a.day_type) - order(b.day_type);
        });
        setData(sorted as TimetableEntry[]);
        setOriginalData(JSON.parse(JSON.stringify(sorted)));
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHolidays = async () => {
    setIsHolidayLoading(true);
    const { data, error } = await supabase
      .from('special_holidays')
      .select('*')
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching holidays:', error);
    } else {
      setHolidays(data || []);
    }
    setIsHolidayLoading(false);
  };

  useEffect(() => {
    fetchData();
    fetchHolidays();
  }, []);

  const handleAddHoliday = async () => {
    if (!newHolidayDate) {
      toast.error('날짜를 선택해주세요.');
      return;
    }
    const { error } = await supabase
      .from('special_holidays')
      .insert([{ date: newHolidayDate, description: newHolidayDesc }]);

    if (error) {
      if (error.code === '23505') toast.error('이미 등록된 날짜입니다.');
      else toast.error('등록 실패');
    } else {
      toast.success('공휴일이 등록되었습니다.');
      setNewHolidayDate('');
      setNewHolidayDesc('');
      fetchHolidays();
    }
  };

  const handleDeleteHoliday = async (id: number) => {
    const { error } = await supabase.from('special_holidays').delete().eq('id', id);
    if (error) toast.error('삭제 실패');
    else {
      toast.success('삭제되었습니다.');
      fetchHolidays();
    }
  };

  const handleTimeInputChange = (id: number, field: 'start_time' | 'end_time', value: string) => {
    if (value === undefined || value === null) return;

    // Only allow numbers and colon
    let cleaned = value.replace(/[^0-9:]/g, '');

    // Auto-colon logic
    if (cleaned.length === 3 && !cleaned.includes(':') && !value.includes(':')) {
      cleaned = cleaned.substring(0, 2) + ':' + cleaned.substring(2);
    } else if (cleaned.length === 4 && !cleaned.includes(':')) {
      cleaned = cleaned.substring(0, 2) + ':' + cleaned.substring(2);
    }

    if (cleaned.length > 5) cleaned = cleaned.substring(0, 5);
    setData(prev => prev.map(item => item.id === id ? { ...item, [field]: cleaned } : item));
  };

  const validateTime = (time: string) => {
    if (!time) return false;
    const regex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return regex.test(time.substring(0, 5));
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      // 1. Validation
      const invalid = data.some(item => !validateTime(item.start_time) || !validateTime(item.end_time));
      if (invalid) {
        toast.error('올바르지 않은 시간 형식이 있습니다 (00:00 - 23:59).');
        setIsSaving(false);
        return;
      }

      // 2. Diff check
      const changed = data.filter((item) => {
        const original = originalData.find(o => o.id === item.id);
        if (!original) return true;
        return item.start_time !== original.start_time || item.end_time !== original.end_time;
      });

      if (changed.length === 0) {
        toast('변경 사항이 없습니다.');
        setIsSaving(false);
        return;
      }

      // 3. Sequential Updates (RLS friendly)
      // Upsert is often blocked for authenticated/anon users while Update is allowed.
      let successCount = 0;
      let failMessage = '';

      for (const item of changed) {
        const { error } = await supabase
          .from('timetable_entries')
          .update({
            start_time: item.start_time.substring(0, 5) + ':00',
            end_time: item.end_time.substring(0, 5) + ':00'
          })
          .eq('id', item.id);

        if (error) {
          console.error(`Update failed for ID ${item.id}:`, error.message);
          failMessage = error.message;
        } else {
          successCount++;
        }
      }

      if (successCount === changed.length) {
        toast.success(`${successCount}개의 교시 정보가 저장되었습니다.`);
        setOriginalData(JSON.parse(JSON.stringify(data)));
      } else if (successCount > 0) {
        toast.error(`${changed.length}개 중 ${successCount}개만 저장되었습니다. 에러: ${failMessage}`);
      } else {
        toast.error(`저장에 실패했습니다: ${failMessage}`);
      }
    } catch (err: any) {
      console.error('Save error:', err);
      toast.error('저장 중 예기치 않은 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const categories = [
    { title: '📅 평일 주간 (Day)', filter: (dt: string) => dt.includes('weekday day') },
    { title: '🌙 평일 야간 (Night)', filter: (dt: string) => dt.includes('weekday night') },
    { title: '☀️ 주말/공휴일 주간', filter: (dt: string) => dt.includes('weekend day') },
    { title: '✨ 주말/공휴일 야간', filter: (dt: string) => dt.includes('weekend night') },
  ];

  return (
    <div className="p-4 max-w-5xl mx-auto pb-20">
      <Toaster position="top-right" />

      <div className="flex items-center justify-between mb-8">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-yellow-400 rounded-full"></div>
            <h1 className="text-2xl font-extrabold text-gray-800">일과시간 관리 (24시간제)</h1>
          </div>
          <p className="text-[10px] text-gray-500 mt-1 ml-4.5 font-medium tracking-tight">24시간 형식(00:00~23:59)으로 입력하세요.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={clsx(
            "px-6 py-2.5 rounded-2xl font-bold transition-all shadow-lg active:scale-95 flex items-center gap-2 text-sm",
            isSaving ? "bg-gray-400 text-white" : "bg-yellow-400 text-white hover:bg-yellow-500"
          )}
        >
          {isSaving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
          {isSaving ? '저장 중...' : '변경사항 저장'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {categories.map((cat, catIdx) => (
          <div key={catIdx} className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 flex flex-col">
            <h2 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2 shrink-0">
              {cat.title}
            </h2>
            <div className="space-y-3">
              <div className="grid grid-cols-4 text-[10px] font-bold text-gray-400 px-2 tracking-wider shrink-0">
                <div className="col-span-2 uppercase">Period</div>
                <div className="uppercase text-center text-gray-300">Start (24h)</div>
                <div className="uppercase text-center text-gray-300">End (24h)</div>
              </div>
              <div className="flex flex-col gap-3">
                {data.filter(item => cat.filter(item.day_type)).map(entry => {
                  const isStartValid = validateTime(entry.start_time);
                  const isEndValid = validateTime(entry.end_time);

                  return (
                    <div key={entry.id} className="grid grid-cols-4 items-center gap-2 p-2 rounded-2xl bg-gray-50 hover:bg-yellow-50/50 transition-colors border border-transparent hover:border-yellow-100 group">
                      <div className="col-span-2">
                        <span className="text-sm font-bold text-gray-700">{entry.description}</span>
                        <span className="text-[10px] text-gray-400 block font-medium uppercase tracking-tight">{entry.day_type}</span>
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="HH:mm"
                          value={entry.start_time?.substring(0, 5) || ''}
                          onChange={(e) => handleTimeInputChange(entry.id, 'start_time', e.target.value)}
                          className={clsx(
                            "w-full bg-white border rounded-xl px-1 py-1.5 text-xs font-black text-center transition-all outline-none",
                            isStartValid
                              ? "text-gray-700 border-gray-200 group-hover:border-yellow-200 focus:border-yellow-400"
                              : "text-red-500 border-red-200 focus:border-red-400 bg-red-50/30"
                          )}
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="HH:mm"
                          value={entry.end_time?.substring(0, 5) || ''}
                          onChange={(e) => handleTimeInputChange(entry.id, 'end_time', e.target.value)}
                          className={clsx(
                            "w-full bg-white border rounded-xl px-1 py-1.5 text-xs font-black text-center transition-all outline-none",
                            isEndValid
                              ? "text-gray-700 border-gray-200 group-hover:border-yellow-200 focus:border-yellow-400"
                              : "text-red-500 border-red-200 focus:border-red-400 bg-red-50/30"
                          )}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Special Holiday Management */}
      <div className="mt-12 bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100">
        <h2 className="text-xl font-extrabold text-gray-800 mb-6 flex items-center gap-3">
          <div className="w-1.5 h-5 bg-red-400 rounded-full"></div>
          공휴일/특이일 지정 (주말 시간표 적용)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Add Form */}
          <div className="space-y-4">
            <p className="text-sm text-gray-500 font-medium italic mb-4">평일이지만 주말과 동일한 일과(오전/오후/야간)를 사용해야 하는 날짜를 추가하세요.</p>
            <div className="flex flex-col gap-3 p-5 bg-gray-50 rounded-2xl border border-gray-100">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Date</label>
                <input
                  type="date"
                  value={newHolidayDate}
                  onChange={(e) => setNewHolidayDate(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 focus:border-red-400 outline-none transition-all"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Description</label>
                <input
                  type="text"
                  placeholder="예: 추석 연휴, 재량휴업일"
                  value={newHolidayDesc}
                  onChange={(e) => setNewHolidayDesc(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 focus:border-red-400 outline-none transition-all"
                />
              </div>
              <button
                onClick={handleAddHoliday}
                className="mt-2 w-full bg-red-400 text-white font-bold py-3 rounded-xl hover:bg-red-500 transition-all shadow-lg active:scale-95"
              >
                날짜 추가하기
              </button>
            </div>
          </div>

          {/* Holiday List */}
          <div className="flex flex-col">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Registered Special Days</p>
            <div className="flex-1 bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
              <div className="max-h-[300px] overflow-y-auto">
                {holidays.length === 0 ? (
                  <div className="p-10 text-center text-gray-400 text-xs italic">등록된 공휴일이 없습니다.</div>
                ) : (
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="sticky top-0 bg-gray-100 z-10">
                      <tr>
                        <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase">날짜</th>
                        <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase">설명</th>
                        <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase text-right">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {holidays.map((h) => (
                        <tr key={h.id} className="hover:bg-white transition-colors group">
                          <td className="px-4 py-3 font-bold text-gray-700">{h.date}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 font-medium">{h.description}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleDeleteHoliday(h.id)}
                              className="text-red-300 hover:text-red-500 font-bold text-xs opacity-0 group-hover:opacity-100 transition-all"
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
