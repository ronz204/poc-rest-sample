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
| **Handshake latencia** | TCP + TLS separados | TCP + TLS separados | 1 RTT combinado |

---

## Convivencia

Las versiones no se reemplazan de golpe. Un servidor moderno negocia con el cliente cuál usar:

```
Cliente "Accept: h3, h2, http/1.1"  ──▶ Servidor elige la mejor versión soportada
```

Google, Meta y Netflix ya sirven la mayor parte de su tráfico en HTTP/3, con fallback automático a HTTP/2 y 1.1 para clientes más antiguos.