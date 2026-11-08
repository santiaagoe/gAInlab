# gAInlab

Tu próximo entrenamiento, ya calculado.

gAInlab es una app web instalable (PWA) para entrenar en el gimnasio con progresión constante. Respondes una encuesta corta, recibes una rutina adaptada a tu objetivo, y después de cada sesión la app calcula el peso y las repeticiones de la siguiente.

## Qué hace (v0.5)

- **Dos formas de empezar**:
  - *Arma un plan para mí*: encuesta de objetivo, experiencia, situación (incluye volver tras una pausa), días, minutos, equipo y molestias. El plan propuesto se puede editar antes de empezar.
  - *Ya tengo un plan*: copias tu rutina día por día, con nombres de día propios y ejercicios de la biblioteca o creados por ti.
- **Rutina por reglas** (v0.5): el motor arma la semana a partir del documento de reglas del proyecto (`docs/reglas-entrenamiento.md`), sin plantillas fijas. Cada cifra está en `src/engine/rules.ts` con la tabla de la que sale.
  - Series semanales por músculo según objetivo, experiencia y edad, contadas con el método fraccional (12 grupos: cuádriceps, glúteos, femorales, gemelos, pecho, espalda, hombro anterior, lateral y posterior, bíceps, tríceps y core).
  - División según los días: cuerpo completo A/B (2) o A/B/C (3), torso/pierna (4), torso/pierna/empuje/tirón (5) o empuje/tirón/pierna (6), con cada músculo dos veces por semana y un tope de series por sesión. Los días de fuerza tienen un tope según la experiencia (3, 4 o 5); se puede desactivar en Ajustes.
  - Ejercicios según patrón de movimiento, equipo, molestias y experiencia (sin barra libre para quien empieza), en el orden recomendado: compuestos primero, core y gemelos al final.
  - Repeticiones, esfuerzo objetivo (repeticiones en reserva) y descansos por objetivo y experiencia.
  - Duración estimada de cada sesión. Si no cabe en los minutos elegidos, recorta en orden: calentamiento, superseries seguras, descansos y volumen hasta el mínimo. Si aun así no cabe, arma una **versión reducida** y lo avisa con los músculos que quedan bajo el mínimo y la opción de sumar un día o 15 minutos.
  - Determinístico: las mismas respuestas dan siempre la misma rutina.
- **Calibración**: la primera vez que haces un ejercicio anotas un peso cómodo y las repeticiones reales.
- **Prescripción automática (doble progresión)**:
  - Dentro del rango: mismo peso, +1 repetición por serie.
  - Tope del rango en todas las series: sube el peso y vuelve al mínimo (doble salto si se sintió fácil en un básico).
  - Bajo el rango: repite el peso; si pasa dos veces seguidas, baja un 10%.
  - Calibración muy lejos del rango: recalcula el peso con el 1RM estimado (Epley) y cómo se sintió.
  - Modo regreso: tras 2+ semanas sin un ejercicio, baja un 10–30% según la pausa.
- **Ajustes por edad** (7 grupos, de menos de 18 a 70 o más):
  - Plan: rangos de 6+ repeticiones para menores de 18 y desde los 50 (8+ desde los 60 y 10+ si empiezas), más descanso entre series desde los 40, volumen inicial en el mínimo desde los 50 y con máximo más bajo desde los 60, sin barra libre para menores de 18, mayores de 70 ni principiantes de 60+, y como máximo 3 días para menores de 18. Cuando dos reglas chocan, gana la más conservadora.
  - Progresión: sin doble salto de peso para menores de 18 y desde los 50; si se llega al tope "al límite", se consolida una sesión antes de subir.
  - Modo regreso antes y más prudente con la edad (desde 10–12 días sin entrenar y hasta un 10% extra de bajada).
  - Calentamiento sin series de 1 repetición pesadas y con una serie extra liviana desde los 50.
- **Modo entrenamiento**: un ejercicio a la vez, barra con todos los ejercicios y su avance, botón "Siguiente" que se destaca al terminar las series y deslizar para cambiar de ejercicio. También hay vista de lista.
- **Sesión en el gimnasio**: valores prellenados, serie actual destacada, marcar series con un toque, temporizador de descanso con vibración, series de calentamiento sugeridas y notas por ejercicio. Cada ejercicio dice con cuánto margen terminar las series y qué botón (fácil, justo o al límite) debería salir. En las superseries, la app alterna sola entre los dos ejercicios y descansa al terminar cada par.
- **Rutina editable**: cambiar un ejercicio (solo hoy o en la rutina) con aviso si no trabaja la misma zona; ajustar series, rango, descanso y orden; añadir y quitar ejercicios y días; crear ejercicios que no están en la biblioteca.
- **Revisar cobertura**: en Ajustes, cualquier plan (generado, editado, anterior a v0.5 o propio) muestra qué grupos musculares quedan bajo el volumen recomendado, qué patrones faltan y qué se entrena una sola vez por semana. Desde ahí se puede pasar a un plan nuevo sin perder el historial. Los planes creados antes no cambian solos.
- **Historial editable**: corregir o borrar sesiones pasadas; las prescripciones se recalculan solas.
- **Progreso**: constancia por semana, racha de semanas cumplidas y gráfico de fuerza estimada por ejercicio.
- **Datos locales**: todo se guarda en el celular, con respaldo y restauración en JSON. Funciona sin internet. Los datos de versiones anteriores se migran solos y se guarda una copia intacta antes de la primera migración.

## Instalar en el celular

1. Abre la app publicada en GitHub Pages desde el navegador del celular.
2. iPhone (Safari): Compartir → Agregar a inicio. Android (Chrome): menú → Instalar app.

## Desarrollo

```bash
npm install
npm run dev      # servidor local
npm test         # tests, incluidas las 17 reglas de validación sobre las 50.400 combinaciones de la encuesta (~4 min)
npm run build    # build de producción en dist/
```

Stack: React 19, TypeScript, Vite, vite-plugin-pwa, Recharts.

```
src/
  engine/        # lógica pura y testeada
    rules.ts     # tablas de docs/reglas-entrenamiento.md como datos tipados
    targets.ts   # encuesta + edad → metas, topes, repeticiones, esfuerzo y descansos
    generator.ts # encuesta → rutina (reparto, duración, recortes y modo reducido)
    validate.ts  # las 17 reglas de validación del documento
    coverage.ts  # conteo fraccional de series por músculo y patrón
    duration.ts  # duración estimada de una sesión (fórmula 4b)
    notice.ts    # textos del aviso de modo reducido y de la revisión de cobertura
    exercises.ts # biblioteca de ejercicios por patrón de movimiento
    plan.ts      # punto de entrada de la rutina y dosis de ejercicios añadidos a mano
    planEdit.ts  # ediciones puras del plan (cambiar, añadir, quitar, días)
    age.ts       # reglas por grupo de edad
    swap.ts      # avisos de zona muscular al cambiar o quitar ejercicios
    progression.ts # calibración, doble progresión, modo regreso
  screens/       # Onboarding, Hoy, Sesión, Progreso, Ajustes
  persistence.ts # formato guardado, migraciones y validación
  store.ts       # estado y persistencia en localStorage
```

## Publicación

Cada push a `main` ejecuta los tests, construye la app y la publica en GitHub Pages (`.github/workflows/deploy.yml`). En el repo, **Settings → Pages → Source** debe estar en **GitHub Actions**.

## Pendientes del motor de reglas

Anotados para más adelante (detalle en [`REVISION.md`](REVISION.md)):

- Detección automática de semanas de descarga (tabla 10c).
- Ajustar la progresión de `progression.ts` a la tabla 10b (cambios propuestos en `REVISION.md`).
- Equilibrio y potencia para mayores de 60, y cuestionario de cribado antes de empezar (sección 11b).
- Subir el volumen semanal de a 1–2 series cada 2 semanas, y la regla de 50 a 59 años de partir 4 semanas en el mínimo: hoy el motor arma la semana 1.
- Recuperación de 72 h para mayores de 70: con 3 días de cuerpo completo hay 48 h entre sesiones.

## Próximas versiones

- **v2**: dieta (modo simple con proteína y modo detallado con calorías y macros) y predicciones con rangos de progreso esperado.
- **v3**: ajuste adaptativo de calorías según tu peso, revisiones semanales e IA para explicar el plan y responder dudas.
