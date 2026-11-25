import { defineConfig } from "vite";
import { resolve } from "node:path";

// Sitio multipágina: tienda + panel /admin (cada ruta es un index.html real, sirve en cualquier hosting estático).
const page = (p) => resolve(import.meta.dirname, p);
export default defineConfig({
  build: {
    target: "es2022", // el panel usa await de nivel superior
    rollupOptions: {
      input: {
        tienda: page("index.html"),
        admin: page("admin/index.html"),
        login: page("admin/login/index.html"),
        productos: page("admin/productos/index.html"),
        editar: page("admin/productos/editar/index.html"),
        categorias: page("admin/categorias/index.html"),
        textos: page("admin/textos/index.html"),
      },
    },
  },
});
