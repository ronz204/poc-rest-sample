# Protocolo HTTP: Métodos y Códigos

## Métodos HTTP

Los métodos definen **la intención semántica** del cliente sobre un recurso. Técnicamente podrías hacer cualquier cosa con cualquier método, pero la industria y los estándares REST establecen reglas que todos respetan.

| Método | Semántica | Body | Idempotente |
|---|---|---|---|
| `GET` | Leer/consultar un recurso | No | Sí |
| `POST` | Crear un recurso nuevo | Sí | No |
| `PUT` | Reemplazar un recurso completo | Sí | Sí |
| `PATCH` | Modificar campos específicos | Sí | No* |
| `DELETE` | Eliminar un recurso | No | Sí |
| `OPTIONS` | Consultar capacidades del servidor | No | Sí |
| `HEAD` | Igual que GET pero sin body en la respuesta | No | Sí |

> **Idempotente:** hacer la misma petición N veces produce el mismo resultado que hacerla una sola vez. `DELETE /users/5` dos veces → el usuario ya no existe en ambos casos.
>
> *`PATCH` puede o no ser idempotente según la implementación.

---

## OPTIONS y CORS

`OPTIONS` es el método más incomprendido. No lee ni escribe datos: **pregunta qué está permitido** en un endpoint concreto.

### Por qué existe: el Preflight de CORS

**CORS (Cross-Origin Resource Sharing)** es una política de seguridad que impide que un script de `malicioso.com` haga requests a `mibanco.com` sin permiso explícito del servidor.

Cuando un navegador detecta un request cross-origin "no trivial" (con métodos como DELETE o headers personalizados), **lo congela** y primero envía un `OPTIONS` automático:

```
Navegador                              mibanco.com/api/cuenta
    │                                        │
    │── OPTIONS (Preflight) ───────────────▶ │
    │   Origin: malicioso.com                │
    │   Access-Control-Request-Method: DELETE│
    │                                        │
    │ ◀── 200 OK (o 403) ────────────────── │
    │   Access-Control-Allow-Origin: (lista) │
    │                                        │
    │  [si el origen está permitido]         │
    │── DELETE (request real) ─────────────▶ │
    │  [si no está permitido, se bloquea]    │
```

El servidor responde con headers `Access-Control-*` que le dicen al navegador qué orígenes, métodos y headers acepta. Si el origen no está en la lista, el navegador bloquea el request real sin que llegue al servidor.

**El servidor nunca ve el `DELETE` si el Preflight falla.**

### Headers CORS relevantes

| Header (respuesta) | Ejemplo |
|---|---|
| `Access-Control-Allow-Origin` | `https://miaplicacion.com` o `*` |
| `Access-Control-Allow-Methods` | `GET, POST, DELETE` |
| `Access-Control-Allow-Headers` | `Content-Type, Authorization` |
| `Access-Control-Max-Age` | `86400` (cachea el preflight 24h) |

---

## Códigos de Estado

El servidor siempre responde con un número de 3 dígitos. El primer dígito indica la categoría.

### 1xx — Informacional

Raramente vistos en desarrollo web cotidiano.

| Código | Significado |
|---|---|
| `100 Continue` | El servidor recibió los headers iniciales; el cliente puede seguir enviando el body. |
| `101 Switching Protocols` | El servidor acepta cambiar de protocolo (ej. upgrade a WebSocket). |

---

### 2xx — Éxito

| Código | Significado | Uso típico |
|---|---|---|
| `200 OK` | Petición exitosa con body en respuesta. | GET exitoso |
| `201 Created` | Se creó un recurso nuevo. | POST exitoso |
| `204 No Content` | Éxito sin body en respuesta. | DELETE, respuesta a OPTIONS |

---

### 3xx — Redirección

| Código | Significado | Uso típico |
|---|---|---|
| `301 Moved Permanently` | El recurso cambió de URL para siempre. El navegador sigue la nueva URL y actualiza bookmarks. | Migración de dominio, HTTP → HTTPS |
| `302 Found` | Redirección temporal. | Mantener la URL original, pero servir desde otra por ahora |
| `304 Not Modified` | El recurso no cambió desde la última vez. El cliente usa su caché. | Optimización de ancho de banda |

---

### 4xx — Error del cliente

El cliente envió algo incorrecto.

| Código | Significado |
|---|---|
| `400 Bad Request` | El body o los parámetros están mal formateados (JSON inválido, campos faltantes). |
| `401 Unauthorized` | No autenticado. "No sé quién sos, iniciá sesión." |
| `403 Forbidden` | Autenticado, pero sin permisos. "Sé quién sos, pero no podés entrar acá." |
| `404 Not Found` | El recurso (URL) no existe en el servidor. |
| `405 Method Not Allowed` | El método no está permitido en ese endpoint. |
| `409 Conflict` | El estado actual del recurso entra en conflicto con el request (ej. crear un usuario con email ya existente). |
| `422 Unprocessable Entity` | Sintaxis válida, pero los datos no pasan validación de negocio. |
| `429 Too Many Requests` | Rate limiting: el cliente superó el límite de peticiones. |

> **401 vs 403:** El 401 significa "no sé quién sos" (falta autenticación). El 403 significa "sé quién sos y no te lo permito" (falta autorización). Son errores distintos con soluciones distintas.

---

### 5xx — Error del servidor

El cliente lo hizo bien; el problema está del lado del servidor.

| Código | Significado |
|---|---|
| `500 Internal Server Error` | El código del backend hizo crash. Excepción no capturada, bug, etc. |
| `502 Bad Gateway` | El proxy o balanceador recibió una respuesta inválida del servidor upstream. |
| `503 Service Unavailable` | El servidor está sobrecargado o en mantenimiento. Temporal. |
| `504 Gateway Timeout` | El proxy no recibió respuesta del servidor upstream a tiempo. |