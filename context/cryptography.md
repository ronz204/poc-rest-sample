# Criptografía y TLS

## Cifrado Simétrico

Una sola clave secreta cifra **y** descifra el mensaje. Quien la tenga puede leer todo.

| Aspecto | Detalle |
|---|---|
| Clave | Única, compartida entre ambas partes |
| Velocidad | Muy rápida (GBs/s sin problema) |
| Algoritmos | AES, ChaCha20 |
| Problema | ¿Cómo se entrega la clave de forma segura? |

Si la clave viaja por internet y alguien la intercepta, la seguridad colapsa.

---

## Cifrado Asimétrico

Cada parte genera un **par de claves matemáticamente vinculadas**:

- **Clave pública** → se distribuye libremente. Cualquiera puede cifrar con ella.
- **Clave privada** → secreta, nunca sale del dueño. Es la única que descifra.

Analogía: la clave pública es un candado abierto que repartes. Alguien mete un mensaje en una caja, le pone tu candado y lo cierra. Ni siquiera quien cerró el candado puede volver a abrirlo. Solo tú, con tu clave privada, puedes.

| Aspecto | Detalle |
|---|---|
| Claves | Par: pública + privada |
| Velocidad | Lenta (costosa computacionalmente) |
| Algoritmos | RSA, ECC (Curvas Elípticas) |
| Ventaja | Resuelve la distribución segura de claves |

---

## TLS: Cifrado Híbrido

**TLS (Transport Layer Security)** existe porque ninguno de los dos esquemas anteriores es suficiente por sí solo:

- Simétrico solo → no hay forma segura de compartir la clave inicial.
- Asimétrico solo → demasiado lento para cifrar streaming, videos, sesiones largas.

La solución: usar asimétrico **una sola vez** para ponerse de acuerdo en una clave, y luego cambiar a simétrico para todo lo demás.

### El problema que TLS resuelve primero

Imagina que querés hablar en secreto con `banco.com`. El problema no es cifrar la conversación, sino **cómo acordar una contraseña compartida sin que nadie la intercepte en el camino**. Si la mandás por internet sin cifrar, cualquier nodo intermedio la puede leer.

TLS resuelve esto en dos fases bien separadas.

---

### Fase 1 — Handshake (negociación segura de la clave)

El objetivo de esta fase es que cliente y servidor lleguen a tener la misma **clave de sesión** sin haberla enviado nunca en texto claro por internet.

**Paso 1: el servidor se identifica**

El servidor envía su **certificado digital**. Ese certificado contiene su **clave pública** y está firmado por una autoridad de confianza (más sobre esto en la sección siguiente). El cliente lo verifica antes de continuar.

**Paso 2: el cliente propone un secreto**

El cliente genera un número aleatorio — el futuro material de la clave de sesión — y lo **cifra con la clave pública del servidor**. Lo manda por internet. Un atacante que intercepte esto solo ve datos cifrados inútiles, porque descifrarlos requiere la clave privada del servidor, que nunca salió del servidor.

**Paso 3: el servidor descifra**

El servidor usa su **clave privada** para descifrar el mensaje y obtener el secreto que propuso el cliente. Ahora los dos tienen el mismo material y ambos derivan de él la misma **clave de sesión simétrica**. Esa clave nunca viajó por internet en ningún momento.

```
internet (puede estar interceptado)
─────────────────────────────────────────────────────────

cliente                                          servidor
  │                                                  │
  │  recibe certificado + clave pública ◀─────────── │
  │  verifica que es legítimo                        │
  │                                                  │
  │  genera secreto aleatorio                        │
  │  lo cifra con la clave pública del servidor      │
  │  ────────── [secreto cifrado] ──────────────────▶│
  │                        descifra con clave privada│
  │                                                  │
  │  ambos derivan la misma clave de sesión          │
  │  (nunca viajó en claro por la red)               │

─────────────────────────────────────────────────────────
```

---

### Fase 2 — Sesión (todo el tráfico real)

Una vez que ambos tienen la clave de sesión, cambian de modo. A partir de este punto todo se cifra con **AES o ChaCha20** (simétrico), que es miles de veces más rápido que RSA.

```
cliente ══════ AES/ChaCha20 (clave de sesión) ══════ servidor
               contraseñas, datos, archivos, todo
```

Cuando cerrás la pestaña o expira la sesión, **la clave se destruye**. La próxima conexión genera una clave completamente nueva. Esto se llama **Perfect Forward Secrecy**: aunque alguien grabe el tráfico hoy y consiga la clave privada del servidor mañana, no puede descifrar sesiones pasadas porque las claves de sesión ya no existen.

---

### Resumen visual

| Aspecto | FASE 1 — Handshake | FASE 2 — Sesión |
|---|---|---|
| **Frecuencia** | Una sola vez al conectar | Todo el tiempo que dure la conexión |
| **Algoritmo** | RSA / ECC | AES / ChaCha20 |
| **Propósito** | Acordar clave de sesión | Cifrar los datos reales |
| **Velocidad** | Lenta, no importa | Muy rápida, importa mucho |

> **TLS 1.3 / HTTP/3:** El handshake se redujo a **1 RTT** (un viaje de ida y vuelta). En versiones anteriores eran 2 RTT. En HTTP/3, la negociación ocurre simultáneamente con la conexión de red, por lo que el costo es prácticamente cero.

---

## Referencias

Para conocer cómo se garantiza la autenticidad del servidor en el handshake, consulta [Certificados Digitales](certificates.md).