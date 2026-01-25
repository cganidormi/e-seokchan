-- Existing weekend entries removal
DELETE FROM timetable_entries WHERE day_type LIKE 'weekend%';

-- Weekend Morning (오전)
-- 1교시: 09:30 ~ 10:20
-- 2교시: 10:30 ~ 11:20
-- 3교시: 11:30 ~ 12:30 (Ends at 12:30 as requested)
INSERT INTO timetable_entries (day_type, description, start_time, end_time, period_type, period_number) VALUES
('weekend morning 1', '주말 오전 1교시', '09:30:00', '10:20:00', 'morning', 1),
('weekend morning 2', '주말 오전 2교시', '10:30:00', '11:20:00', 'morning', 2),
('weekend morning 3', '주말 오전 3교시', '11:30:00', '12:30:00', 'morning', 3);

-- Weekend Day/Afternoon (오후) - labeled as 4, 5, 6
-- 4교시: 13:30 ~ 14:20
-- 5교시: 14:30 ~ 15:20
-- 6교시: 15:30 ~ 16:20
INSERT INTO timetable_entries (day_type, description, start_time, end_time, period_type, period_number) VALUES
('weekend day 4', '주말 오후 4교시', '13:30:00', '14:20:00', 'day', 4),
('weekend day 5', '주말 오후 5교시', '14:30:00', '15:20:00', 'day', 5),
('weekend day 6', '주말 오후 6교시', '15:30:00', '16:20:00', 'day', 6);

-- Weekend Night (야간)
-- 1교시: 19:00 ~ 20:00
-- 2교시: 20:10 ~ 21:00
-- 3교시: 21:10 ~ 22:00
INSERT INTO timetable_entries (day_type, description, start_time, end_time, period_type, period_number) VALUES
('weekend night 1', '주말 야간 1교시', '19:00:00', '20:00:00', 'night', 1),
('weekend night 2', '주말 야간 2교시', '20:10:00', '21:00:00', 'night', 2),
('weekend night 3', '주말 야간 3교시', '21:10:00', '22:00:00', 'night', 3);
