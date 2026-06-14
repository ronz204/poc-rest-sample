# Redes: DNS y TCP

## DNS — El sistema de nombres

Las computadoras se comunican por IPs (`142.250.190.46`), no por nombres (`google.com`). DNS traduce entre los dos mundos. Es una **base de datos jerárquica y distribuida**: ningún servidor tiene toda la información, pero todos saben a quién preguntarle.

---

### Jerarquía DNS (árbol invertido)

```
                        . (raíz)
                       / \
                    .com  .org  .cr  ...   ← TLD
                   /    \
            google.com  tuweb.com          ← Dominios
                              \
                         sub.tuweb.com     ← Subdominios
```

Las consultas se resuelven **de derecha a izquierda**: primero la raíz, luego el TLD, luego el dominio.

#### Nivel 1 — Root Servers (`.`)

- Existen **13 direcciones IP lógicas** (A–M), pero cientos de servidores físicos reales gracias a **Anycast** (múltiples máquinas comparten la misma IP; el tráfico va al más cercano).
- No saben la IP de ningún sitio. Solo saben quién gestiona cada TLD.

#### Nivel 2 — TLD Servers

- **gTLD** (genéricos): `.com`, `.org`, `.net`, `.edu`
- **ccTLD** (países): `.cr`, `.mx`, `.es`, `.jp`
- No saben la IP de tu sitio. Saben en qué registrar compraste el dominio y te dirigen a sus nameservers.

#### Nivel 3 — Authoritative Nameservers

- Los nameservers del registrar (ej. `ns1.hostinger.com`). Son los que **tú configuras**.
- Tienen la respuesta final: la zona DNS con todos tus registros.

---

### Flujo de resolución completo

```
Navegador
  │
  ├─(caché local? → fin)
  │
  ▼
DNS Resolver (ISP / 8.8.8.8)
  │
  ├─(caché del resolver? → fin)
  │
  ├──▶ Root Server: "¿tuweb.com?"
  │       └─▶ "No sé, ve al TLD .com"
  │
  ├──▶ TLD Server (.com): "¿tuweb.com?"
  │       └─▶ "No sé la IP, ve a los nameservers de Hostinger"
  │
  └──▶ Authoritative NS (Hostinger): "¿tuweb.com?"
          └─▶ "IP: 185.182.56.12" ──▶ Resolver ──▶ Navegador
```

El Resolver guarda la respuesta en caché durante el tiempo que indica el **TTL**.

---

### Registros DNS

| Registro | Función |
|---|---|
| **A** | Nombre → IPv4 (`tuweb.com` → `185.182.56.12`) |
| **AAAA** | Nombre → IPv6 |
| **CNAME** | Alias → otro nombre (`www.tuweb.com` → `tuweb.com`). Útil para subdominios; si cambia la IP del A, el CNAME se actualiza solo. |
| **MX** | Gestión de correo. Define los servidores de email del dominio. |
| **TXT** | Texto libre. Verificación de propiedad (Google Search Console), antispam (SPF, DKIM). |
| **NS** | Indica cuáles son los nameservers autoritativos del dominio. |

> **TTL (Time To Live):** tiempo en segundos que los resolvers del mundo pueden cachear un registro antes de volver a consultar. Si cambias una IP y el TTL era 14400 (4h), el cambio puede tardar hasta 4h en propagarse globalmente.
>
> Truco: antes de migrar un dominio, baja el TTL a 300 (5 min) con anticipación.

---

## TCP — 3-Way Handshake

Una vez que DNS resolvió la IP, el navegador necesita **establecer una conexión confiable** antes de enviar cualquier dato HTTP. TCP lo logra sincronizando números de secuencia entre cliente y servidor.

### El apretón de manos

```
Cliente                            Servidor
  │                                   │
  │──── SYN (seq=X) ────────────────▶ │   "Quiero conectar, mi seq inicial es X"
  │                                   │
  │ ◀── SYN-ACK (seq=Y, ack=X+1) ─── │   "OK, recibí X. Mi seq es Y"
  │                                   │
  │──── ACK (ack=Y+1) ──────────────▶ │   "Recibí Y. Conexión lista"
  │                                   │
  │══════════ HTTP request ══════════▶│
```

**¿Por qué 3 pasos y no 2?**

Con 2 pasos el cliente sabe que el servidor lo escucha, pero el servidor no sabe si el cliente recibió su respuesta (el canal de retorno puede estar roto). El tercer paso confirma que **ambos canales, ida y vuelta, funcionan**.

### ¿Por qué HTTP/3 elimina esto?

QUIC sobre UDP rediseña el handshake combinándolo con TLS 1.3 en **1 RTT**. No hay un 3-way handshake TCP separado; la conexión y la negociación de seguridad ocurren al mismo tiempo.

---

## Secuencia completa al escribir una URL

```
1. DNS lookup       → obtiene la IP del servidor
2. TCP 3-Way HS     → establece conexión confiable (HTTP/1.1 y 2)
3. TLS Handshake    → negocia cifrado (si es HTTPS)
4. HTTP Request     → GET /index.html
5. HTTP Response    → 200 OK + contenido
```

Con HTTP/3 los pasos 2, 3 y el inicio de 4 ocurren en el mismo viaje.