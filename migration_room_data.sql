-- Insert default room layouts for Floors 1-4 if they don't exist
-- Assuming 20 rooms per floor, 4 seats per room = 80 capacity per floor for example.
-- Or better, just insert one row per "Floor" conceptualized as a room range?
-- No, the code queries: r.room_number >= floor * 100
-- So let's insert some rooms.

INSERT INTO room_layouts (room_number, total_seats) VALUES
(101, 4), (102, 4), (103, 4), (104, 4), (105, 4), (106, 4), (107, 4), (108, 4), (109, 4), (110, 4),
(201, 4), (202, 4), (203, 4), (204, 4), (205, 4), (206, 4), (207, 4), (208, 4), (209, 4), (210, 4),
(301, 4), (302, 4), (303, 4), (304, 4), (305, 4), (306, 4), (307, 4), (308, 4), (309, 4), (310, 4),
(401, 4), (402, 4), (403, 4), (404, 4), (405, 4), (406, 4), (407, 4), (408, 4), (409, 4), (410, 4)
ON CONFLICT (room_number) DO NOTHING;
