# Certificados Digitales

## Por qué existen

En el handshake TLS, el servidor te manda su **clave pública** para que puedas cifrar un secreto que solo él pueda descifrar. Pero surge una pregunta legítima: **¿cómo sabés que esa clave realmente pertenece a `banco.com` y no a un atacante que se interpuso en la conexión?**

Sin ningún mecanismo de verificación, un atacante podría interceptar la conexión y entregar su propia clave pública haciéndose pasar por el servidor. Vos creerías que hablás con el banco, pero en realidad el atacante descifra todo lo que mandás, lo reenvía al banco real y nadie se da cuenta. Esto se llama **ataque Man-in-the-Middle (MitM)**.

Los certificados digitales cortan este ataque de raíz mediante un sistema de verificación matemática y de confianza.

---

## Qué es un certificado

Un certificado es un archivo (formato X.509) que contiene:

- El **dominio** al que pertenece (`banco.com`)
- La **clave pública** del servidor
- La **fecha de expiración**
- La **firma digital** de una Autoridad Certificadora

La firma es la parte clave: es matemáticamente imposible falsificarla sin tener la clave privada de la CA. El navegador verifica esa firma antes de aceptar el certificado. Si la firma es válida, significa que una autoridad de confianza verificó que esa clave pertenece realmente a ese dominio.

---

## Autoridades Certificadoras (CA)

Una **CA (Certificate Authority)** es una organización de confianza cuya única función es:

1. Verificar que quien solicita un certificado para `banco.com` realmente controla ese dominio
2. Firmar ese certificado con su propia clave privada
3. Mantener un registro público de qué certificados ha emitido

Tu sistema operativo y tu navegador vienen con una lista de CAs en las que confían de fábrica (en Windows: *Administrador de certificados*, en Chrome: *Settings → Security → Manage certificates*). Si un certificado está firmado por alguna de esas CAs, el navegador lo acepta. Si no, muestra el aviso de "conexión no segura".

---

## Let's Encrypt — La CA gratuita

**Let's Encrypt** es la CA que probablemente hayas visto. Es una organización sin fines de lucro creada en 2014 con el objetivo de hacer que HTTPS fuera gratuito y accesible para todo el mundo.

Antes de Let's Encrypt, un certificado TLS costaba entre $50 y $300 por año, lo que dejaba a sitios pequeños sin HTTPS. Hoy la mayoría de los hostings (incluyendo Hostinger) lo integran con un clic.

### Cómo verifica que sos dueño del dominio

Let's Encrypt usa el protocolo **ACME** para hacer una prueba automática llamada *challenge*. Las más comunes:

- **HTTP-01:** Let's Encrypt te pide que coloques un archivo específico en `http://tudominio.com/.well-known/acme-challenge/[token]`. Si puede descargarlo, confirma que controlás el servidor.
- **DNS-01:** Let's Encrypt te pide que agregues un registro TXT específico en tu zona DNS. Si puede leerlo, confirma que controlás el dominio.

Una vez superado el challenge, emite el certificado en segundos. También lo **renueva automáticamente** cada 90 días (los certificados de Let's Encrypt tienen validez de 90 días por diseño, para forzar rotación frecuente).

---

## La cadena de confianza

Las CAs no operan solas. Existe una jerarquía de certificados:

```
Root CA (CA Raíz)
  └── Intermediate CA (CA Intermedia)
        └── Certificado de tu dominio
```

- Las **Root CAs** son las de máxima confianza. Sus claves privadas están en hardware físico desconectado de internet, en bóvedas con acceso restringido. Casi nunca firman certificados directamente.
- Las **Intermediate CAs** son las que firman los certificados del día a día. Si una intermedia se compromete, se puede revocar sin tocar la raíz.
- Tu **certificado** lo firma una CA intermedia, que a su vez está firmada por la raíz. El navegador sigue esa cadena hasta llegar a una raíz que conoce.

Let's Encrypt opera como CA intermedia, firmada por **ISRG Root X1** (su propia raíz, aceptada por todos los navegadores modernos desde 2021).

---

## Tipos de certificados

| Tipo | Validación | Uso típico |
|---|---|---|
| **DV (Domain Validation)** | Solo verifica control del dominio | Blogs, apps, APIs — el candado verde de siempre |
| **OV (Organization Validation)** | Verifica dominio + organización real | Sitios corporativos |
| **EV (Extended Validation)** | Proceso manual exhaustivo | Bancos, gobierno — antes mostraban el nombre de la empresa en verde en la barra |
| **Wildcard** | Cubre `*.tudominio.com` (todos los subdominios) | Útil cuando tenés muchos subdominios |

Let's Encrypt emite certificados **DV** y soporta **Wildcard** vía DNS-01.

---

## Relacionado

Para entender cómo se usa el certificado durante el handshake TLS, consulta [Criptografía y TLS](cryptography.md).
