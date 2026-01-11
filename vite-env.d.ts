/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_DOC_MANUAL_URL: string;
  readonly VITE_DOC_ABOUT_URL: string;
  readonly VITE_LIMIT_TRIAL: string;
  readonly VITE_LIMIT_LICENSED: string;
  readonly VITE_LIMIT_PREMIUM: string;
  readonly VITE_LIMIT_ADMIN: string;
  readonly VITE_LIMIT_RES_TRIAL: string;
  readonly VITE_LIMIT_RES_LICENSED: string;
  readonly VITE_LIMIT_RES_PREMIUM: string;
  readonly VITE_LIMIT_RES_ADMIN: string;
  readonly VITE_LIMIT_CLOUD_TRIAL: string;
  readonly VITE_LIMIT_CLOUD_LICENSED: string;
  readonly VITE_LIMIT_CLOUD_PREMIUM: string;
  readonly VITE_LIMIT_CLOUD_ADMIN: string;
  readonly VITE_FEATURE_ROLES_EXPORT: string;
  readonly VITE_FEATURE_ROLES_PRINT: string;
  readonly VITE_FEATURE_ROLES_CLOUD_SAVE: string;
  readonly VITE_FEATURE_ROLES_CLOUD_LOAD: string;
  readonly VITE_ENABLE_CLOUD_FEATURES: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}


declare module 'react' {
  export = React;
  export as namespace React;
}

declare module 'react-dom/client' {
  import React from 'react';
  export interface Root {
    render(children: React.ReactNode): void;
    unmount(): void;
  }
  export function createRoot(container: Element | DocumentFragment): Root;
}

declare module 'html2canvas';
declare module 'jspdf';
