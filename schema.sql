-- =====================================================================
-- Irusta Training Club — base de datos y seguridad
-- Pegar TODO este archivo en Supabase → SQL Editor → Run. Se puede
-- volver a correr sin romper nada (es idempotente).
--
-- Reglas de seguridad (Row Level Security):
--   * Solo entra quien está en la lista: un email de `admins` (Juan)
--     o el email de un alumno activo en `students`.
--   * Un alumno ve SOLO sus datos (rutina, pesos, pagos, pedidos).
--   * Solo los admins ven y editan todo.
--   * Las acciones del alumno (responder el buen día, avisar que pagó,
--     pedir un horario) pasan por funciones controladas.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- tablas ----------
create table if not exists public.admins (
  email text primary key check (email = lower(email))
);

create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  spot text not null default 'rio' check (spot in ('rio','lluvia')),
  rates jsonb not null default '{"1":9000,"2":8500,"3":8000}',
  alias text not null default 'irusta.juan.ignacio',
  bank text not null default 'Banco Francés',
  buen_dia text not null default 'Buennnn díaaaa {nombre}!! 🤜⚡️🤛
Hoy te espero {hora} en {spot}. Confirmá acá: {link}',
  app_url text not null default '',
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text unique check (email is null or email = lower(email)),
  freq int not null default 2 check (freq between 1 and 5),
  sched jsonb not null default '[]',          -- [{"d":2,"t":"08:00"}, ...] d: 1=lun … 5=vie
  split text[] not null default '{}',         -- grupos musculares por día
  next_idx int not null default 0,            -- qué día de rutina le toca
  recover int not null default 0,             -- clases a recuperar
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.replies (
  student_id uuid not null references public.students on delete cascade,
  day date not null,
  reply text not null check (reply in ('voy','tarde','no')),
  updated_at timestamptz not null default now(),
  primary key (student_id, day)
);

create table if not exists public.payments (
  student_id uuid not null references public.students on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  status text not null check (status in ('pending','informed','paid')),
  amount int,
  updated_at timestamptz not null default now(),
  primary key (student_id, month)
);

create table if not exists public.weights (
  id bigserial primary key,
  student_id uuid not null references public.students on delete cascade,
  exercise text not null,
  value numeric not null check (value >= 0 and value < 1000),
  day date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists weights_student_idx on public.weights (student_id, exercise, created_at desc);

create table if not exists public.sessions (
  id bigserial primary key,
  student_id uuid not null references public.students on delete cascade,
  day date not null,
  slot text,
  group_name text,
  kind text not null default 'done' check (kind in ('done','rec'))
);
create index if not exists sessions_student_idx on public.sessions (student_id, day);

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students on delete cascade,
  from_day date,            -- null = recupero o día extra
  from_slot text,
  to_day date not null,
  to_slot text not null,
  reason text,
  status text not null default 'pending' check (status in ('pending','ok','no')),
  created_at timestamptz not null default now()
);

create table if not exists public.suspensions (
  day date not null,
  slot text not null,
  primary key (day, slot)
);

-- ---------- helpers de identidad ----------
create or replace function public.jwt_email() returns text
language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where email = jwt_email())
$$;

create or replace function public.my_student_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from students where email = jwt_email() and active limit 1
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or my_student_id() is not null
$$;

-- ¿Quién soy? (la app lo llama al entrar)
create or replace function public.whoami() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'email', jwt_email(),
    'admin', is_admin(),
    'student', (select row_to_json(s) from students s where s.id = my_student_id())
  )
$$;

-- ---------- acciones del alumno (controladas) ----------
create or replace function public.set_reply(p_day date, p_reply text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := my_student_id(); prev text;
begin
  if me is null then raise exception 'No autorizado'; end if;
  if p_reply not in ('voy','tarde','no') then raise exception 'Respuesta inválida'; end if;
  if p_day < current_date - 1 or p_day > current_date + 7 then raise exception 'Fecha fuera de rango'; end if;
  select reply into prev from replies where student_id = me and day = p_day;
  insert into replies (student_id, day, reply) values (me, p_day, p_reply)
    on conflict (student_id, day) do update set reply = excluded.reply, updated_at = now();
  -- "nada se pierde, todo se reprograma"
  if p_reply = 'no' and coalesce(prev,'') <> 'no' then
    update students set recover = recover + 1 where id = me;
  elsif prev = 'no' and p_reply <> 'no' then
    update students set recover = greatest(recover - 1, 0) where id = me;
  end if;
end $$;

create or replace function public.inform_payment(p_month text, p_amount int) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := my_student_id();
begin
  if me is null then raise exception 'No autorizado'; end if;
  insert into payments (student_id, month, status, amount) values (me, p_month, 'informed', p_amount)
    on conflict (student_id, month) do update
      set status = case when payments.status = 'paid' then 'paid' else 'informed' end,
          amount = excluded.amount, updated_at = now();
end $$;

-- Ocupación de turnos SIN nombres (para que el alumno vea dónde hay lugar)
create or replace function public.occupancy() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_member() then raise exception 'No autorizado'; end if;
  return json_build_object(
    'scheds', (select coalesce(json_agg(json_build_object('id', md5(id::text), 'sched', sched)), '[]') from students where active),
    'moves',  (select coalesce(json_agg(json_build_object('id', md5(student_id::text), 'from_day', from_day, 'from_slot', from_slot, 'to_day', to_day, 'to_slot', to_slot)), '[]')
               from requests where status = 'ok' and to_day >= current_date - 7),
    'suspensions', (select coalesce(json_agg(json_build_object('day', day, 'slot', slot)), '[]') from suspensions where day >= current_date - 7)
  );
end $$;

-- ---------- Row Level Security ----------
alter table public.admins      enable row level security;
alter table public.settings    enable row level security;
alter table public.students    enable row level security;
alter table public.replies     enable row level security;
alter table public.payments    enable row level security;
alter table public.weights     enable row level security;
alter table public.sessions    enable row level security;
alter table public.requests    enable row level security;
alter table public.suspensions enable row level security;

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- admins: solo los admins se ven entre sí; se editan SOLO desde el SQL Editor
create policy admins_read on public.admins for select to authenticated using (is_admin());

-- settings: los miembros leen, los admins editan
create policy settings_read  on public.settings for select to authenticated using (is_member());
create policy settings_write on public.settings for update to authenticated using (is_admin()) with check (is_admin());

-- students: admin todo; alumno solo su fila (lectura)
create policy students_admin on public.students for all to authenticated using (is_admin()) with check (is_admin());
create policy students_self  on public.students for select to authenticated using (id = my_student_id());

-- replies, payments, sessions: admin todo; alumno lee lo suyo (escribe por funciones)
create policy replies_admin  on public.replies  for all to authenticated using (is_admin()) with check (is_admin());
create policy replies_self   on public.replies  for select to authenticated using (student_id = my_student_id());
create policy payments_admin on public.payments for all to authenticated using (is_admin()) with check (is_admin());
create policy payments_self  on public.payments for select to authenticated using (student_id = my_student_id());
create policy sessions_admin on public.sessions for all to authenticated using (is_admin()) with check (is_admin());
create policy sessions_self  on public.sessions for select to authenticated using (student_id = my_student_id());

-- weights: el alumno ve y anota SUS pesos (transparencia); admin todo
create policy weights_admin on public.weights for all to authenticated using (is_admin()) with check (is_admin());
create policy weights_self_read  on public.weights for select to authenticated using (student_id = my_student_id());
create policy weights_self_write on public.weights for insert to authenticated with check (student_id = my_student_id());

-- requests: el alumno crea y ve los suyos (solo como pendientes); admin decide
create policy requests_admin on public.requests for all to authenticated using (is_admin()) with check (is_admin());
create policy requests_self_read  on public.requests for select to authenticated using (student_id = my_student_id());
create policy requests_self_write on public.requests for insert to authenticated
  with check (student_id = my_student_id() and status = 'pending' and to_day >= current_date);

-- suspensions: miembros leen, admin edita
create policy suspensions_read  on public.suspensions for select to authenticated using (is_member());
create policy suspensions_admin on public.suspensions for all to authenticated using (is_admin()) with check (is_admin());

-- Nadie anónimo toca nada
revoke all on all tables in schema public from anon;
revoke execute on function public.set_reply(date, text), public.inform_payment(text, int), public.occupancy(), public.whoami() from anon, public;
grant execute on function public.set_reply(date, text), public.inform_payment(text, int), public.occupancy(), public.whoami() to authenticated;

-- =====================================================================
-- ÚLTIMO PASO: cargá los emails de los admins (Juan y vos). Editá y corré:
--
--   insert into public.admins (email) values
--     ('email-de-juan@gmail.com'),
--     ('tu-email@gmail.com')
--   on conflict do nothing;
-- =====================================================================
