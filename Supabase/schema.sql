-- ============================================================================
--  Мини-CRM «Объекты и задачи» — схема БД и правила доступа
-- ============================================================================
--  Файл идемпотентный: его можно применить целиком в Supabase SQL Editor
--  как к чистой базе, так и поверх уже развёрнутой (старые политики,
--  триггеры и функции пересоздаются).
--
--  Принципы безопасности:
--   * RLS включён на всех таблицах, права описаны политиками;
--   * исполнитель видит только свои задачи и свои объекты;
--   * статус меняется только через RPC change_task_status, а корректность
--     перехода дополнительно проверяет триггер (защита от прямого UPDATE);
--   * история статусов append-only: писать может только SECURITY DEFINER
--     триггер, у клиента нет ни прав, ни политик на INSERT/UPDATE/DELETE;
--   * роли назначаются только вручную из SQL Editor, из API роль изменить
--     нельзя (триггер protect_profile_fields).
--
--  Тестовых пользователей создавайте вручную: Authentication → Users
--  (Open registration должен быть выключен), после чего выдайте роль:
--      update public.profiles set role = 'tasker' where email = '...';
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Таблицы
-- ----------------------------------------------------------------------------
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text,
  role       text not null default 'executor' check (role in ('tasker', 'executor')),
  created_at timestamptz not null default now()
);

create table if not exists public.objects (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  address    text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  object_id   uuid not null references public.objects (id) on delete restrict,
  assignee_id uuid references public.profiles (id),
  author_id   uuid not null references public.profiles (id),
  status      text not null default 'new'
              check (status in ('new', 'in_progress', 'on_review', 'accepted', 'rework')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- История статусов. Пишется только триггером (append-only).
create table if not exists public.task_history (
  id          bigint generated always as identity primary key,
  task_id     uuid not null references public.tasks (id) on delete cascade,
  changed_by  uuid not null references public.profiles (id),
  from_status text,
  to_status   text not null,
  comment     text,
  created_at  timestamptz not null default now()
);

create index if not exists tasks_object_id_idx        on public.tasks (object_id);
create index if not exists tasks_assignee_id_idx      on public.tasks (assignee_id);
create index if not exists tasks_status_idx           on public.tasks (status);
create index if not exists task_history_task_id_idx   on public.task_history (task_id, created_at);

-- ----------------------------------------------------------------------------
-- 2. Вспомогательные функции
-- ----------------------------------------------------------------------------
create or replace function public.current_user_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_tasker()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'tasker'
  );
$$;

revoke all on function public.current_user_role() from public;
revoke all on function public.is_tasker() from public;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_tasker() to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Профили
-- ----------------------------------------------------------------------------

-- Профиль создаётся автоматически при создании пользователя в Supabase Auth.
-- Роль из user_metadata НЕ берётся: иначе при включённой регистрации любой
-- мог бы зарегистрироваться сразу постановщиком. Роль назначается вручную.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'executor'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Роль, email и id профиля нельзя менять из клиентского API.
-- auth.uid() is null означает служебный контекст (SQL Editor / service_role).
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'Идентификатор профиля изменить нельзя' using errcode = '42501';
  end if;

  if new.created_at is distinct from old.created_at then
    raise exception 'Дату создания профиля изменить нельзя' using errcode = '42501';
  end if;

  if auth.uid() is not null then
    if new.role is distinct from old.role then
      raise exception 'Изменение роли запрещено' using errcode = '42501';
    end if;

    if new.email is distinct from old.email then
      raise exception 'Изменение email запрещено' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_fields on public.profiles;
create trigger profiles_protect_fields
before update on public.profiles
for each row execute function public.protect_profile_fields();

-- ----------------------------------------------------------------------------
-- 4. Объекты
-- ----------------------------------------------------------------------------
create or replace function public.objects_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    -- Клиент всегда создаёт объект от своего имени.
    if auth.uid() is not null and new.created_by is distinct from auth.uid() then
      raise exception 'Автором объекта может быть только текущий пользователь'
        using errcode = '42501';
    end if;
  else
    if new.created_by is distinct from old.created_by then
      raise exception 'Автора объекта изменить нельзя' using errcode = '42501';
    end if;

    if new.created_at is distinct from old.created_at then
      raise exception 'Дату создания объекта изменить нельзя' using errcode = '42501';
    end if;
  end if;

  if length(btrim(coalesce(new.name, ''))) = 0 then
    raise exception 'Название объекта не может быть пустым' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists objects_before_write on public.objects;
create trigger objects_before_write
before insert or update on public.objects
for each row execute function public.objects_before_write();

-- ----------------------------------------------------------------------------
-- 5. Задачи: updated_at
-- ----------------------------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_updated_at on public.tasks;
create trigger tasks_updated_at
before update on public.tasks
for each row execute function public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 6. Задачи: валидация записи (вторая линия защиты после RLS)
-- ----------------------------------------------------------------------------
-- Триггер проверяет всё, что должно быть неизменным, и допустимость перехода
-- статуса. Поэтому даже прямой UPDATE/DELETE через PostgREST (в обход UI)
-- не позволит нарушить правила из ТЗ.
create or replace function public.tasks_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid           uuid := auth.uid();
  v_role          text;
  v_assignee_role text;
  v_comment       text := btrim(coalesce(current_setting('app.status_comment', true), ''));
begin
  -- Служебный контекст (SQL Editor / service_role): доверяем.
  if v_uid is null then
    return new;
  end if;

  select role into v_role from public.profiles where id = v_uid;
  if v_role is null then
    raise exception 'Профиль пользователя не найден' using errcode = 'P0002';
  end if;

  if tg_op = 'INSERT' then
    if v_role <> 'tasker' then
      raise exception 'Создавать задачи может только постановщик' using errcode = '42501';
    end if;

    if new.author_id is distinct from v_uid then
      raise exception 'Автором задачи может быть только текущий пользователь' using errcode = '42501';
    end if;

    if new.status <> 'new' then
      raise exception 'Новая задача создаётся только в статусе «Новая»' using errcode = 'P0001';
    end if;
  else
    if new.author_id is distinct from old.author_id then
      raise exception 'Автора задачи изменить нельзя' using errcode = '42501';
    end if;

    if new.object_id is distinct from old.object_id then
      raise exception 'Объект задачи изменить нельзя' using errcode = '42501';
    end if;

    if new.created_at is distinct from old.created_at then
      raise exception 'Дату создания задачи изменить нельзя' using errcode = '42501';
    end if;

    -- Смена исполнителя: только постановщик и только до начала работы.
    if new.assignee_id is distinct from old.assignee_id then
      if v_role <> 'tasker' then
        raise exception 'Назначать исполнителя может только постановщик' using errcode = '42501';
      end if;

      if old.status not in ('new', 'rework') then
        raise exception 'Исполнителя можно менять только в статусах «Новая» и «На доработке»'
          using errcode = 'P0001';
      end if;
    end if;

    -- Разрешённые переходы статусов (перечень из ТЗ).
    if new.status is distinct from old.status then
      if old.status = 'new' and new.status = 'in_progress' then
        if v_role <> 'executor' or v_uid <> new.assignee_id then
          raise exception 'Переход «Новая → В работе» может выполнить только назначенный исполнитель'
            using errcode = '42501';
        end if;

      elsif old.status = 'in_progress' and new.status = 'on_review' then
        if v_role <> 'executor' or v_uid <> new.assignee_id then
          raise exception 'Переход «В работе → На проверке» может выполнить только назначенный исполнитель'
            using errcode = '42501';
        end if;

      elsif old.status = 'on_review' and new.status = 'accepted' then
        if v_role <> 'tasker' then
          raise exception 'Переход «На проверке → Принята» может выполнить только постановщик'
            using errcode = '42501';
        end if;

      elsif old.status = 'on_review' and new.status = 'rework' then
        if v_role <> 'tasker' then
          raise exception 'Переход «На проверке → На доработке» может выполнить только постановщик'
            using errcode = '42501';
        end if;

        if v_comment = '' then
          raise exception 'Комментарий обязателен при возврате на доработку' using errcode = 'P0001';
        end if;

      elsif old.status = 'rework' and new.status = 'in_progress' then
        if v_role <> 'executor' or v_uid <> new.assignee_id then
          raise exception 'Переход «На доработке → В работе» может выполнить только назначенный исполнитель'
            using errcode = '42501';
        end if;

      else
        raise exception 'Недопустимый переход статуса' using errcode = 'P0001';
      end if;
    end if;
  end if;

  -- Исполнителем может быть только пользователь с ролью executor.
  if new.assignee_id is not null then
    select role into v_assignee_role from public.profiles where id = new.assignee_id;

    if v_assignee_role is distinct from 'executor' then
      raise exception 'Исполнителем может быть только пользователь с ролью «Исполнитель»'
        using errcode = 'P0001';
    end if;
  end if;

  if length(btrim(coalesce(new.title, ''))) = 0 then
    raise exception 'Название задачи не может быть пустым' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_before_write on public.tasks;
create trigger tasks_before_write
before insert or update on public.tasks
for each row execute function public.tasks_before_write();

-- Совместимость: старый триггер проверки переходов больше не нужен.
drop trigger if exists check_task_status_transition on public.tasks;
drop function if exists public.validate_task_status_transition();

-- ----------------------------------------------------------------------------
-- 7. История статусов: запись только триггером, изменение запрещено
-- ----------------------------------------------------------------------------

-- Комментарий к переходу RPC передаёт через локальную настройку транзакции
-- app.status_comment. Подделать её из PostgREST нельзя: произвольный SQL
-- клиент не выполняет.
create or replace function public.log_task_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    if auth.uid() is null then
      raise exception 'Смена статуса задачи требует аутентификации' using errcode = '28000';
    end if;

    insert into public.task_history (task_id, changed_by, from_status, to_status, comment)
    values (
      new.id,
      auth.uid(),
      old.status,
      new.status,
      nullif(btrim(coalesce(current_setting('app.status_comment', true), '')), '')
    );
  end if;

  return new;
end;
$$;

drop trigger if exists log_task_status_change on public.tasks;
create trigger log_task_status_change
after update of status on public.tasks
for each row execute function public.log_task_status_change();

-- История неизменяема. DELETE разрешён только как каскад при удалении самой
-- задачи (в этот момент родительской строки уже нет).
create or replace function public.prevent_history_tampering()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'История статусов неизменяема' using errcode = '42501';
  end if;

  if exists (select 1 from public.tasks where id = old.task_id) then
    raise exception 'Историю статусов нельзя удалить' using errcode = '42501';
  end if;

  return old;
end;
$$;

drop trigger if exists task_history_no_update on public.task_history;
create trigger task_history_no_update
before update on public.task_history
for each row execute function public.prevent_history_tampering();

drop trigger if exists task_history_no_delete on public.task_history;
create trigger task_history_no_delete
before delete on public.task_history
for each row execute function public.prevent_history_tampering();

-- ----------------------------------------------------------------------------
-- 8. RPC смены статуса
-- ----------------------------------------------------------------------------
create or replace function public.change_task_status(
  p_task_id    uuid,
  p_new_status text,
  p_comment    text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task    public.tasks%rowtype;
  v_uid     uuid := auth.uid();
  v_role    text;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
begin
  if v_uid is null then
    raise exception 'Пользователь не аутентифицирован' using errcode = '28000';
  end if;

  -- Блокируем строку, чтобы исключить гонку при параллельных запросах.
  select * into v_task
  from public.tasks
  where id = p_task_id
  for update;

  if not found then
    raise exception 'Задача не найдена' using errcode = 'P0002';
  end if;

  select role into v_role from public.profiles where id = v_uid;
  if v_role is null then
    raise exception 'Профиль пользователя не найден' using errcode = 'P0002';
  end if;

  if v_task.status = p_new_status then
    raise exception 'Задача уже находится в этом статусе' using errcode = 'P0001';
  end if;

  -- Быстрая проверка по таблице переходов; детальная проверка прав —
  -- в триггере tasks_before_write (он сработает на UPDATE ниже).
  if not (
       (v_task.status = 'new'         and p_new_status = 'in_progress')
    or (v_task.status = 'in_progress' and p_new_status = 'on_review')
    or (v_task.status = 'on_review'   and p_new_status in ('accepted', 'rework'))
    or (v_task.status = 'rework'      and p_new_status = 'in_progress')
  ) then
    raise exception 'Недопустимый переход статуса' using errcode = 'P0001';
  end if;

  if v_task.status = 'on_review' and p_new_status = 'rework' and v_comment is null then
    raise exception 'Комментарий обязателен при возврате на доработку' using errcode = 'P0001';
  end if;

  -- Комментарий читает триггер логирования истории.
  perform set_config('app.status_comment', coalesce(v_comment, ''), true);

  update public.tasks
     set status = p_new_status
   where id = p_task_id;

  perform set_config('app.status_comment', '', true);
end;
$$;

revoke all on function public.change_task_status(uuid, text, text) from public;
revoke all on function public.change_task_status(uuid, text, text) from anon;
grant execute on function public.change_task_status(uuid, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 9. Row Level Security
-- ----------------------------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.objects      enable row level security;
alter table public.tasks        enable row level security;
alter table public.task_history enable row level security;

-- Никакого доступа у анонимных пользователей к данным.
revoke all on public.profiles, public.objects, public.tasks, public.task_history from anon;

-- --- profiles ---------------------------------------------------------------
drop policy if exists "profiles_select_own"       on public.profiles;
drop policy if exists "profiles_select_tasker"    on public.profiles;
drop policy if exists "profiles_select_related"   on public.profiles;
drop policy if exists "profiles_update_own"       on public.profiles;
drop policy if exists "profiles_no_insert"        on public.profiles;

create policy "profiles_select_own" on public.profiles
for select to authenticated
using (id = auth.uid());

-- Постановщик видит всех: ему нужен список исполнителей для назначения.
create policy "profiles_select_tasker" on public.profiles
for select to authenticated
using (public.is_tasker());

-- Исполнитель видит только тех, кто связан с его задачами:
-- автора задачи и участников её истории. Чужие профили недоступны.
create policy "profiles_select_related" on public.profiles
for select to authenticated
using (
  exists (
    select 1
    from public.tasks t
    where t.assignee_id = auth.uid()
      and t.author_id = profiles.id
  )
  or exists (
    select 1
    from public.task_history h
    join public.tasks t on t.id = h.task_id
    where t.assignee_id = auth.uid()
      and h.changed_by = profiles.id
  )
);

create policy "profiles_no_insert" on public.profiles
for insert to authenticated
with check (false);

-- UPDATE-политики нет: клиент не может менять профили (в т.ч. себе роль).
-- Дополнительно это страхует триггер protect_profile_fields.

-- --- objects ----------------------------------------------------------------
drop policy if exists "objects_tasker_all"        on public.objects;
drop policy if exists "objects_tasker_select"     on public.objects;
drop policy if exists "objects_tasker_insert"     on public.objects;
drop policy if exists "objects_tasker_update"     on public.objects;
drop policy if exists "objects_tasker_delete"     on public.objects;
drop policy if exists "objects_executor_select"   on public.objects;

create policy "objects_tasker_select" on public.objects
for select to authenticated
using (public.is_tasker());

create policy "objects_tasker_insert" on public.objects
for insert to authenticated
with check (public.is_tasker() and created_by = auth.uid());

create policy "objects_tasker_update" on public.objects
for update to authenticated
using (public.is_tasker())
with check (public.is_tasker());

-- Удалить объект можно только когда в нём нет задач:
-- на tasks.object_id стоит ON DELETE RESTRICT.
create policy "objects_tasker_delete" on public.objects
for delete to authenticated
using (public.is_tasker());

create policy "objects_executor_select" on public.objects
for select to authenticated
using (
  exists (
    select 1
    from public.tasks
    where tasks.object_id = objects.id
      and tasks.assignee_id = auth.uid()
  )
);

-- --- tasks ------------------------------------------------------------------
drop policy if exists "tasks_tasker_all"       on public.tasks;
drop policy if exists "tasks_tasker_select"    on public.tasks;
drop policy if exists "tasks_tasker_insert"    on public.tasks;
drop policy if exists "tasks_tasker_update"    on public.tasks;
drop policy if exists "tasks_tasker_delete"    on public.tasks;
drop policy if exists "tasks_executor_select"  on public.tasks;
drop policy if exists "tasks_executor_update"  on public.tasks;

create policy "tasks_tasker_select" on public.tasks
for select to authenticated
using (public.is_tasker());

create policy "tasks_tasker_insert" on public.tasks
for insert to authenticated
with check (public.is_tasker());

create policy "tasks_tasker_update" on public.tasks
for update to authenticated
using (public.is_tasker())
with check (public.is_tasker());

-- Удаление задачи — только постановщиком и только в статусе «Новая».
create policy "tasks_tasker_delete" on public.tasks
for delete to authenticated
using (public.is_tasker() and status = 'new');

-- Исполнитель только читает свои задачи. UPDATE-политики нет:
-- смена статуса идёт исключительно через RPC change_task_status.
create policy "tasks_executor_select" on public.tasks
for select to authenticated
using (assignee_id = auth.uid());

-- --- task_history -----------------------------------------------------------
drop policy if exists "history_select_tasker"     on public.task_history;
drop policy if exists "history_select_executor"   on public.task_history;
drop policy if exists "history_no_direct_insert"  on public.task_history;
drop policy if exists "history_no_update"         on public.task_history;
drop policy if exists "history_no_delete"         on public.task_history;

create policy "history_select_tasker" on public.task_history
for select to authenticated
using (public.is_tasker());

create policy "history_select_executor" on public.task_history
for select to authenticated
using (
  exists (
    select 1
    from public.tasks
    where tasks.id = task_history.task_id
      and tasks.assignee_id = auth.uid()
  )
);

-- Писать историю может только SECURITY DEFINER триггер.
create policy "history_no_direct_insert" on public.task_history
for insert to authenticated
with check (false);

create policy "history_no_update" on public.task_history
for update to authenticated
using (false);

create policy "history_no_delete" on public.task_history
for delete to authenticated
using (false);

-- Дополнительно к политикам: у клиента вообще нет DML-прав на историю.
revoke insert, update, delete on public.task_history from authenticated;
revoke insert, update, delete on public.task_history from anon;
grant select on public.task_history to authenticated;

-- --- GRANT-ы ----------------------------------------------------------------
-- RLS сама по себе прав не выдаёт: без явных GRANT роль authenticated получает
-- «permission denied for table ...». Выдаём минимум — остальное решают политики.
grant usage on schema public to anon, authenticated;

grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.objects to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;

-- Вставка в таблицы с identity-колонками требует доступа к последовательностям.
grant usage, select on all sequences in schema public to authenticated;
