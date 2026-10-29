// Conexión a Supabase. Si queda vacío, la app corre en MODO DEMO
// (datos inventados guardados en el navegador).
// Estos dos valores son públicos por diseño: la seguridad la ponen las
// reglas de la base (supabase/schema.sql), no esconder la clave.
window.ITC_CONFIG = {
  supabaseUrl: "",      // ej: "https://abcdxyz.supabase.co"
  supabaseAnonKey: "",  // Supabase → Project Settings → API → anon public
};
