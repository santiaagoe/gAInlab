# gAInlab

Tu próximo entrenamiento, ya calculado.

gAInlab es una app web instalable (PWA) para entrenar en el gimnasio con progresión constante. Respondes una encuesta corta, recibes una rutina adaptada a tu objetivo, y después de cada sesión la app calcula el peso y las repeticiones de la siguiente.

## Qué hace el MVP

- **Dos formas de empezar**:
  - *Arma un plan para mí*: encuesta de objetivo, experiencia, situación (incluye volver tras una pausa), días, minutos, equipo y molestias. El plan propuesto se puede editar antes de empezar.
  - *Ya tengo un plan*: copias tu rutina día por día, con nombres de día propios y ejercicios de la biblioteca o creados por ti.
- **Rutina por plantillas**: full body (2–3 días), torso/pierna (4), torso/pierna/empuje/tirón (5) o empuje/tirón/pierna (6). Series, rangos y descansos según el objetivo; ejercicios según el equipo y las molestias.
- **Calibración**: la primera vez que haces un ejercicio anotas un peso cómodo y las repeticiones reales.
- **Prescripción automática (doble progresión)**:
  - Dentro del rango: mismo peso, +1 repetición por serie.
  - Tope del rango en todas las series: sube el peso y vuelve al mínimo (doble salto si se sintió fácil en un básico).
  - Bajo el rango: repite el peso; si pasa dos veces seguidas, baja un 10%.
  - Calibración muy lejos del rango: recalcula el peso con el 1RM estimado (Epley) y cómo se sintió.
  - Modo regreso: tras 2+ semanas sin un ejercicio, baja un 10–30% según la pausa.
- **Ajustes por edad** (7 grupos, de menos de 18 a 70 o más):
  - Plan: rangos de 6+ repeticiones para menores de 18 y desde los 50 (8+ desde los 60), menos series máximas en los básicos, más descanso entre series desde los 40, y máquinas o mancuernas en vez de los básicos con barra más técnicos para principiantes de 60+.
  - Progresión: sin doble salto de peso para menores de 18 y desde los 50; si se llega al tope "al límite", se consolida una sesión antes de subir.
  - Modo regreso antes y más prudente con la edad (desde 10–12 días sin entrenar y hasta un 10% extra de bajada).
  - Calentamiento sin series de 1 repetición pesadas y con una serie extra liviana desde los 50.
- **Modo entrenamiento**: un ejercicio a la vez, barra con todos los ejercicios y su avance, botón "Siguiente" que se destaca al terminar las series y deslizar para cambiar de ejercicio. También hay vista de lista.
- **Sesión en el gimnasio**: valores prellenados, serie actual destacada, marcar series con un toque, temporizador de descanso con vibración, series de calentamiento sugeridas y notas por ejercicio.
- **Rutina editable**: cambiar un ejercicio (solo hoy o en la rutina) con aviso si no trabaja la misma zona; ajustar series, rango, descanso y orden; añadir y quitar ejercicios y días; crear ejercicios que no están en la biblioteca.
- **Historial editable**: corregir o borrar sesiones pasadas; las prescripciones se recalculan solas.
- **Progreso**: constancia por semana, racha de semanas cumplidas y gráfico de fuerza estimada por ejercicio.
- **Datos locales**: todo se guarda en el celular, con respaldo y restauración en JSON. Funciona sin internet.

## Instalar en el celular

1. Abre la app publicada en GitHub Pages desde el navegador del celular.
2. iPhone (Safari): Compartir → Agregar a inicio. Android (Chrome): menú → Instalar app.

## Desarrollo

```bash
npm install
npm run dev      # servidor local
npm test         # tests del motor de progresión
npm run build    # build de producción en dist/
```

Stack: React 19, TypeScript, Vite, vite-plugin-pwa, Recharts.

```
src/
  engine/        # lógica pura y testeada
    exercises.ts # biblioteca de ejercicios por patrón de movimiento
    plan.ts      # encuesta → rutina (plantillas + reglas)
    planEdit.ts  # ediciones puras del plan (cambiar, añadir, quitar, días)
    age.ts       # reglas por grupo de edad
    swap.ts      # avisos de zona muscular al cambiar o quitar ejercicios
    progression.ts # calibración, doble progresión, modo regreso
  screens/       # Onboarding, Hoy, Sesión, Progreso, Ajustes
  store.ts       # estado y persistencia en localStorage
```

## Publicación

Cada push a `main` ejecuta los tests, construye la app y la publica en GitHub Pages (`.github/workflows/deploy.yml`). En el repo, **Settings → Pages → Source** debe estar en **GitHub Actions**.

## Próximas versiones

- **v2**: dieta (modo simple con proteína y modo detallado con calorías y macros) y predicciones con rangos de progreso esperado.
- **v3**: ajuste adaptativo de calorías según tu peso, revisiones semanales e IA para explicar el plan y responder dudas.
