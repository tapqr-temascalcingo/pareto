# Pareto interactivo · Restaurante Burguer

Diagrama de Pareto del **principal problema** reportado por clientes en la encuesta de calidad del servicio.
Sitio 100 % estático (HTML + CSS + JS, sin librerías ni internet).

## Abrirlo en tu compu
- Doble clic en `index.html`, o
- En VS Code: extensión **Live Server** → clic derecho en `index.html` → *Open with Live Server*.

## Publicarlo en GitHub Pages
1. Crea un repositorio nuevo en GitHub (por ejemplo `pareto-burguer`), **público**.
2. Sube el contenido de esta carpeta (no la carpeta en sí): `index.html` debe quedar en la raíz.
   Desde la terminal de VS Code:
   ```bash
   git init
   git add .
   git commit -m "Pareto interactivo"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/pareto-burguer.git
   git push -u origin main
   ```
3. En GitHub: **Settings → Pages → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**.
4. En 1–2 minutos queda en `https://TU-USUARIO.github.io/pareto-burguer/`.

> ⚠ El sitio es público: `js/datos.js` incluye edad, género, ocupación y lugar de residencia de cada respuesta (sin nombres).

## Estructura
```
index.html            página
css/estilos.css       diseño (colores en :root)
js/datos.js           las 53 respuestas ya limpias
js/app.js             cálculos, gráfica, filtros, detalle e interpretación
herramientas/limpiar.py  regenera js/datos.js desde el Excel
```

## Reglas de cálculo
- Se excluye “No experimenté ningún problema”.
- La pregunta 1 permitía varias opciones: **la primera marcada es la causa principal** (cada persona cuenta una vez). Las demás aparecen en “Causas secundarias” y no se suman.
- Causas vitales: las que, en orden, llegan hasta el primer % acumulado ≥ 80 %.
- Empates: orden alfabético. Redondeo: 1 decimal.
- La página verifica sola que la suma de barras = total y que el último acumulado = 100 %.

## Cambiar cosas
- Colores: variables `--vital`, `--resto`, `--linea` en `css/estilos.css`.
- Filtros, columnas del detalle y nombres cortos: objeto `CONFIG` al inicio de `js/app.js`.
- Regenerar datos (requiere Python + openpyxl):
  `python herramientas/limpiar.py "Restaurante Burguer.xlsx" js/datos.js`
