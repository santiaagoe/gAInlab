# gAInlab

Tu próximo entrenamiento, ya calculado.

gAInlab es una app web instalable (PWA) para entrenar en el gimnasio con progresión constante. Respondes una encuesta corta, recibes una rutina adaptada a tu objetivo, y después de cada sesión la app calcula el peso y las repeticiones de la siguiente.

## Qué hace el MVP

- **Encuesta inicial**: objetivo, experiencia, situación (incluye volver tras una pausa), días por semana, minutos por sesión, equipo y molestias.
- **Rutina por plantillas**: full body (2–3 días), torso/pierna (4), torso/pierna/empuje/tirón (5) o empuje/tirón/pierna (6). Series, rangos y descansos según el objetivo; ejercicios según el equipo y las molestias.
- **Calibración**: la primera vez que haces un ejercicio anotas un peso cómodo y las repeticiones reales.
- **Prescripción automática (doble progresión)**:
  - Dentro del rango: mismo peso, +1 repetición por serie.
  - Tope del rango en todas las series: sube el peso y vuelve al mínimo (doble salto si se sintió fácil en un básico).
  - Bajo el rango: repite el peso; si pasa dos veces seguidas, baja un 10%.
  - Calibración muy lejos del rango: recalcula el peso con el 1RM estimado (Epley) y cómo se sintió.
  - Modo regreso: tras 2+ semanas sin un ejercicio, baja un 10–30% según la pausa.
- **Sesión en el gimnasio**: valores prellenados, marcar series con un toque, temporizador de descanso con vibración, cambio de ejercicio con un toque.
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
    progression.ts # calibración, doble progresión, modo regreso
  screens/       # Onboarding, Hoy, Sesión, Progreso, Ajustes
  store.ts       # estado y persistencia en localStorage
```

## Publicación

Cada push a `main` ejecuta los tests, construye la app y la publica en GitHub Pages (`.github/workflows/deploy.yml`). En el repo, **Settings → Pages → Source** debe estar en **GitHub Actions**.

## Próximas versiones

- **v2**: dieta (modo simple con proteína y modo detallado con calorías y macros) y predicciones con rangos de progreso esperado.
- **v3**: ajuste adaptativo de calorías según tu peso, revisiones semanales e IA para explicar el plan y responder dudas.
