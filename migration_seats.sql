-- 5. 좌석 속성 테이블 (배정과 무관하게 좌석 자체의 상태 저장)
create table if not exists seats (
  room_number int not null,
  seat_number int not null,
  is_disabled boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (room_number, seat_number)
);

-- 권한 설정
alter table seats enable row level security;
create policy "Allow all access to seats" on seats for all using (true) with check (true);
