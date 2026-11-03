# CoreAdmin conectado

El panel usa la misma API Node.js de la tienda. En producción crea
`.env.production` a partir de `.env.production.example` y configura
`VITE_API_URL` con la URL pública del backend, sin `/api` al final.

Las páginas **Incidencias** y **Agente IA** ya no usan datos de demostración:
leen las solicitudes de soporte guardadas por la tienda, lanzan el workflow de
n8n mediante el backend y registran la aprobación o el rechazo del administrador.

```bash
npm ci
npm run build
```

Publica el contenido de `dist` y añade su origen a `FRONTEND_ORIGIN` en Render.

# Notas de la plantilla React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
