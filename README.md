# Exam Review

Aplicación Vue para revisión de exámenes basada en el puntaje total de cada examen con persistencia local en localStorage.

## Funciones incluidas (V1)

- Gestión de aulas por grado, sección y año.
- Registro de alumnos por aula.
- Estado de alumno activo o retirado sin borrar historial de exámenes corregidos.
- Promoción anual manual de alumnos al siguiente grado/año.
- Creación de exámenes con preguntas dinámicas:
	- Opción múltiple (con respuesta correcta).
	- Respuesta libre (evaluación por puntaje parcial).
- Flujo de calificación alumno por alumno con nota inmediata y avance rápido.
- Reportes gráficos por examen:
	- Distribución de notas.
	- Rendimiento por pregunta.
	- Aprobados vs desaprobados.
- Respaldo y restauración de datos:
	- Exportación JSON completa.
	- Exportación CSV de calificaciones.
	- Importación JSON en modo fusionar o reemplazar.

## Scripts

- `pnpm dev`: inicia servidor de desarrollo.
- `pnpm build`: validación TypeScript + build de producción.
- `pnpm preview`: vista previa del build.

## Estructura principal

- `src/stores/app.ts`: estado global y reglas de negocio.
- `src/views/ClassroomsView.vue`: aulas, alumnos y promoción.
- `src/views/ExamsView.vue`: constructor de exámenes.
- `src/views/GradingView.vue`: flujo principal de corrección.
- `src/views/ReportsView.vue`: gráficos de rendimiento.
- `src/views/BackupView.vue`: exportación/importación.

## Notas

- El umbral de aprobación está en 11/20.
- Los datos se guardan automáticamente en localStorage.
- Para mover la información entre equipos, exporta JSON y luego impórtalo.
