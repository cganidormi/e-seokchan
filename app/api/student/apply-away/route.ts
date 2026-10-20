import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isWeeklyHomeTime } from '@/lib/weeklyReturn';

export async function POST(request: Request) {
    try {
        const { studentId } = await request.json();

        if (!studentId) {
            return NextResponse.json({ error: '학생 ID가 누락되었습니다.' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Calculate Real Server Time in KST (UTC+9)
        const now = new Date();
        const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
        const kstDate = new Date(now.getTime() + KST_OFFSET_MS);

        const year = kstDate.getUTCFullYear();
        const month = kstDate.getUTCMonth() + 1;
        const day = kstDate.getUTCDate();
        const dayOfWeek = kstDate.getUTCDay(); // 0: Sun, 6: Sat
        const hours = kstDate.getUTCHours();
        const minutes = kstDate.getUTCMinutes();

        const pad = (n: number) => String(n).padStart(2, '0');
        const currentHHmm = `${pad(hours)}:${pad(minutes)}`;
        const dateStr = `${year}-${pad(month)}-${pad(day)}`;

        // 2. Determine Weekend / Holiday
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const { data: holidays } = await supabase.from('special_holidays').select('date');
        const isSpecialHoliday = (holidays || []).some((h: any) => h.date === dateStr);
        const isHoliday = isWeekend || isSpecialHoliday;

        // 3. Timetable matching
        let matchType = '';
        if (isHoliday) {
            if (currentHHmm < '13:00') matchType = 'weekend morning';
            else if (currentHHmm < '18:30') matchType = 'weekend day';
            else matchType = 'weekend night';
        } else {
            if (currentHHmm < '19:00') matchType = 'weekday day';
            else matchType = 'weekday night';
        }

        const { data: timetable, error: timetableError } = await supabase.from('timetable_entries').select('*');
        if (timetableError || !timetable || timetable.length === 0) {
            return NextResponse.json({
                error: '시간표 정보를 불러올 수 없습니다. 관리자에게 문의하세요.',
                serverTime: currentHHmm
            }, { status: 500 });
        }

        const currentMinutes = hours * 60 + minutes;

        const currentEntry = timetable.find((t: any) => {
            const dt = (t.day_type || '').toLowerCase();
            if (!dt.includes(matchType.toLowerCase())) return false;

            const [sh, sm] = (t.start_time || '').split(':').map(Number);
            const [eh, em] = (t.end_time || '').split(':').map(Number);
            if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return false;

            const startMin = sh * 60 + sm;
            const endMin = eh * 60 + em;
            return currentMinutes >= startMin && currentMinutes <= endMin;
        });

        // 4. Outside defined period (Break time / Non-class hours)
        if (!currentEntry) {
            return NextResponse.json({
                error: '쉬는 시간 및 수업 외 시간에는 시스템을 통한 자리비움 신청을 할 수 없습니다.',
                restrictionType: 'BREAK_TIME',
                title: '쉬는 시간 및 수업 외 시간',
                message: `쉬는 시간 및 수업 외 시간에는 시스템을 통한 자리비움 신청을 할 수 없습니다. (현재 시스템 시각: ${currentHHmm})`,
                serverTime: currentHHmm
            }, { status: 400 });
        }

        const periodName = currentEntry.description || '현재 교시';
        const [sh, sm] = currentEntry.start_time.split(':').map(Number);
        const [eh, em] = currentEntry.end_time.split(':').map(Number);
        const periodStartMin = sh * 60 + sm;
        const periodEndMin = eh * 60 + em;

        // 5. 10-Minute Restrictions
        if (currentMinutes < periodStartMin + 10) {
            return NextResponse.json({
                error: `${periodName} 시작 후 10분 동안은 시스템을 통한 자리비움 신청이 되지 않습니다.`,
                restrictionType: 'START_10MIN',
                title: `${periodName} 시작 후 10분 동안 신청 제한`,
                message: `${periodName} 시작 후 10분 동안은 시스템을 통한 자리비움 신청이 되지 않습니다. (현재 시스템 시각: ${currentHHmm})`,
                periodName,
                serverTime: currentHHmm
            }, { status: 400 });
        }

        if (currentMinutes > periodEndMin - 10) {
            return NextResponse.json({
                error: `${periodName} 종료 10분 전부터는 시스템을 통한 자리비움 신청이 되지 않습니다.`,
                restrictionType: 'END_10MIN',
                title: `${periodName} 종료 10분 전`,
                message: `${periodName} 종료 10분 전부터는 시스템을 통한 자리비움 신청이 되지 않습니다. (현재 시스템 시각: ${currentHHmm})`,
                periodName,
                serverTime: currentHHmm
            }, { status: 400 });
        }

        // Period UTC ISO bounds
        const limitStartIso = new Date(`${year}-${pad(month)}-${pad(day)}T${pad(sh)}:${pad(sm)}:00+09:00`).toISOString();
        const limitEndIso = new Date(`${year}-${pad(month)}-${pad(day)}T${pad(eh)}:${pad(em)}:59.999+09:00`).toISOString();

        // 6. Check for active 외출 / 외박
        const { data: activeOuting } = await supabase
            .from('leave_requests')
            .select('id, leave_type')
            .eq('student_id', studentId)
            .in('leave_type', ['외출', '외박'])
            .in('status', ['신청', '승인'])
            .lte('start_time', now.toISOString())
            .gt('end_time', now.toISOString())
            .limit(1);

        if (activeOuting && activeOuting.length > 0) {
            return NextResponse.json({
                error: `현재 '${activeOuting[0].leave_type}' 상태이므로 자리비움을 신청할 수 없습니다.`,
                serverTime: currentHHmm
            }, { status: 400 });
        }

        // 7. Check if already used '자리비움' in this period
        const { data: recentAway } = await supabase
            .from('leave_requests')
            .select('id, start_time')
            .eq('student_id', studentId)
            .eq('leave_type', '자리비움')
            .in('status', ['신청', '승인'])
            .gte('start_time', limitStartIso)
            .lte('start_time', limitEndIso)
            .limit(1);

        if (recentAway && recentAway.length > 0) {
            return NextResponse.json({
                error: `[제한] ${periodName}에 이미 '자리비움'을 사용했습니다. (한 교시에 1회만 가능)`,
                restrictionType: 'ALREADY_USED',
                title: `${periodName} 자리비움 중복 신청 제한`,
                message: `${periodName}에 이미 '자리비움'을 사용했습니다. (한 교시에 1회만 가능, 현재 시스템 시각: ${currentHHmm})`,
                periodName,
                serverTime: currentHHmm
            }, { status: 400 });
        }

        // 8. Check if currently in active 자리비움
        const { data: ongoingAway } = await supabase
            .from('leave_requests')
            .select('id, start_time')
            .eq('student_id', studentId)
            .eq('leave_type', '자리비움')
            .in('status', ['신청', '승인'])
            .lte('start_time', now.toISOString())
            .gt('end_time', now.toISOString())
            .limit(1);

        if (ongoingAway && ongoingAway.length > 0) {
            return NextResponse.json({
                error: `[제한] 현재 진행 중인 자리비움이 있습니다.`,
                restrictionType: 'ALREADY_USED',
                title: '자리비움 진행 중',
                message: `현재 이미 자리비움 상태입니다. (현재 시스템 시각: ${currentHHmm})`,
                periodName,
                serverTime: currentHHmm
            }, { status: 400 });
        }

        // 9. Check weekly returner restrictions
        const { data: monthlyData } = await supabase
            .from('monthly_return_applications')
            .select('is_weekly')
            .eq('student_id', studentId)
            .eq('target_year', year)
            .eq('target_month', month)
            .maybeSingle();

        const { data: studentRecord } = await supabase
            .from('students')
            .select('weekend')
            .eq('student_id', studentId)
            .maybeSingle();

        const isWeekly = studentRecord?.weekend || monthlyData?.is_weekly;
        if (isWeekly && isWeeklyHomeTime(now, (holidays || []).map((h: any) => h.date))) {
            return NextResponse.json({
                error: '매주 귀가 학생은 정기 귀가 시간대에 자리비움을 신청할 수 없습니다.',
                serverTime: currentHHmm
            }, { status: 400 });
        }

        // 10. Insert new leave request with server timestamp
        const { data: leaveData, error: insertError } = await supabase
            .from('leave_requests')
            .insert([{
                student_id: studentId,
                leave_type: '자리비움',
                teacher_id: null,
                place: null,
                reason: '10분간 자리비움',
                period: null,
                start_time: now.toISOString(),
                end_time: limitEndIso,
                status: '승인',
            }])
            .select()
            .single();

        if (insertError || !leaveData) {
            console.error('[Apply Away] Insert error:', insertError);
            return NextResponse.json({ error: '자리비움 신청 저장 실패' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            data: leaveData,
            serverTime: currentHHmm,
            periodName
        });
    } catch (error: any) {
        console.error('[Apply Away] Server error:', error);
        return NextResponse.json({ error: error.message || '서버 오류가 발생했습니다.' }, { status: 500 });
    }
}
