-- ============================================================================
-- 0001 · Esquema privado `app` y sedes
-- ----------------------------------------------------------------------------
-- `app` guarda las funciones SECURITY DEFINER de contexto y autorización. NO
-- está entre los esquemas que publica la API (PostgREST expone `public`), así
-- que nadie puede llamarlas como /rest/v1/rpc. Las políticas RLS sí pueden
-- usarlas: se evalúan dentro de la base. (ADR 0002)
-- ============================================================================

create schema if not exists app;
revoke all on schema app from public;
-- Las políticas se evalúan con los privilegios de quien consulta: necesita
-- poder «ver» el esquema para resolver la función, no listarlo ni crear nada.
-- Solo `authenticated`: ninguna política aplicable a `anon` llama a `app.*`
-- (mínimo privilegio; las de `anon` se escriben aparte y sin funciones).
grant usage on schema app to authenticated;

-- updated_at mantenido por la base: el cliente no puede escribirlo ni olvidarlo.
create or replace function app.marcar_actualizado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function app.marcar_actualizado() from public;

-- ---------------------------------------------------------------- sedes

create table public.sedes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nombre text not null check (char_length(trim(nombre)) between 1 and 60),
  zona text not null check (char_length(trim(zona)) between 1 and 60),
  direccion text not null check (char_length(trim(direccion)) between 1 and 200),
  -- Celular boliviano: 8 dígitos que empiezan por 6 o 7 (mismo patrón que el dominio).
  telefono text not null check (telefono ~ '^[67][0-9]{7}$'),
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.sedes is 'Sedes físicas del instituto. Toda operación se atribuye a una.';

create trigger sedes_actualizado
  before update on public.sedes
  for each row execute function app.marcar_actualizado();

alter table public.sedes enable row level security;

-- Supabase concede ALL por defecto a anon y authenticated en `public`. Se
-- retira todo y se concede solo lo necesario: RLS filtra filas, los grants
-- filtran operaciones y columnas. Las dos capas, no una.
revoke all on table public.sedes from anon, authenticated;
grant select on table public.sedes to anon, authenticated;

-- Las sedes activas son información pública (dirección y teléfono en la web).
create policy sedes_lectura_publica
  on public.sedes for select
  to anon, authenticated
  using (activa);

insert into public.sedes (codigo, nombre, zona, direccion, telefono) values
  ('la-paz', 'La Paz', 'Miraflores',
   'Calle Francisco de Miranda #1986 entre Villalobos y Díaz Romero', '77706890'),
  ('el-alto', 'El Alto', 'La Ceja',
   'Calle 4 esq. Jorge Carrasco, Edificio Kollasuyo #225 (5to piso)', '77708027');
