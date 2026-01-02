export interface Teacher {
    id: string;
    name: string;
}

export interface Student {
    student_id: string;
    name: string;
    grade: number;
    class: number;
}

export interface LeaveRequest {
    id: string | number;
    student_id: string;
    leave_type: string;
    period: string;
    place: string;
    reason: string;
    status: string;
    start_time: string;
    end_time: string;
    teacher_id: string;
    created_at: string;
    teachers?: {
        name: string;
    };
    leave_request_students?: {
        student_id: string;
    }[];
}
