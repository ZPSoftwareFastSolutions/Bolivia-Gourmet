-- ============================================================================
-- 0003 · Programas (referencia para claves foráneas)
-- ----------------------------------------------------------------------------
-- El CONTENIDO de cada programa (plan de estudios, temas, opciones) vive hoy
-- en el catálogo estático validado (`apps/web/src/infrastructure/catalogo/`).
-- Esta tabla es solo la referencia que permite que una solicitud apunte a un
-- programa real y que la base rechace uno inexistente o inactivo. Los códigos
-- deben coincidir con el catálogo; una prueba del repositorio lo vigila.
-- Cuando el catálogo se mude a la base (fase 3), esta tabla crece.
-- ============================================================================

create type public.tipo_de_programa as enum ('carrera', 'curso', 'curso_de_temporada');

create table public.programas (
  codigo text primary key check (codigo ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  tipo public.tipo_de_programa not null,
  nombre text not null check (char_length(trim(nombre)) between 1 and 80),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger programas_actualizado
  before update on public.programas
  for each row execute function app.marcar_actualizado();

alter table public.programas enable row level security;

revoke all on table public.programas from anon, authenticated;
grant select on table public.programas to anon, authenticated;
grant insert, update on table public.programas to authenticated;

-- Dos políticas y no una: `anon` no puede ejecutar `app.tiene_permiso`, y una
-- política compartida le haría evaluarla (el OR no garantiza cortocircuito).
create policy programas_lectura_publica
  on public.programas for select
  to anon
  using (activo);

create policy programas_lectura
  on public.programas for select
  to authenticated
  using (activo or (select app.tiene_permiso('programas.gestionar')));

create policy programas_alta
  on public.programas for insert
  to authenticated
  with check ((select app.tiene_permiso('programas.gestionar')));

create policy programas_edicion
  on public.programas for update
  to authenticated
  using ((select app.tiene_permiso('programas.gestionar')))
  with check ((select app.tiene_permiso('programas.gestionar')));

insert into public.programas (codigo, tipo, nombre) values
  ('gastronomia', 'carrera', 'Gastronomía'),
  ('cocina', 'curso', 'Cocina'),
  ('cocteleria', 'curso', 'Coctelería'),
  ('reposteria-y-panaderia', 'curso', 'Repostería y Panadería'),
  ('tortas', 'curso', 'Tortas'),
  ('cursos-de-temporada', 'curso_de_temporada', 'Cursos de Temporada');
