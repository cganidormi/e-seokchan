'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';

interface TimetableEntry {
  id: number;
  day_type: string;    // weekday day 1 ~ weekend night 4
  description: string;
  start_time: string;
  end_time: string;
}

// 순수 JS debounce 함수
function debounce(func: Function, delay: number) {
  let timer: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => func(...args), delay);
  };
}

export default function TimetablePage() {
  const [data, setData] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // 데이터 fetch
  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase
        .from<TimetableEntry>('timetable_entries')
        .select('*');

      if (error) {
        console.error('Error fetching timetable:', error);
      } else if (data) {
        const sortedData = data.sort((a, b) => a.day_type.localeCompare(b.day_type));
        setData(sortedData);
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  // 자동 저장 함수 (debounce 적용)
  const autoSave = debounce(async (id: number, field: 'start_time' | 'end_time', value: string) => {
    const { error } = await supabase
      .from('timetable_entries')
      .update({ [field]: value })
      .eq('id', id);

    if (error) console.error(`Error updating ${field} for id ${id}:`, error);
  }, 500); // 500ms 지연

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">일과시간 관리</h1>
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr>
            <th className="border border-gray-300 p-2">요일/교시</th>
            <th className="border border-gray-300 p-2">설명</th>
            <th className="border border-gray-300 p-2">시작 시간</th>
            <th className="border border-gray-300 p-2">종료 시간</th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry) => (
            <tr key={entry.id}>
              <td className="border border-gray-300 p-2">{entry.day_type}</td>
              <td className="border border-gray-300 p-2">{entry.description}</td>
              <td className="border border-gray-300 p-2">
                <input
                  type="time"
                  value={entry.start_time}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setData((prev) =>
                      prev.map((d) =>
                        d.id === entry.id ? { ...d, start_time: newValue } : d
                      )
                    );
                    autoSave(entry.id, 'start_time', newValue);
                  }}
                  className="w-full border rounded px-1"
                />
              </td>
              <td className="border border-gray-300 p-2">
                <input
                  type="time"
                  value={entry.end_time}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setData((prev) =>
                      prev.map((d) =>
                        d.id === entry.id ? { ...d, end_time: newValue } : d
                      )
                    );
                    autoSave(entry.id, 'end_time', newValue);
                  }}
                  className="w-full border rounded px-1"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
