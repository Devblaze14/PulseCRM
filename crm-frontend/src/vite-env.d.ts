/// <reference types="vite/client" />

// Typed access to the env vars we use (VITE_API_URL).
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
