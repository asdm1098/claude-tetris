---
description: Crea un git worktree aislado en .trees/[nombre] y ejecuta ahí el requerimiento
argument-hint: <requerimiento a implementar>
---

Requerimiento: $ARGUMENTS

Sigue estos pasos en orden:

1. Deriva un `[nombre]` corto en kebab-case (2-4 palabras, minúsculas, sin acentos ni espacios) a partir del requerimiento. Ejemplo: "agregar pausa con tecla P" → `pausa-tecla-p`.
2. Verifica que `.trees/` esté en `.gitignore`. Si no está, agrégala.
3. Crea el worktree desde la raíz del repo: `git worktree add .trees/[nombre]`
   - Si el nombre ya existe, añade un sufijo (`-2`) en vez de reutilizarlo.
4. Ejecuta el requerimiento de forma independiente y aislada dentro de `.trees/[nombre]`:
   - Todas las lecturas, ediciones y comandos usan rutas dentro de `.trees/[nombre]`.
   - NO modifiques archivos del directorio principal.
   - Respeta las reglas de `CLAUDE.md` (Tetris vanilla JS, sin dependencias, UI en español).
5. Al terminar, haz commit en la rama del worktree (mensaje convencional, ej. `feat: ...`) y reporta: nombre del worktree, ruta, rama, resumen de cambios.
6. No hagas merge, push ni elimines el worktree salvo que el usuario lo pida. Para limpiar después: `git worktree remove .trees/[nombre]`.
