# Evolución de HTTP

El hilo conductor de toda la historia es un problema: **HOL Blocking** (*Head-of-Line Blocking*). Cuando un elemento lento o un paquete perdido frena a todo lo que viene detrás, la web se siente lenta. Cada versión de HTTP atacó este problema en una capa diferente.

---

## HTTP/1.1 — 1997 · La web secuencial

### Qué introdujo
- **Keep-Alive (conexiones persistentes):** antes de esto, HTTP/1.0 abría y cerraba una conexión TCP por cada recurso. HTTP/1.1 permite reutilizar la misma conexión para múltiples recursos.

### El problema
La conexión persistente era **estrictamente secuencial**: HTML → imagen → CSS, uno después de otro. Una imagen pesada bloqueaba el CSS aunque fueran independientes.

HOL Blocking a nivel de **aplicación**.

### El parche de la industria
Los navegadores empezaron a abrir **hasta 6 conexiones TCP paralelas** al mismo servidor como workaround. Funcionaba, pero era ineficiente y desperdiciaba recursos.

---

## HTTP/2 — 2015 · La web paralela

Nació de SPDY, el experimento de Google para reemplazar HTTP/1.1.

### Qué introdujo

| Característica | Descripción |
|---|---|
| **Multiplexación** | Un solo stream TCP lleva múltiples recursos en paralelo, intercalados como fragmentos (*frames*). Elimina las 6 conexiones paralelas. |
| **Formato binario** | Reemplaza el texto plano de HTTP/1.1. Más eficiente de parsear para máquinas. |
| **Compresión HPACK** | Los headers se repiten en cada request. HPACK los comprime e indexa para ahorrar ancho de banda. |
| **Server Push** | El servidor puede enviar recursos antes de que el cliente los pida (ej. enviar el CSS antes de que el HTML lo solicite). |

### El problema que quedó
HTTP/2 corre sobre **TCP**. TCP es estricto: si un paquete se pierde, **congela toda la conexión** hasta recuperarlo. Con multiplexación, eso significa que 20 recursos en paralelo se frenan por la pérdida de un paquete de uno solo.

HOL Blocking a nivel de **transporte (TCP)**.

---

## HTTP/3 — 2022 · La web móvil

Con la adopción masiva de celulares, Wi-Fi públicas y cambios constantes de antena, la pérdida de paquetes pasó a ser la norma, no la excepción. HTTP/2 sufría mucho en esas condiciones.

### El cambio radical: TCP → QUIC sobre UDP

```
HTTP/1.1  ─── TCP ───────────────────────────────────
HTTP/2    ─── TCP (multiplexación, pero HOL en capa) ─
HTTP/3    ─── QUIC (sobre UDP) ────────────────────────
```

**QUIC** es un protocolo nuevo construido sobre **UDP** que reimplementa las garantías de TCP (entrega ordenada, control de flujo) pero por stream independiente, no por conexión global.

### Qué introdujo

| Característica | Descripción |
|---|---|
| **Sin HOL Blocking** | Si se pierde un paquete de la imagen #5, las otras 19 imágenes siguen descargándose. Solo se pausa el stream afectado. |
| **TLS 1.3 integrado** | La seguridad es parte del protocolo, no una capa encima. Handshake en **1 RTT**: conectar y transferir ocurre en el mismo viaje. |
| **Connection Migration** | Si cambias de Wi-Fi a datos móviles, la conexión no se corta ni se renegocia. QUIC identifica la conexión por un ID, no por IP:puerto. |
| **QPACK** | Reemplaza a HPACK para comprimir headers sin introducir HOL Blocking. |
| **0-RTT** | En reconexiones a servidores ya conocidos, el cliente puede enviar datos en el primer paquete, sin esperar ningún handshake. |

---

### QPACK — La evolución de HPACK

HTTP/2 introdujo **HPACK** para comprimir headers. Funcionaba bien, pero tenía un problema de diseño: usaba una tabla compartida y ordenada entre cliente y servidor. Si un paquete con una actualización de esa tabla se perdía, **todos los streams tenían que esperar** a que se recuperara antes de poder decodificar sus headers. HOL Blocking otra vez, ahora en la capa de compresión.

**QPACK** resuelve esto con una estrategia distinta: separa los headers en dos categorías.

```
Headers estáticos   →  tabla fija predefinida (62 entradas comunes)
                        ej: :method GET, content-type application/json
                        nunca cambian, nunca bloquean

Headers dinámicos   →  tabla dinámica, pero cada stream lleva
                        referencia explícita a qué versión usa
                        si se pierde un paquete, solo ese stream espera
```

El resultado: un stream puede decodificar sus headers incluso si otro stream perdió un paquete y está esperando actualizaciones de la tabla dinámica. Cada stream es completamente independiente.

---

### 0-RTT — Cero viajes de ida y vuelta

En una conexión TLS normal, incluso con TLS 1.3, el primer request requiere al menos **1 RTT** de handshake antes de poder enviar datos. 0-RTT elimina ese costo en reconexiones.

**Cómo funciona:**

La primera vez que te conectás a un servidor, TLS guarda localmente un **Session Ticket**: un token cifrado que el servidor te entrega al final del handshake, que contiene material criptográfico para reanudar la sesión más adelante.

```
Primera conexión (1 RTT normal):

cliente                          servidor
  │── ClientHello ──────────────▶│
  │◀── ServerHello + Session ────│
  │    Ticket                    │
  │── Finished ─────────────────▶│
  │◀══ datos ════════════════════│


Reconexión con 0-RTT:

cliente                          servidor
  │── ClientHello                │
  │   + Session Ticket           │
  │   + datos del request ──────▶│  ← datos viajan en el primer paquete
  │◀══ respuesta ════════════════│
```

El cliente adjunta el Session Ticket y los datos del primer request en el mismo paquete inicial. El servidor puede procesarlo sin ningún intercambio previo.

**La desventaja: Replay Attacks**

0-RTT tiene un problema de seguridad inherente. Si un atacante captura ese primer paquete (ClientHello + datos), puede **reenviarlo** al servidor cuantas veces quiera. El servidor no tiene forma de distinguir si ese paquete lo está enviando el cliente legítimo o un atacante que lo copió.

Por eso, **0-RTT solo es seguro para operaciones idempotentes**: requests que producen el mismo resultado sin importar cuántas veces se ejecuten.

```
✅ seguro con 0-RTT     GET /productos          (leer datos, idempotente)
✅ seguro con 0-RTT     GET /perfil             (leer datos, idempotente)

❌ nunca usar 0-RTT     POST /pago              (crear un cobro, no idempotente)
❌ nunca usar 0-RTT     POST /transferencia     (mover dinero, no idempotente)
```

En la práctica, los servidores bien configurados limitan 0-RTT a GETs y rechazan métodos no idempotentes en ese modo.

---

## Tabla comparativa

| | HTTP/1.1 | HTTP/2 | HTTP/3 |
|---|---|---|---|
| **Año** | 1997 | 2015 | 2022 |
| **Transporte** | TCP | TCP | UDP (QUIC) |
| **Formato** | Texto plano | Binario | Binario |
| **Conexiones por servidor** | Hasta 6 paralelas | 1 | 1 |
| **HOL Blocking** | Sí, aplicación | Sí, transporte | No |
| **TLS** | Opcional | Obligatorio en navegadores | Integrado, obligatorio |
| **Handshake latencia** | TCP + TLS separados | TCP + TLS separados | 1 RTT / 0-RTT en reconexión |
| **Compresión de headers** | Ninguna | HPACK | QPACK (sin HOL Blocking) |

---

## Convivencia

Las versiones no se reemplazan de golpe. Un servidor moderno negocia con el cliente cuál usar:

```
Cliente "Accept: h3, h2, http/1.1"  ──▶ Servidor elige la mejor versión soportada
```

Google, Meta y Netflix ya sirven la mayor parte de su tráfico en HTTP/3, con fallback automático a HTTP/2 y 1.1 para clientes más antiguos.