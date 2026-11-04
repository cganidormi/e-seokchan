import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            userType,
            userId,
            parentToken,
            subscription,
            deviceType,
            oldEndpoint,
            forceCleanUser
        } = body;

        if (!subscription || !subscription.endpoint) {
            return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Missing Supabase server credentials' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const nowIso = new Date().toISOString();
        const endpoint: string = subscription.endpoint;

        // Build owner filter column/value
        let ownerCol: 'teacher_id' | 'student_id' | 'parent_token' | null = null;
        let ownerVal: string | null = null;

        if (userType === 'teacher' && userId) {
            ownerCol = 'teacher_id';
            ownerVal = String(userId).trim();
        } else if (userType === 'student' && userId) {
            ownerCol = 'student_id';
            ownerVal = String(userId).trim();
        } else if (userType === 'parent' && parentToken) {
            ownerCol = 'parent_token';
            ownerVal = String(parentToken).trim();
        }

        if (!ownerCol || !ownerVal) {
            return NextResponse.json({ error: 'Missing user identifier' }, { status: 400 });
        }

        // If forceCleanUser is true (manual re-subscribe button), remove old rows for this user first
        if (forceCleanUser) {
            await supabase.from('push_subscriptions').delete().eq(ownerCol, ownerVal);
        }

        // Fetch existing subscriptions for this user
        const { data: existingRows } = await supabase
            .from('push_subscriptions')
            .select('id, subscription_json')
            .eq(ownerCol, ownerVal);

        // 1. Delete obsolete oldEndpoint if provided
        if (oldEndpoint && oldEndpoint !== endpoint && existingRows && existingRows.length > 0) {
            const oldIds = existingRows
                .filter((r: any) => {
                    const ep = typeof r.subscription_json === 'string'
                        ? JSON.parse(r.subscription_json)?.endpoint
                        : r.subscription_json?.endpoint;
                    return ep === oldEndpoint;
                })
                .map((r: any) => r.id);

            if (oldIds.length > 0) {
                await supabase.from('push_subscriptions').delete().in('id', oldIds);
            }
        }

        // 2. Check if current endpoint already exists for this user
        const matchingRows = (existingRows || []).filter((r: any) => {
            const ep = typeof r.subscription_json === 'string'
                ? JSON.parse(r.subscription_json)?.endpoint
                : r.subscription_json?.endpoint;
            return ep === endpoint;
        });

        // 이미 DB에 해당 구독이 존재하면 기존 데이터를 일절 수정/삭제하지 않고 그대로 통과(Pass)
        if (matchingRows.length > 0) {
            return NextResponse.json({ success: true, action: 'already_exists', id: matchingRows[0].id });
        }

        // 3. Insert new subscription row
        const payload: any = {
            [ownerCol]: ownerVal,
            subscription_json: subscription,
            device_type: deviceType || 'mobile',
            last_used_at: nowIso
        };

        const { data: inserted, error: insertErr } = await supabase
            .from('push_subscriptions')
            .insert(payload)
            .select('id')
            .single();

        if (insertErr) {
            return NextResponse.json({ error: insertErr.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, action: 'inserted', id: inserted?.id });
    } catch (err: any) {
        console.error('[API/push-sync] Error:', err);
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
    }
}

