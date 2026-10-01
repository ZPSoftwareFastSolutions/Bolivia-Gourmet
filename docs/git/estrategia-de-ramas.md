# Estrategia de ramas

> Práctica y controlada: una rama por **línea de trabajo**, no por función
> pequeña. Fecha: 2026-09-30.

## 1. Estructura

```text
main                        Base estable: documentación, estructura, dominio verificado.
│                           Solo recibe merges de ramas de sistema con pruebas pasadas.
│
├── feat/sistema-interno    SISTEMA 1 · panel de gestión (inventario, estudiantes,
│                           inscripciones, entregas, pagos, tablero). Rama de larga vida.
│
└── feat/pagina-web         SISTEMA 2 · sitio público informativo. Se crea cuando
                            empiece esa línea; hasta entonces NO existe.
```

Prefijos heredados del equipo: `feat/`, `fix/`, `docs/`, `refactor/` +
kebab-case. Versiones grandes dentro de una línea, solo si hace falta aislar
un hito: `feat/sistema-interno-v2`.

## 2. Reglas

1. **Nunca** una rama por botón, formulario, tarjeta, color o tabla.
2. Se trabaja en la rama del sistema; los commits son pequeños y con mensaje
   en español que explica el **porqué** (el diff ya dice el qué).
3. Un merge a `main` exige: `typecheck`, `test`, `build`, `audit` pasados;
   `CLAUDE.md` y `TASKS.md` actualizados; sin código comentado ni restos de
   prueba.
4. Correcciones urgentes sobre `main`: `fix/<que-arregla>`, merge a `main` y a
   las ramas de sistema abiertas.
5. Desarrollos no relacionados no se mezclan en la misma rama ni en el mismo
   commit.
6. Push y creación del remoto solo cuando el usuario lo pide o lo hace.
7. Cierre de firma en cada commit: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## 3. Repositorio remoto

- Cuenta Git local: `ZPSoftwareFastSolutions` (`zapasoftwarefastsolutions@gmail.com`).
- Organización GitHub de los proyectos anteriores: `ZPSoftwareFastSolutions`.
- **El remoto de este proyecto no existe todavía** y no se asume su nombre. No
  hay `gh` ni token en la máquina: lo crea el usuario en GitHub y luego se
  asocia con:

```bash
git remote add origin https://github.com/<organizacion>/<repositorio>.git
git push -u origin main
git push -u origin feat/sistema-interno
```

Antes de cualquier push: `git remote -v` y comprobar que el remoto es el de
este proyecto y no el de otro.

## 4. Estado actual (2026-10-01)

| Rama | Contenido |
|---|---|
| `main` | Fase 0 + base de datos, aclaraciones y catálogo actualizado |
| `feat/sistema-interno` | Igual a `main`; sin trabajo propio todavía |
| `feat/pagina-web` | Web pública, portal de estudiantes y escudos de seguridad. Pendiente de aprobación para merge a `main` |

Remoto: https://github.com/ZPSoftwareFastSolutions/Bolivia-Gourmet. Los
últimos commits pueden estar solo en local si el gestor de credenciales pidió
iniciar sesión (TASKS E2.D3): `git push origin main feat/sistema-interno feat/pagina-web`.
