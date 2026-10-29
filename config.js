// Conexión a Supabase. Si queda vacío, la app corre en MODO DEMO
// (datos inventados guardados en el navegador).
// Estos dos valores son públicos por diseño: la seguridad la ponen las
// reglas de la base (schema.sql), no esconder la clave.
window.ITC_CONFIG = {
  supabaseUrl: "https://hwypwoodknnunuqovjgr.supabase.co",
  supabaseAnonKey: "sb_publishable_kmoaFzWg4AfiVLpD63_7OQ_hmuFsWzD",
};
