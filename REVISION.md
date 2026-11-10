# Revisión — gAInlab

## v0.5.1 · Descanso largo y curl femoral (2026-11-09)

Alcance: ajuste del generador tras revisar la rutina de hipertrofia de 4 días y 60 minutos (rama `ajuste-descanso-compuestos`). Solo cambia el motor: no hay cambios de interfaz ni de formato de datos, y los planes ya guardados no se modifican.

### Qué cambió
- **Descanso largo** (`LONG_REST` y `HEAVY_REST` en `rules.ts`): en hipertrofia y pérdida de grasa con sesiones de **60 minutos o más**, el generador ya no recorta el descanso para caber en el tiempo (se omite el paso 3 de la tabla 8a) y quita series en su lugar, siempre respetando el mínimo de 1a. Los dos primeros compuestos de cada día (los pesados) descansan 150 s, el resto de compuestos 120 s y los aislamientos 90 s. Con descanso extra por edad, se suma igual que antes.
- **Curl femoral en dos sesiones** (`seedIsolation`): la flexión de rodilla se siembra en dos días, para que quede a la par de la bisagra de cadera (tabla 6).
- **Sin cambios**: sesiones de menos de 60 minutos (siguen la tabla 8a tal como está, así que la tabla 9c no cambia), fuerza, salud, progresión y edad.

### Efecto en una encuesta de hipertrofia, menos de 1 año, 4 × 60, gimnasio
| | Antes | Ahora |
|---|---|---|
| Descanso en compuestos | 120 s (115 s en Torso B) | 150 s los 2 primeros, 120 s el resto |
| Descanso en aislamientos | 90 s (85 s en Torso B) | 90 s |
| Hombro lateral | 11 series por semana | 8 (el mínimo de 1a) |
| Curl femoral | 1 día | 2 días |
| Pierna B | 49 min | 59 min |

Todos los músculos siguen entre el mínimo y el máximo de 1a, y el plan sigue siendo completo.

### Por qué
Con el descanso recortado, el generador mantenía el volumen por defecto y bajaba el descanso hasta el piso de la tabla 8a. Schoenfeld 2016 (21 hombres entrenados, 8 semanas) obtuvo más fuerza y más grosor muscular con 3 minutos que con 1 minuto. Singer 2024 (metaanálisis de 9 estudios, solo personas sin entrenamiento) ve un beneficio pequeño por encima de 60 s y ninguno por encima de 90 s, con intervalos que cruzan el cero. Los estudios no se contradicen del todo, y 150 s sigue dentro del rango de 4a (90–180 s), así que la regla de validación 8 se cumple. Es una decisión del autor: la nota de 4a del documento dice que más de 90 s no muestra diferencia apreciable, y conviene reflejar la nueva fila de "compuestos pesados" en `docs/reglas-entrenamiento.md`.

### Verificación
- `npm test`: 24 archivos y 288 tests sin errores (282 anteriores y 6 nuevos en `generator.test.ts`). Las 17 reglas de validación pasan en las 50.400 encuestas.
- `npm run build` sin errores. `npm run lint` solo muestra las advertencias de `Date.now` que ya existían en `Session.tsx` y `Today.tsx`.
- **No** se probó en el celular (390 px): el cambio es solo del motor, pero conviene generar un plan nuevo y revisar los descansos antes de subir a `main`.

### Decisiones y lo que no se hizo
- **Un solo ejercicio de gemelos por día**: no se hizo. La regla 5 limita cada ejercicio a 4 series, y con más de 1 año de experiencia el mínimo de 10 series semanales no se alcanzaría con dos sesiones de pierna. Pierna B puede traer dos ejercicios de gemelos.
- **Superseries** de laterales con curl o de face pull con tríceps: el motor no las permite (solo pares antagonistas de 8b).
- **Pendientes**: semanas 1–2 de adaptación con una serie menos por ejercicio, subida de volumen cada 2 semanas y última serie de aislamientos en máquina a RIR 1 desde la semana 5, que ya estaban en la lista de pendientes de v0.5.

---

## v0.5 · Motor de reglas (2026-11-08)

Alcance: reemplazo del generador de rutinas por un motor basado en `docs/reglas-entrenamiento.md` (rama `motor-reglas`, 4 commits). La revisión anterior (2026-10-29) está más abajo como historial.

### Qué cambió
- **Motor nuevo** en `src/engine/` (lógica pura): `rules.ts` (las tablas como datos), `targets.ts` (contexto por encuesta y edad), `generator.ts`, `coverage.ts`, `duration.ts`, `validate.ts` y `notice.ts`. Ya no existen las plantillas fijas ni `maxExercisesFor`.
- **12 músculos**: "hombro" se dividió en hombro anterior, lateral y posterior, y se agregó core. Biblioteca con patrón de movimiento, conteo fraccional (tabla 1b), core (dead bug, pallof press, bird dog, crunch en polea, planchas), deltoides posterior (face pull, pájaros) y lo que faltaba por equipo (pull-through, pullover, curl femoral con mancuerna). Ningún id anterior se eliminó.
- **Datos guardados**: formato versión 2. Los ejercicios propios con "hombro" pasan a hombro lateral; todo lo demás queda igual. Se guarda una copia intacta en `gainlab:v1:pre-v2` antes de la primera migración.
- **Interfaz**: aviso de versión reducida o insuficiente en el onboarding y en Ajustes (con +1 día / +15 min de un toque cuando llegan a un plan completo), botón "Revisar cobertura" para cualquier plan, ajuste del tope de días de fuerza, esfuerzo objetivo y superseries en la sesión.
- **Planes existentes**: no cambian. Solo los planes del motor nuevo (marcados con `plan.engine`) muestran el aviso por sí solos.

### Verificación
- `npm run build` y `npm test` sin errores: 282 tests en 24 archivos.
- **Las 17 reglas de validación** pasan en las 50.400 combinaciones de la encuesta: 4 objetivos × 3 experiencias × 7 edades × 5 días × 5 duraciones × 3 equipos × 8 combinaciones de molestias. La regla 17 (determinismo) se comprueba en 1 de cada 4.
- `validate.test.ts` rompe a propósito un plan válido para comprobar que cada regla detecta su infracción.
- **Migración** probada con datos reales de v0.4, generados ejecutando el código anterior: perfil, plan, 8 sesiones, notas, ajustes, 3 ejercicios propios y una sesión abierta.
- **Cobertura** del motor nuevo: 95–100 % de líneas y 89–95 % de ramas.
- **Prueba en celular (390 px)** sobre el build de producción: onboarding completo, plan reducido 2 × 30, plan completo 4 × 60, una sesión de 7 ejercicios guardada y una superserie que alterna sola. Sin errores de consola ni desborde horizontal.

### Tabla 9c (hipertrofia, < 1 año, gimnasio)

| Días | 30 | 45 | 60 | 75 | 90 |
|---|---|---|---|---|---|
| 2 | Reducido | Reducido | Reducido | Reducido | Reducido |
| 3 | Reducido | Reducido | **Completo** (doc: reducido al límite) | Completo | Completo |
| 4–6 | Reducido | **Completo** (doc: reducido) | Completo | Completo | Completo |

20 de 25 celdas coinciden. Las 5 diferencias son las que la nota de 9c anticipa: con los recortes de 8a, 3 × 60 y 4 × 45 pueden pasar a completo.

### Decisiones tomadas (aprobadas en la fase 1)
- **3 días**: cuerpo completo A/B/C en vez del A/B/A alternado.
- **Edad**: `age.ts` no se modificó. `targets.ts` combina sus reglas con la sección 11 y gana la más conservadora:
  - menores de 18: fila "Nuevo", máximo 3 días, sin barra libre ni superseries;
  - 40–49: +15 s de descanso (de `age.ts`);
  - 50–59: +30 s, repeticiones mínimas 6 y volumen inicial en el mínimo;
  - 60–69: repeticiones mínimas 8 (10 si empiezas), RIR ≥ 2, 2–3 series por ejercicio, máximo = valor por defecto de 1a, superseries solo antagonistas en máquina;
  - 70+: +60 s, RIR ≥ 3 si empiezas, sin barra libre ni superseries.
- **Regla 9, límite inferior**: aplica solo a los días que tuvieron que recortarse (no se recorta de más).
- **Rangos de descanso y repeticiones**: se desplazan según la edad. El descanso extra mueve el rango de 4a, y la repetición mínima sube el rango de la tabla 3 conservando su ancho.
- **Series del principal en fuerza**: tope de la tabla 2 (3/3/4), no el 5 de la regla 5.
- **Frecuencia en fuerza**: 3 veces por semana solo en los patrones principales (fuerza, > 1 año, 3 días).
- **Patrones sin ejercicio seguro**: si el equipo y las molestias no dejan ninguno (en casa: tirón vertical, y empuje vertical con molestia de hombro), se omiten y el resumen sugiere consultar a un profesional. Nunca se elige un ejercicio marcado para la molestia.
- **Regla 11**: usa un calendario fijo por cantidad de días (2: lu/ju; 3: lu/mi/vi; 4: lu/ma/ju/vi; 5: lu/ma/mi/vi/sá; 6: lu–sá). Core y gemelos usan 24 h.
- **Proporción tirón:empuje**: series fraccionales de espalda, deltoides posterior y bíceps contra pecho, deltoides anterior y tríceps.
- **Regla 3 en modo reducido**: los músculos con piso 0 que figuran en el aviso quedan exentos de la frecuencia mínima, igual que en las reglas 1, 2 y 9.
- **Modo insuficiente**: aparece solo con 2 días × 30 min (664 de 50.400 encuestas): equipo o molestias muy restrictivos, o los descansos extra por edad. El piso de 9b se completa igual, la sesión dura más de lo elegido y el aviso dice cuánto.
- **Calentamiento general**: puede bajar a 0 minutos (8a permite 0–2), solo como último recurso antes de quitar volumen.
- **Superseries**: solo entre ejercicios de aislamiento. La fórmula 4b ahorra ~40 % frente a hacerlos por separado (el documento estima ~50 %).
- **Botones fácil/justo/al límite**: sus textos de ayuda siguen la columna "RIR que el usuario cree" de 10a (4+, 2–3, 0–1). Antes decían 3+, 1–2 y "ni una más". `progression.ts` no cambió, pero la misma pulsación ahora significa un poco más de margen.

### Pendientes
1. **Semanas de descarga (tabla 10c)**: fuera de alcance; no implementado.
2. **Progresión según la tabla 10b**: `progression.ts` no se tocó. Cambios que haría:
   - Tope del rango + "Fácil": +5 % también en aislamientos (hoy 2 saltos solo en compuestos). La regla de edad sin doble salto sigue ganando.
   - Tope del rango + "Al límite": mantener la carga siempre (hoy sube, salvo menores de 18 y desde los 50).
   - Dentro del rango con "Fácil" 2 sesiones seguidas: +2,5 % (hoy no existe).
   - Bajo el rango: el disparador es ≥ 1 serie y la decisión depende del botón. Solo "Al límite" baja (−5 %); hoy se dispara con más de la mitad de las series y baja −10 % tras 2 sesiones sin mirar el botón.
   - RIR de cada botón para recalibrar: 5/3/1 (+1 con más de 12 reps) según 10a, en vez de 3/1,5/0. `rirFromFeel` ya está en `rules.ts`.
   - Calentamiento: `warmupSets` sugiere hasta 4 series de aproximación con barra y la fórmula 4b estima 1–3, así que la sesión real puede durar algo más que la estimada.
3. **Mayores de 60 (sección 11b)**: equilibrio, potencia y cuestionario de cribado.
4. **Progresión del volumen**: +1 a 2 series por músculo cada 2 semanas (1a) y la regla de 50 a 59 de "4 semanas en el mínimo, luego tabla normal". El motor genera la semana 1.
5. **Recuperación de 72 h para mayores de 70** (11a): con 3 días de cuerpo completo (lu/mi/vi) hay 48 h. Faltaría separar más los días o bajar el volumen por sesión.
6. **Documento de reglas**: los enlaces de ACSM 2026 apuntan a la nota de prensa y la sección 12 pide usar el DOI. Tampoco está en el repositorio: conviene agregarlo en `docs/` para que la referencia de `rules.ts` quede junto al código.
7. **Tiempo de los tests**: la suite tarda ~4 minutos por las 50.400 encuestas. Si molesta en el CI, se puede dejar la versión completa en un script aparte y una muestra en `npm test`.

### Riesgos conocidos
- Los planes antiguos siguen funcionando, pero no tienen RIR objetivo ni superseries hasta que la persona pase a un plan nuevo.
- El aviso y la revisión de cobertura se calculan sobre el plan tal como está. Si alguien edita a mano un plan completo, el aviso puede aparecer.

---

## v0.4 · Revisión de código (2026-10-29)

Alcance: proyecto completo (`src/`, configuración y CI) · Revisores: seguridad, bugs, arquitectura, tests (rendimiento y ML omitidos: es una app solo de cliente, sin backend, BD ni modelos)

> Historial. A1–A3 y M5–M8 están resueltos en el código actual (`persistence.ts`, `ErrorBoundary`, `engine/session.ts`, `progression.branches.test.ts`); el resto no se volvió a revisar en v0.5. Las referencias a `plan.ts` y sus plantillas ya no aplican desde v0.5.

### Resumen
gAInlab está en buen estado para un MVP. El motor de progresión es puro y determinista, está separado de la UI y tiene tests reales, y la app no presenta vulnerabilidades explotables. Los problemas más serios están en la **lógica de progresión**, justo donde la app promete valor:
1. En los planes de fuerza (y en parte en los de pérdida de grasa), los ejercicios que se repiten en dos días con dosis distintas **no suben nunca de peso**.
2. El **modo regreso** se activa en cada rotación si se entrena menos días de los planificados, y baja el peso una y otra vez.
3. Restaurar un respaldo inválido, o que un ejercicio no se encuentre, deja la app **en blanco de forma permanente**: no hay ErrorBoundary y el estado roto queda guardado.

En total: base sólida, pero con dos bugs de progresión que un usuario constante notaría en pocas semanas, y sin red de seguridad ante datos corruptos.

| Severidad | Cantidad |
|---|---|
| 🔴 Crítico | 0 |
| 🟠 Alto | 3 |
| 🟡 Medio | 8 |
| ⚪ Bajo | 14 |

### Prioridades: qué arreglar primero
1. A1: evaluar la última sesión con su propia dosis.
2. A2: medir la pausa como tiempo sin entrenar.
3. A3: ErrorBoundary con salida de emergencia y validación del respaldo.
4. M1 y M2: reglas de progresión que contradicen el README.
5. M8 y M7: tests de regresión para todo lo anterior.

### Hallazgos

#### 🔴 Críticos
Ninguno.

#### 🟠 Altos

##### A1. Un ejercicio repetido en dos días con distinta dosis no progresa nunca
- **Dónde:** `src/engine/progression.ts:185` (`allTop`), `:87-92` (`belowRange`), `:121`; origen en `src/engine/plan.ts:60-98` (Torso A / Torso B, Pierna A / Pierna B)
- **Área:** Bugs
- **Problema:** `prescribe` compara la última sesión del ejercicio con las series y el rango **del día actual**, aunque esa sesión se haya hecho con otra dosis. `buildPlan` elige el mismo ejercicio en dos días con roles distintos: por ejemplo, `pressVertical` es *secundario* en Torso A y *principal* en Torso B, y lo mismo ocurre con `jalon` y con `bisagra` en Pierna A/B. Con objetivo fuerza, esto da 3×6-8 en un día y 4×4-6 en el otro.
  - El día de 4 series nunca llega al tope, porque la sesión anterior tuvo solo 3 (`summary.reps.length >= sets` es falso).
  - El día de 6-8 nunca llega a 8, porque el otro día deja las repeticiones en 6.
  - Traza siguiendo las prescripciones: `Torso B 40 kg 6,6,6,6` → `Torso A 40 kg 7,7,7` → `Torso B 6,6,6,6`… indefinidamente.
- **Por qué importa:** es la promesa central de la app ("tu próximo entrenamiento, ya calculado"). Los usuarios de fuerza con 4-6 días se quedan estancados sin saberlo. También afecta a pérdida de grasa y salud, cuyos rangos principal y secundario difieren.
- **Cómo arreglarlo:** evaluar la sesión anterior con su propia dosis, que ya está guardada en el log (`repMin`/`repMax`, ver `store.ts:217-218`):
  ```ts
  const lastMax = last.log.repMax ?? repMax
  const lastSets = last.log.sets.filter((s) => s.done).length
  const allTop = summary.reps.length >= Math.min(sets, lastSets) && summary.reps.every((r) => r >= lastMax)
  ```
  Otra opción es filtrar `historyFor` a las sesiones con un rango compatible. Además, conviene que `buildPlan` evite repetir un ejercicio con dosis distintas (usar `variant` o sacarlo de `used` entre días). Hay que añadir un test con el plan de fuerza de 4 días.

##### A2. El modo regreso se repite en cada rotación y baja el peso cada vez
- **Dónde:** `src/engine/progression.ts:126-141`
- **Problema:** la pausa se mide **por ejercicio** (`now - last.date` de ese ejercicio), no como tiempo sin entrenar. Además, cada regreso parte del peso ya rebajado. Ejemplo: alguien con un plan de 4 días que entrena 2 veces por semana hace cada día cada 14 días, así que los ejercicios exclusivos de Torso B y Pierna B caen siempre en "regreso". Simulación: `90 → 80 → 70 → 62,5 → 55`. Para mayores de 60 (umbral de 10 días) basta un plan de 5 días hecho 3 veces por semana.
- **Por qué importa:** entrenar menos días de los planificados es lo más habitual, y la app castiga justo a esos usuarios con bajadas acumuladas que nunca recuperan (ver M4). Contradice el README ("desde 10–12 días **sin entrenar**").
- **Cómo arreglarlo:** medir la pausa desde la última sesión de **cualquier** ejercicio, que es la que el usuario entiende como "volver tras una pausa":
  ```ts
  // prescribe recibe lastTrainedAt (fecha de la última sesión del usuario)
  const gapDays = Math.floor((now.getTime() - new Date(lastTrainedAt ?? last.date).getTime()) / DAY_MS)
  ```
  Otra opción es no aplicar el regreso cuando el intervalo del ejercicio coincide con su frecuencia habitual (la media de sus intervalos anteriores).

##### A3. Un respaldo inválido o un ejercicio desconocido deja la app en blanco para siempre
- **Dónde:** `src/screens/SettingsScreen.tsx:42`, `src/store.ts:235-244` y `:47-62`, `src/engine/exercises.ts:176-178`, `src/screens/Today.tsx:22` y `:83`, `src/main.tsx` (sin ErrorBoundary)
- **Área:** Seguridad · Arquitectura · Tests (fusionado de los tres revisores)
- **Problema:** al importar solo se valida `version === 1` y que `sessions` sea un array. `importData` copia todo tal cual y lo **guarda** en localStorage antes de pintar. Si algo no cumple las invariantes, el render lanza una excepción: por ejemplo `plan.days: []` (`nextDay` devuelve `undefined` y falla `suggested.id`), o un `exerciseId` que no existe (`getExercise` lanza). Como no hay ErrorBoundary, la pantalla queda en blanco, y al recargar `load()` lee el mismo estado y vuelve a fallar. Ajustes tampoco es alcanzable, porque renderiza `PlanEditor`, que también usa `getExercise`.
- **Por qué importa:** basta con un respaldo editado a mano, uno de otra versión o una "rutina" compartida por WhatsApp. El usuario tiene que borrar los datos del sitio para volver a usar la app y pierde todo el historial, que la importación ya sobrescribió. El mismo fallo aparecerá si una versión futura renombra un id de la biblioteca.
- **Cómo arreglarlo:**
  1. Añadir un ErrorBoundary en `main.tsx` con dos botones: "Descargar mis datos" (`exportData()`) y "Restaurar copia anterior / Reiniciar".
  2. Antes de sobrescribir en `importData`, guardar el estado anterior en `gainlab:v1:prev`.
  3. Validar el esquema completo en una única función `parseState()` que usen `load` e `importData` (ver M6): `plan.days` no vacío, cada `exerciseId` presente en la biblioteca o en los `customExercises` del archivo, series numéricas y `notes` como `Record<string,string>`.
  4. Hacer que `getExercise` devuelva un ejercicio "desconocido" en vez de lanzar, como ya hacen `Progress.tsx` y `SessionEditor.tsx` con `findExercise`.

#### 🟡 Medios

##### M1. El reajuste por Epley se aplica a cualquier sesión, no solo a la calibración
- **Dónde:** `src/engine/progression.ts:161-183`
- **Área:** Bugs
- **Problema:** la rama `ajuste` no comprueba que sea la primera sesión. Una mala sesión normal (por ejemplo, 100 kg × 10,10,10 y a la semana 100 kg × 5,5,5 "al límite") produce `ajuste 87,5 kg`, un −12,5% de golpe, y se salta la regla documentada "bajo el rango: repite; dos veces seguidas baja 10%".
- **Por qué importa:** un mal día (sueño, enfermedad) provoca una bajada brusca en lugar del "repite" prometido.
- **Cómo arreglarlo:** limitar la rama a `history.length === 1` o a la primera sesión tras un regreso.

##### M2. Subir el peso entre series da "Quedaste bajo el rango"
- **Dónde:** `src/engine/progression.ts:69-73` (`workSummary`) y `:87-92` (`belowRange`)
- **Área:** Bugs
- **Problema:** solo cuentan las series hechas al peso máximo, y las que faltan se rellenan con 0 repeticiones. Una calibración en rampa como 60×12, 70×12, 80×12 da `reps=[12]` → `[12,0,0]` → bajo el rango → "repite 80 kg y apunta a 8", cuando el usuario llegó al tope.
- **Cómo arreglarlo:** en `belowRange`, contar solo las series registradas (`summary.reps`). Si hay menos que `plan.sets`, decidir aparte (por ejemplo, "mantener").

##### M3. La racha de semanas no pasa de 8
- **Dónde:** `src/screens/Progress.tsx:188-212`
- **Área:** Bugs · Tests
- **Problema:** `weekStreak` recorre solo las 8 semanas del gráfico (`WEEKS = 8`). Con 20 semanas seguidas cumplidas, la app muestra "8".
- **Cómo arreglarlo:** calcular la racha recorriendo `sessions` hacia atrás semana a semana hasta la primera que no se cumplió, con independencia del gráfico. Moverla a `format.ts` y testearla (lunes/domingo, cambio de año).

##### M4. "Recuperarás el peso en pocas sesiones" no se cumple
- **Dónde:** `src/engine/progression.ts:139` y `:205-260`
- **Área:** Bugs
- **Problema:** después del regreso sigue la doble progresión normal. Volver de 70 a 100 kg con saltos de 2,5 y rango 8-12 lleva decenas de sesiones. Combinado con A2, el usuario nunca recupera su peso.
- **Cómo arreglarlo:** guardar el peso previo a la pausa (`last.log` anterior al regreso) y, mientras no se recupere, subir de peso en cada sesión completada dentro del rango.

##### M5. Los fallos de guardado son silenciosos y un JSON corrupto se sobrescribe
- **Dónde:** `src/store.ts:47-62` (`load`), `:68-74` (`persist`), `src/screens/Session.tsx:326-332`
- **Área:** Bugs · Arquitectura
- **Problema:**
  - Si el JSON guardado no se puede parsear, `load()` arranca vacío y el primer `set()` sobrescribe la copia original.
  - Si `setItem` falla (cuota llena, Safari en modo privado), el `catch {}` lo ignora: la sesión parece guardada y desaparece al reabrir.
  - Cada cambio de peso serializa el estado completo N veces (una llamada a `updateSet` por serie). Hoy no es un problema, pero lo será con la dieta de v2.
- **Cómo arreglarlo:** en `load`, si el parseo falla, copiar el valor crudo a `gainlab:v1:corrupt` antes de seguir. Exponer un flag `persistError` y mostrar un banner. Aplicar los cambios de peso en un solo parche (`updateSets`).

##### M6. El estado guardado no tiene versionado ni migraciones
- **Dónde:** `src/store.ts:26-62`, `:235-244`; `src/screens/SettingsScreen.tsx:41-42`
- **Área:** Arquitectura (el revisor lo marcó como alto; se baja a medio porque no falla hoy)
- **Problema:** `version: 1` es un literal que nadie lee. La normalización está copiada en `load` e `importData`, las copias ya divergieron (solo una borra `active`) y la validación vive en la pantalla. Con v2 (dieta) y v3, cada cambio de esquema obligará a parchear tres sitios.
- **Cómo arreglarlo:** crear un módulo `persistence.ts` con `CURRENT_VERSION`, migraciones encadenadas (`migrations[n](state) → state`) y un `parseState()` único (sirve también para A3), con un test por migración.

##### M7. La lógica de sesiones e historial vive en el store y no tiene tests
- **Dónde:** `src/store.ts:129-135`, `:146-155`, `:193-233`, `:251-270`
- **Área:** Tests · Arquitectura
- **Problema:** las reglas que deciden qué entra al historial no tienen tests: qué series se guardan, el filtro `reps > 0`, que una sesión editada vacía se borre, la calibración con reps en 0 y la rotación de `nextDay`. Esa última vuelve al día 1 si la última sesión fue de un día que ya no existe. El "recálculo tras editar el historial" del README depende de todo esto. Además, el store lee localStorage al importarse, así que no se puede testear sin trucos.
- **Cómo arreglarlo:** extraer funciones puras a `engine/session.ts` (`toSession(active)`, `cleanEdited(session)`, `nextDay`) y testearlas. Añadir un `store.test.ts` con un localStorage en memoria (`vi.stubGlobal` + `vi.resetModules`) que compruebe que editar una sesión cambia la siguiente prescripción.

##### M8. Ramas de `prescribe` sin probar y aserciones débiles
- **Dónde:** `src/engine/progression.test.ts` (por ejemplo, `:31-35`, `:44-47`, `:73-74`)
- **Área:** Tests
- **Problema:**
  - Hay ramas sin tests: peso corporal (`:143-159`), ajuste hacia abajo, factores 0,9/0,7 del regreso, piso de un incremento, series en rampa (`workSummary`), incrementos de mancuerna/máquina, ejercicios repetidos entre días y el borde de `returnAfterDays` (se calcula en ms, así que 14 días pueden contar como 13 según la hora).
  - Varios tests solo comprueban `weight > 40` o no miran el modo ni las reps. A1, A2, M1 y M2 viven justo en esas ramas.
- **Cómo arreglarlo:** fijar valores exactos (por ejemplo, `52.5` y `[9,9,9]` en `:73`) y añadir un test por rama, incluido uno de varias sesiones que simule la rotación del plan de fuerza de 4 días.

#### ⚪ Bajos
- **B1.** `progression.ts:131, 171, 226`: `Math.max(step, …)` puede **subir** el peso en "bajar" o "regreso" cuando la carga es menor que el salto (1 kg con salto de 2 → 2 kg). Usar `Math.min(w, Math.max(step, …))`.
- **B2.** `progression.ts:132-139`: el mensaje dice "Llevas 1 semanas" con pausas de 10 a 13 días. Hablar en días por debajo de 14 o pluralizar.
- **B3.** `SessionEditor.tsx:86` y `store.ts:194-197`: al editar el historial se pueden guardar series con 0 kg en ejercicios con carga. Desde entonces el ejercicio se trata como peso corporal y el regreso no se aplica. Exigir `weight > 0` si el tipo no es `corporal`.
- **B4.** `exercises.ts:165-169`: `registerCustomExercises` borra antes de mapear. Si `customExercises` trae un `null`, lanza a mitad de camino y deja `BY_ID` sin los ejercicios propios hasta recargar. Construir primero la lista nueva y después reemplazar.
- **B5.** `.github/workflows/deploy.yml:8-11, 21-41`: `pages: write` e `id-token: write` están a nivel de workflow, así que también los recibe el job `build`, que ejecuta código de dependencias. Además, las actions están referenciadas por tag mutable. Mover esos permisos al job `deploy` y fijar las actions por SHA.
- **B6.** `Today.tsx:84` y `store.ts:253`: `prescribe(…, settings, new Date(), age)` se arma por separado en dos sitios. Si alguno cambia, lo que muestra "Hoy" dejará de coincidir con la sesión. Crear un selector único `prescriptionFor(state, planEx)`.
- **B7.** `exercises.ts:135-174`: el registro global mutable de ejercicios propios hace que el motor "puro" dependa del orden de llamadas, y que los tests compartan estado.
- **B8.** `ExerciseEditor.tsx:60`: la UI filtra los avisos con `w.startsWith('Es el único')`, así que cambiar la redacción de `swap.ts:92` rompe el filtro en silencio. Usar avisos con `code`.
- **B9.** Hay duplicación que ya divergió: las opciones de "cómo se sintió" en `Session.tsx:436-441` y `SessionEditor.tsx:9-13` usan textos distintos para la misma entrada de la progresión. También se repiten la fila de historial (`Today.tsx:145` / `Progress.tsx:166`), el selector de edad, `formatKg` frente a `kg` y el formato m:ss, y `Sheet` vive dentro de `ExercisePicker.tsx`.
- **B10.** `App.tsx:46-50`: `onFinished` deduce la sesión guardada leyendo el último elemento de `sessions`. Si no se guardó nada (un día sin ejercicios), el banner muestra la sesión anterior. Hacer que `finishSession()` devuelva la `Session`.
- **B11.** `SettingsScreen.tsx:208`: la versión "0.4" está hardcodeada. Inyectarla desde `package.json` con `define` en `vite.config.ts`.
- **B12.** `package.json`: no hay proveedor de cobertura, umbral en CI ni entorno DOM para testear componentes.
- **B13.** `format.ts:11-19`: no tiene tests, y `relativeDay` con una fecha futura devuelve "Hace -1 días".
- **B14.** `swap.test.ts:17`, `planEdit.test.ts:35, 70, 76-83`, `age.test.ts:94`: los tests dependen de posiciones exactas del plan generado, y el registro global se limpia al final del test en vez de en `afterEach`.

### Lo que está bien hecho
- **Motor puro y determinista**: `prescribe`, `buildPlan` y `planEdit` no tienen efectos secundarios y reciben `now` por parámetro, así que son fáciles de testear y de razonar.
- **Reglas por edad en tablas** (`age.ts`), no repartidas en condicionales por todo el código.
- **Seguridad sin hallazgos explotables**: no hay `innerHTML`, `dangerouslySetInnerHTML` ni `eval`. El texto del usuario se muestra como JSX escapado, no hay secretos en el repo ni en el historial de git, y todas las dependencias tienen `integrity`.
- **La sesión activa se persiste**, así que sobrevive a cerrar la PWA a mitad del entrenamiento.
- **Los tests son reales**: ninguno está vacío, oculta fallos con try/catch ni mockea lo que debería probar, y la CI los ejecuta antes de publicar.

### Estado de los tests (en esa fecha)
- 33 casos en 4 archivos (`progression` 17, `age` 9, `planEdit` 5, `swap` 7).
- No se ejecutaron en esa revisión: no había `node_modules`. El revisor de tests recalculó a mano los valores esperados de `prescribe` y coincidían con la implementación.
- Cobertura no medida en ese momento.
