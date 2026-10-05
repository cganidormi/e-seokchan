import { SupabaseClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export interface ScheduledNoticeItem {
  id: string;
  created_at: string;
  scheduled_at: string; // ISO 8601 string
  target_student_id: string; // 'all' or specific student_id (e.g. '3317홍길동')
  notice_text: string;
  send_push: boolean;
  status: 'pending' | 'published' | 'cancelled';
  creator_id: string;
}

export async function getScheduledNotices(supabase: SupabaseClient): Promise<ScheduledNoticeItem[]> {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'scheduled_student_notices')
      .single();

    if (error || !data?.setting_value) return [];
    const list = JSON.parse(data.setting_value);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.error('getScheduledNotices error:', err);
    return [];
  }
}

export async function saveScheduledNotices(supabase: SupabaseClient, list: ScheduledNoticeItem[]) {
  try {
    await supabase.from('system_settings').upsert({
      setting_key: 'scheduled_student_notices',
      setting_value: JSON.stringify(list),
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('saveScheduledNotices error:', err);
    throw err;
  }
}

export async function addScheduledNotice(
  supabase: SupabaseClient,
  params: {
    creator_id: string;
    scheduled_at: string;
    target_student_id: string;
    notice_text: string;
    send_push: boolean;
  }
): Promise<ScheduledNoticeItem> {
  const list = await getScheduledNotices(supabase);
  const newItem: ScheduledNoticeItem = {
    id: `notice_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    created_at: new Date().toISOString(),
    scheduled_at: params.scheduled_at,
    target_student_id: params.target_student_id,
    notice_text: params.notice_text,
    send_push: params.send_push,
    status: 'pending',
    creator_id: params.creator_id,
  };

  list.push(newItem);
  await saveScheduledNotices(supabase, list);
  return newItem;
}

export async function cancelScheduledNotice(
  supabase: SupabaseClient,
  noticeId: string
): Promise<boolean> {
  const list = await getScheduledNotices(supabase);
  const updatedList = list.filter(item => item.id !== noticeId);
  await saveScheduledNotices(supabase, updatedList);
  return true;
}

export async function processDueScheduledNotices(supabase: SupabaseClient): Promise<{ processed: number }> {
  try {
    const list = await getScheduledNotices(supabase);
    if (!list || list.length === 0) return { processed: 0 };

    const now = new Date();
    const dueItems = list.filter(item => item.status === 'pending' && new Date(item.scheduled_at) <= now);
    if (dueItems.length === 0) return { processed: 0 };

    if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      try {
        webpush.setVapidDetails(
          process.env.VAPID_SUBJECT || 'mailto:admin@dormichan.com',
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
          process.env.VAPID_PRIVATE_KEY
        );
      } catch (e) {
        console.error('VAPID setup error in scheduledNotice:', e);
      }
    }

    // Sort by scheduled_at ascending so older schedules apply first, newer schedule takes precedence
    dueItems.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

    for (const item of dueItems) {
      try {
        let pushTargetQuery: any = null;
        let pushTitle = '📢 알림';
        let cleanPushBody = item.notice_text.replace(/\n?__ROOM_PUBLIC:(true|false)__/, '').trim();
        let pushBody = cleanPushBody.length > 30 ? cleanPushBody.substring(0, 30) + '...' : cleanPushBody;

        if (item.target_student_id === 'all') {
          // 1. 전체 공지 업데이트
          const { error: sysError } = await supabase
            .from('system_settings')
            .update({ setting_value: item.notice_text })
            .eq('setting_key', 'student_notice');
          if (sysError) throw sysError;

          // 2. 모든 학생의 개별 공지 비우기 (초기화)
          const { error: clearError } = await supabase
            .from('students')
            .update({ personal_notice: null })
            .not('student_id', 'is', null);
          if (clearError) throw clearError;

          pushTargetQuery = supabase.from('push_subscriptions').select('*').not('student_id', 'is', null);
          pushTitle = '📢 [전체 공지] 홍지관 안내문';
        } else {
          // 1. 특정 학생의 개별 공지 업데이트
          const { error: updateError } = await supabase
            .from('students')
            .update({ personal_notice: item.notice_text })
            .eq('student_id', item.target_student_id);
          if (updateError) throw updateError;

          const targetNumericId = String(item.target_student_id).match(/^\d+/)?.[0];
          const targetSearchIds = Array.from(new Set([String(item.target_student_id), targetNumericId].filter(Boolean) as string[]));

          pushTargetQuery = supabase.from('push_subscriptions').select('*').in('student_id', targetSearchIds);
          pushTitle = '📝 [개별 공지] 홍지관 안내문';
        }

        // 알림 푸시 전송 (send_push 가 true 일 때)
        if (item.send_push && pushTargetQuery && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
          const { data: subs, error: subError } = await pushTargetQuery;
          if (!subError && subs && subs.length > 0) {
            const payload = JSON.stringify({
              title: pushTitle,
              body: pushBody,
              url: '/student'
            });

            const chunkSize = 35;
            const expiredIds: string[] = [];

            for (let i = 0; i < subs.length; i += chunkSize) {
              const chunk = subs.slice(i, i + chunkSize);
              const results = await Promise.allSettled(
                chunk.map(async (sub: any) => {
                  const subscription = typeof sub.subscription_json === 'string'
                    ? JSON.parse(sub.subscription_json)
                    : sub.subscription_json;
                  return webpush.sendNotification(subscription, payload, {
                    headers: { 'Urgency': 'high' }
                  });
                })
              );

              results.forEach((res, idx) => {
                if (res.status === 'rejected') {
                  const err: any = res.reason;
                  if (err && (err.statusCode === 410 || err.statusCode === 404 || err.statusCode === 401 || err.statusCode === 403)) {
                    if (chunk[idx]?.id) {
                      expiredIds.push(chunk[idx].id);
                    }
                  }
                }
              });
            }

            if (expiredIds.length > 0) {
              try {
                await supabase.from('push_subscriptions').delete().in('id', expiredIds);
                console.log(`[Scheduled Notice] Cleaned up ${expiredIds.length} expired subscriptions.`);
              } catch (cleanupErr) {
                console.error('[Scheduled Notice] Cleanup error:', cleanupErr);
              }
            }
          }
        }

        item.status = 'published';
      } catch (err) {
        console.error(`Failed to publish scheduled notice ${item.id}:`, err);
      }
    }

    // Keep pending and remove published items older than 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const updatedList = list.filter(item =>
      item.status === 'pending' || (item.status === 'published' && new Date(item.scheduled_at) >= oneDayAgo)
    );

    await saveScheduledNotices(supabase, updatedList);
    return { processed: dueItems.length };
  } catch (error) {
    console.error('processDueScheduledNotices general error:', error);
    return { processed: 0 };
  }
}
