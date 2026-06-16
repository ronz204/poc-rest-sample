# Internet, Redes y Arquitectura Cliente-Servidor

## Arquitectura Cliente-Servidor

Es el modelo fundamental sobre el que funciona casi toda la web. Define dos roles bien separados que se comunican a través de una red.

```
Cliente                        Servidor
   │                               │
   │──── request (solicitud) ─────▶│
   │                               │  procesa
   │◀─── response (respuesta) ─────│
```

**Cliente:** cualquier dispositivo o programa que *inicia* la comunicación y *consume* un servicio. Tu navegador, una app móvil, un script que hace llamadas a una API — todos son clientes.

**Servidor:** el programa que *espera* solicitudes, las procesa y devuelve una respuesta. No inicia la comunicación; reacciona a ella.

---

### Características del modelo

**Sin estado por defecto (Stateless)**

Cada request es independiente. El servidor no recuerda la solicitud anterior. Si necesitás persistir información entre requests (sesión, usuario logueado), eso se maneja explícitamente con cookies, tokens o sesiones en base de datos — no es algo que el protocolo garantice solo.

**Asimetría de roles**

El cliente y el servidor no son intercambiables. El cliente siempre inicia, el servidor siempre responde. Esto cambia con WebSockets, donde el servidor puede empujar datos al cliente sin que este lo pida, pero incluso ahí el cliente es quien inicia la conexión.

**Un servidor, muchos clientes**

Un servidor atiende miles de clientes simultáneamente. La escala se maneja con técnicas como load balancing (distribuir carga entre varios servidores) y caching (guardar respuestas frecuentes para no procesarlas siempre).

---

### Capas del modelo en la práctica

En un sistema real el modelo no es un simple par cliente-servidor sino una cadena:

```
Navegador ──▶ CDN ──▶ Load Balancer ──▶ API Gateway ──▶ Microservicio
  (cliente)                                              (servidor final)
```

Cada salto es un par cliente-servidor propio. El CDN es cliente del Load Balancer, el API Gateway es cliente del microservicio. El concepto se aplica en cascada.

---

## Internet, Intranet y Extranet

Tres tipos de red construidos sobre la misma tecnología (TCP/IP, HTTP, DNS), pero con diferente alcance, propósito y nivel de acceso.

---

### Internet

La red pública global. Cualquier dispositivo con conexión puede acceder a cualquier servidor público, sin importar ubicación ni organización.

```
usuario A (Costa Rica)
        \
         ──── [internet] ──── servidor (Irlanda)
        /
usuario B (Japón)
```

No tiene dueño central. Es una red de redes: miles de ISPs, datacenters y proveedores interconectados bajo protocolos comunes. La coordinación de direcciones IP y nombres de dominio la gestiona ICANN.

| Aspecto | Detalle |
|---|---|
| **Acceso** | Público, sin restricción de origen |
| **Seguridad** | Baja por defecto; depende de cada servicio (HTTPS, auth, firewalls) |
| **Propósito** | Comunicación y servicios globales |
| **Alcance** | Mundial |
| **Ejemplos** | Cualquier sitio web, API pública, correo, streaming |

---

### Intranet

Red privada interna de una organización. Usa exactamente la misma tecnología que internet (navegadores, HTTP, DNS interno) pero está aislada del mundo exterior. Solo acceden empleados o dispositivos autorizados.

```
[firewall / VPN]
       │
  ─────┼───────────────────────────
  │    │     RED INTERNA           │
  │  PC 1   PC 2   Servidor HR    │
  │         Portal interno         │
  ─────────────────────────────────
         (intranet)
```

Desde afuera de la organización no se puede llegar a estos recursos directamente. Si un empleado trabaja remoto, necesita **VPN** para "entrar" a la red interna y acceder como si estuviera físicamente en la oficina.

| Aspecto | Detalle |
|---|---|
| **Acceso** | Solo empleados / dispositivos autorizados |
| **Seguridad** | Alta; aislada del exterior por firewall |
| **Propósito** | Herramientas y datos internos de la organización |
| **Alcance** | Local (una empresa, campus, institución) |
| **Ejemplos** | Portal de RRHH, documentación interna, sistemas ERP, repositorios privados |

---

### Extranet

Extensión controlada de una intranet hacia socios externos específicos. No es pública como internet, pero tampoco es exclusivamente interna. Es el punto medio: acceso selectivo para terceros de confianza.

```
          [internet]
               │
    ┌──────────┼──────────────┐
    │     EXTRANET            │
    │  (acceso controlado)    │
    │   proveedor A ──┐       │
    │   cliente B  ──▶│ zona  │
    │                 │ dmz   │──▶ intranet
    └─────────────────┴───────┘
```

La zona de extranet típicamente vive en una **DMZ (Demilitarized Zone)**: una red intermedia separada de la intranet real por un segundo firewall. Los socios llegan hasta la DMZ, nunca a los sistemas internos directamente.

| Aspecto | Detalle |
|---|---|
| **Acceso** | Externo pero restringido a socios, clientes o proveedores con credenciales |
| **Seguridad** | Media-alta; autenticación obligatoria, permisos acotados |
| **Propósito** | Colaboración con terceros de confianza sin exponer la red interna |
| **Alcance** | Organizaciones relacionadas |
| **Ejemplos** | Portal de proveedores, acceso de clientes a su facturación, APIs B2B |

---

## Comparativa

| | **Internet** | **Intranet** | **Extranet** |
|---|---|---|---|
| **Quién accede** | Cualquiera | Solo empleados | Socios autorizados |
| **Visibilidad** | Pública | Privada | Semi-privada |
| **Seguridad** | Baja por defecto | Alta | Media-alta |
| **Alcance** | Global | Organización | Organizaciones relacionadas |
| **Acceso remoto** | Directo | Requiere VPN | Credenciales / VPN |
| **Ejemplo típico** | google.com | Portal RRHH interno | Portal de proveedores |

---

## Cómo se relacionan

No son tecnologías distintas sino capas de acceso sobre la misma infraestructura:

```
┌─────────────────────────────────────────┐
│              INTERNET                   │  acceso público global
│  ┌───────────────────────────────────┐  │
│  │           EXTRANET                │  │  acceso controlado a socios
│  │  ┌─────────────────────────────┐  │  │
│  │  │         INTRANET            │  │  │  acceso solo interno
│  │  │   servidores, datos, apps   │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

Una empresa puede tener las tres simultáneamente: su sitio público en internet, su ERP en la intranet, y un portal de proveedores en la extranet — todo corriendo sobre TCP/IP y HTTP, diferenciados solo por firewall, autenticación y control de acceso.