# Irusta Training Club 🤜⚡️🤛

La app del ITC: turnos, buen día, rutinas, pesos y pagos. Juan entra como admin y los alumnos como usuarios, desde el celular.

- **App:** web instalable (PWA) + **app de Android** + **app de iPhone** (Capacitor). Las tres usan el mismo código.
- **Web:** se publica gratis con GitHub Pages. Las apps nativas cargan esa web, así que **cada push actualiza todas las apps** sin reinstalar.
- **Base de datos y login:** [Supabase](https://supabase.com), plan gratis. Alcanza de sobra para 60 alumnos.
- **Costo:** $0.

Mientras `config.js` esté vacío, la app corre en **modo demo**, con alumnos inventados guardados en el navegador. Sirve para mostrarla sin tocar datos reales.

---

## Seguridad: cómo funciona

| Quién | Qué puede hacer |
|---|---|
| Alguien que no está en la lista | Nada. Entra con Google, pero ve “Todavía no estás en la lista”. |
| Alumno (su email está cargado y activo) | Ve **solo lo suyo**: rutina, pesos, clases y pagos. Responde el buen día, anota sus pesos, pide horario y avisa que pagó. |
| Admin (Juan) | Ve y edita todo: alumnos, turnos, cobros, ajustes. |

- El login es **un click**: “Entrar con Google”. No hay contraseñas ni códigos, y la sesión queda abierta en el celular.
- Las reglas viven **en la base de datos** (Row Level Security en `schema.sql`), no en la app. Aunque alguien toque el código, la base no le devuelve datos ajenos.
- Para sacar a alguien: **Alumnos → su ficha → Dar de baja**. Pierde el acceso en el momento.
- Los admins se agregan **solo** desde el SQL Editor de Supabase, nunca desde la app.

---

## Puesta en marcha (una sola vez, ~30 min)

### 1. Supabase (base de datos)
1. Creá una cuenta en https://supabase.com y después un proyecto nuevo (región: **São Paulo**). Guardá la contraseña que te pide.
2. Andá a **SQL Editor → New query**, pegá todo el contenido de `schema.sql` y tocá **Run**.
3. En el mismo editor, cargá los admins (el email de Google de Juan y el tuyo):
   ```sql
   insert into public.admins (email) values ('email-de-juan@gmail.com'), ('tu-email@gmail.com')
   on conflict do nothing;
   ```
4. Andá a **Project Settings → API** y copiá **Project URL** y la clave **anon public**.

### 2. Conectar la app
Editá `config.js` en GitHub (el ícono del lápiz), pegá los dos valores y hacé commit:
```js
window.ITC_CONFIG = {
  supabaseUrl: "https://xxxxx.supabase.co",
  supabaseAnonKey: "eyJhbGciOi...",
};
```
La clave `anon` es pública por diseño. La seguridad la ponen las reglas de la base.

### 3. Publicar (GitHub Pages)
1. En el repo: **Settings → Pages → Source: Deploy from a branch → `main` / `(root)` → Save**.
2. En 1 o 2 minutos la app queda en `https://hopwoodthomas-max.github.io/Irusta-training-Club/`.
3. GitHub Pages gratis necesita que el repo sea **público**. No pasa nada: en el repo no hay datos de alumnos, que viven en Supabase.

### 4. Login con Google
1. Entrá a https://console.cloud.google.com y creá un proyecto (“Irusta Training Club”).
2. **APIs y servicios → Pantalla de consentimiento OAuth**: elegí *Externo*, nombre “Irusta Training Club”, tu email de soporte, guardar. Después tocá **Publicar app**. Si queda en “Prueba”, solo pueden entrar 100 usuarios que cargues a mano.
3. **Credenciales → Crear credenciales → ID de cliente OAuth → Aplicación web**.
   - *URI de redireccionamiento autorizados:* `https://xxxxx.supabase.co/auth/v1/callback` (tu Project URL + `/auth/v1/callback`).
4. Copiá el **Client ID** y el **Client secret**.
5. En Supabase: **Authentication → Sign In / Providers → Google → Enable**, pegá los dos valores y guardá.
6. En Supabase: **Authentication → URL Configuration**:
   - *Site URL:* `https://hopwoodthomas-max.github.io/Irusta-training-Club/`
   - *Redirect URLs:* agregá la misma dirección.

### 5. Cargar los alumnos
Juan entra con su Google y va a **Alumnos → Carga rápida**. Pega una línea por alumno:
```
Nombre; celular; email; veces por semana; días; hora
Lucía Pérez; 11 2345 6789; lucia@gmail.com; 3; lun mie vie; 08:00
Martín Gómez; 11 3456 7890; martin@gmail.com; 2; mar jue; 18:00
```
- El **email** tiene que ser el de la cuenta de Google con la que el alumno va a entrar.
- El **celular** va con código de área, sin 0 ni 15. Con eso se arman los links de WhatsApp.
- Después se puede sumar, editar, dar de baja o borrar a cualquiera desde **Alumnos**.

### 6. Apps de Android y iPhone

**Antes que nada:** en Supabase → Authentication → URL Configuration → *Redirect URLs*, agregá también `ar.irusta.trainingclub://auth`. Es el link con el que la app vuelve después del login con Google.

**Android (gratis)**
1. En cada cambio de `native/`, `package.json` o `capacitor.config.json`, la pestaña **Actions → App Android** compila el APK. También la podés correr a mano con *Run workflow*.
2. Para pasarla por link: creá un tag (`git tag v1.1 && git push --tags`) y se publica en **Releases** con el archivo `ITC-android.apk`.
3. En el celular: abrir el APK → permitir “instalar apps de esta fuente” → Instalar.
4. *(Opcional)* Para que futuras versiones del APK se instalen encima sin desinstalar, cargá una firma fija en los *Secrets* del repo: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`. Igual casi nunca hace falta reinstalar, porque el contenido se actualiza solo.
5. *(Opcional, USD 25 una sola vez)* Publicarla en Google Play.

**iPhone**
- **Gratis:** desde Safari, abrir el link → Compartir → “Agregar a inicio”. Queda con ícono y en pantalla completa.
- **App nativa:** Apple exige la cuenta **Apple Developer (USD 99/año)**, incluso para TestFlight. El workflow **App iOS** ya compila el proyecto en cada cambio para tenerlo listo. Con la cuenta:
  1. En una Mac: `npm install && npm run ios:add && npx cap open ios`.
  2. En Xcode: elegir el *Team* (la cuenta), Product → Archive → Distribute → **TestFlight** (privado, hasta 10.000 personas por link) o App Store.
  - Ojo: para la App Store, Apple a veces rechaza apps que “solo muestran una web”. Para un club privado, **TestFlight** es el camino simple.

### 7. Pasarle la app a los alumnos
Mandá el link al grupo. Cada uno lo abre, toca “Entrar con Google” y lo agrega a la pantalla de inicio:
- iPhone: Compartir → “Agregar a inicio”.
- Android: menú ⋮ → “Instalar app”.

---

## WhatsApp (v1)
La app **arma** cada mensaje (buen día, recordatorio de pago, suspensión, lluvia) y Juan lo manda con un toque: se abre WhatsApp con el texto listo. No tiene costo ni necesita aprobación de Meta. El buen día lleva el link de la app para que el alumno confirme con un botón.

Para automatizarlo más adelante se usa la API oficial de WhatsApp Business: plantillas aprobadas, costo por mensaje y solo mensajes uno a uno.

## Desarrollo de las apps nativas (en una compu)
```bash
npm install
npm run android:add   # crea android/ con el deep link
npm run icons         # íconos y splash
npx cap open android  # abre Android Studio
```
`android/` e `ios/` no se suben al repo: se generan en cada compilación.

## Mantenimiento
- **Supabase gratis se pausa si pasa 7 días sin uso.** El workflow `.github/workflows/keepalive.yml` le da un toque cada 3 días. Activalo en la pestaña **Actions** del repo si GitHub lo pide.
- **Versiones:** cada commit en `main` publica una versión nueva. Para marcar una versión estable: `git tag v1.0 && git push --tags`.
- **Backup:** Supabase → Database → Backups. También podés exportar cada tabla a CSV desde Table Editor.

## Estructura
```
capacitor.config.json  app nativa (id: ar.irusta.trainingclub, carga la web publicada)
native/                página sin conexión, íconos, splash y scripts del deep link
.github/workflows/     android.yml (APK), ios.yml (compilación iOS), keepalive.yml
index.html           pantalla base + mascota
styles.css           estilo (hierro, río, celeste y sol)
config.js            conexión a Supabase (vacío = demo)
app.js               pantallas de Juan y de los alumnos
data.js              conexión a la base (y modo demo)
routines.js          biblioteca de rutinas y abdominales
schema.sql           tablas + reglas de seguridad
logo.jpg, icon-*.png logo e íconos (todo en la raíz: se puede subir desde la web)
sw.js, manifest      para instalarla como app
```

## Próximos pasos
- Que Juan edite la biblioteca de ejercicios desde la app.
- Buen día automático (WhatsApp Business API + tarea programada en Supabase).
- Sábados de recupero con inscripción desde la app.
