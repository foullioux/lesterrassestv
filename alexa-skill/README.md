# Claude por voz en Alexa

Esto te permite hablar con Claude en tu Echo (o cualquier dispositivo Alexa) diciendo, por
ejemplo: **"Alexa, abre asistente Claude"** y luego **"pregunta a Claude cuál es la capital de
Francia"**.

Todo el código ya está listo en este repositorio (`alexa-skill/`). Lo que falta son pasos que
**solo tú puedes hacer**, porque requieren iniciar sesión con tus propias cuentas (Anthropic,
Amazon y AWS) — yo no tengo acceso a esas consolas. Aquí tienes la guía completa, de principio a
fin. Tardarás unos 15-20 minutos la primera vez.

No hace falta publicar la skill en la tienda de Alexa: al crearla con la misma cuenta de Amazon
que usas en tu Echo, aparece automáticamente disponible en tus dispositivos en modo "desarrollo".

---

## 1. Crea tu clave de la API de Claude

1. Ve a https://console.anthropic.com y crea una cuenta (o inicia sesión).
2. En el menú, ve a **Settings → API Keys**.
3. Pulsa **Create Key**, dale un nombre (p. ej. `alexa-skill`) y cópiala. Solo se muestra una vez.
4. Guárdala en un sitio seguro, la necesitarás en el paso 4.

## 2. Crea tu cuenta de Amazon Developer

1. Ve a https://developer.amazon.com/alexa/console/ask e inicia sesión con la **misma cuenta de
   Amazon que usas en tu Echo/app Alexa** (importante, si no la skill no te aparecerá en tu
   dispositivo).
2. Es gratis, no hace falta tarjeta de crédito para skills privadas de desarrollo.

## 3. Crea tu cuenta de AWS (para alojar el "cerebro" de la skill)

1. Ve a https://aws.amazon.com y crea una cuenta gratuita si no tienes una.
2. La capa gratuita de AWS Lambda cubre este uso personal de sobra (miles de peticiones gratis al
   mes).

## 4. Crea la función Lambda

1. En la consola de AWS, entra en **Lambda** (asegúrate de estar en una región compatible con
   Alexa, p. ej. `us-east-1` (N. Virginia) o `eu-west-1` (Irlanda)).
2. **Crear función → Crear desde cero**.
   - Nombre: `claude-alexa-skill`
   - Runtime: **Node.js 20.x**
   - Arquitectura: `x86_64` (por defecto)
3. Una vez creada, abre la pestaña **Código** y sustituye todo el contenido de `index.js` por el
   contenido de [`lambda/index.js`](./lambda/index.js) de este repositorio. Pulsa **Deploy**.
4. Ve a **Configuración → Variables de entorno → Editar → Añadir variable de entorno**:
   - `ANTHROPIC_API_KEY` = la clave que copiaste en el paso 1.
   - (Opcional) `CLAUDE_MODEL` = `claude-sonnet-5` (ya es el valor por defecto).
5. Ve a **Configuración → Configuración general → Editar** y sube el **Tiempo de espera (timeout)**
   a 15 segundos (por defecto son 3, y las respuestas de Claude pueden tardar más).
6. Copia el **ARN** de la función, arriba a la derecha (algo como
   `arn:aws:lambda:us-east-1:123456789012:function:claude-alexa-skill`). Lo necesitarás en el
   paso 5.

## 5. Crea la skill en Alexa Developer Console

1. En https://developer.amazon.com/alexa/console/ask, pulsa **Create Skill**.
2. Nombre: `Claude`. Idioma por defecto: **Español (ES)**.
3. Tipo de modelo: **Custom**. Método de alojamiento: **Provision your own**. Crea la skill.
4. En el menú izquierdo, entra en **Interaction Model → JSON Editor**.
5. Borra el contenido y pega el de
   [`interactionModels/custom/es-ES.json`](./interactionModels/custom/es-ES.json) de este
   repositorio. Pulsa **Save Model** y luego **Build Model** (tarda ~1 minuto).
6. Ve a **Endpoint** (menú izquierdo). Selecciona **AWS Lambda ARN** y pega el ARN que copiaste en
   el paso 4.6. Guarda.
7. Vuelve a **Build Model** si te lo pide.

### Conectar el enlace de seguridad (Lambda ⇄ Skill)

1. En Alexa Developer Console, copia el **Skill ID** (aparece arriba, en la pestaña
   **Endpoint** o en los ajustes de la skill; empieza por `amzn1.ask.skill...`).
2. En AWS Lambda, abre tu función → pestaña **Configuración → Disparadores → Añadir disparador**
   → elige **Alexa Skills Kit** → pega el Skill ID en "Skill ID Verification" → Añadir.
3. (Opcional pero recomendado) En la función Lambda, añade también la variable de entorno
   `SKILL_ID` con ese mismo valor: el código ya la usa para rechazar peticiones que no vengan de
   tu skill.

## 6. Pruébalo

1. En Alexa Developer Console, ve a la pestaña **Test** y activa "Development" (arriba a la
   derecha).
2. Escribe o di: `abre asistente claude`, y luego: `pregunta a claude cuál es la capital de
   Francia`.
3. Si todo va bien, verás/oirás la respuesta de Claude.
4. Como usaste la misma cuenta de Amazon que en tu Echo, ya puedes probarlo directamente en tu
   dispositivo físico diciendo: **"Alexa, abre asistente Claude"**.

---

## Notas

- **Conversación con memoria**: la skill recuerda el hilo de la conversación mientras la sesión de
  Alexa siga abierta (unos segundos de silencio la cierran). Cada respuesta termina preguntando
  "¿algo más?" para mantener la sesión activa.
- **Cambiar el nombre de invocación**: puedes cambiar `"asistente claude"` en el JSON del modelo
  de interacción por lo que prefieras (p. ej. `"pregunta a claude"`), siempre que cumpla las
  reglas de Amazon (2+ palabras si no es un nombre ya aprobado).
- **Coste**: solo pagas lo que consumas de la API de Claude (por token) y, en la práctica, nada de
  AWS Lambda (capa gratuita). Puedes ver tu consumo en https://console.anthropic.com/settings/usage.
- **Inglés**: si prefieres usarlo en inglés, usa
  [`interactionModels/custom/en-US.json`](./interactionModels/custom/en-US.json) como idioma
  adicional o principal de la skill, y cambia la variable de entorno `SYSTEM_PROMPT` en Lambda
  para que Claude responda en inglés.
- **Seguridad**: no compartas tu `ANTHROPIC_API_KEY` ni la subas a ningún repositorio público;
  aquí solo vive como variable de entorno en tu Lambda privada.
