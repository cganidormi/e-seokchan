import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import initialData from "@/lib/initialSupervisionData.json";
import { SupervisionScheduleData } from "@/lib/supervisionParser";

if (process.env.NODE_ENV !== "production") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SETTING_KEY = "supervision_schedule_2026";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("system_settings")
      .select("setting_value, updated_at")
      .eq("setting_key", SETTING_KEY)
      .maybeSingle();

    if (error) {
      console.warn("Failed to load supervision schedule from DB, falling back to initial data:", error.message);
      return NextResponse.json({ schedule: initialData, source: "initial_fallback" });
    }

    if (data?.setting_value) {
      try {
        const parsed = JSON.parse(data.setting_value) as SupervisionScheduleData;
        return NextResponse.json({ schedule: parsed, source: "database", updatedAt: data.updated_at });
      } catch (parseErr) {
        console.error("JSON parse error for supervision schedule:", parseErr);
      }
    }

    // Default to bundled initial data if nothing in DB yet
    return NextResponse.json({ schedule: initialData, source: "initial_bundled" });
  } catch (err: any) {
    console.error("GET supervision schedule error:", err);
    return NextResponse.json({ schedule: initialData, source: "error_fallback", error: err.message });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { schedule, fileName } = body;

    if (!schedule || !schedule.months || typeof schedule.year !== "number") {
      return NextResponse.json(
        { error: "유효하지 않은 감독표 데이터 형식입니다." },
        { status: 400 }
      );
    }

    const payload: SupervisionScheduleData = {
      ...schedule,
      fileName: fileName || schedule.fileName,
      uploadedAt: new Date().toISOString(),
    };

    const { error } = await supabase.from("system_settings").upsert(
      {
        setting_key: SETTING_KEY,
        setting_value: JSON.stringify(payload),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      console.error("Failed to save supervision schedule to system_settings:", error);
      return NextResponse.json(
        { error: "감독표 저장 중 오류가 발생했습니다.", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, schedule: payload });
  } catch (err: any) {
    console.error("POST supervision schedule error:", err);
    return NextResponse.json(
      { error: "서버 처리 중 오류가 발생했습니다.", details: err.message },
      { status: 500 }
    );
  }
}
