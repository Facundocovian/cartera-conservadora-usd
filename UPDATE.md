# Actualización semanal de datos (viernes)

Sitio: https://cartera-conservadora-usd.vercel.app (conservadora: `/`, moderada: `/moderada.html`).
Vercel redeploya solo con cada push a `main`. Los archivos de datos son `data.js` (conservadora) y `data2.js` (moderada).

## Qué hay que traer (todo de la plataforma de asesores de Balanz, con Chrome logueado)
1. **NAV diario de los 5 fondos** (valor cuotaparte, ej. 1,0123). Página de cada fondo:
   `https://users.balanz.com/asesores/detalleinstrumento?fondo=BSHORT.` (short), `BINCOME.` (income), `BLATAM.` (latam),
   `BBALANCED.` (balanced), `BGLOBALE.` (global). En la página, con javascript_tool:
   `AmCharts.charts.find(c=>(c.dataProvider||[]).length>100).dataProvider.map(x=>x.dataContext)` → campos `fecha`, `valorcuotaparte`.
   Tomar los días posteriores al último dato cargado (el último índice de `nav[fondo]` es `start + len-1` días).
2. **Cierre MEP (USD, líneas "D") de las 3 ON y los 2 ETP**: PLC5D, TTCDD, YMCXD (ON) y SPYD, QQQD (CEDEAR/ETP).
   Se leen del gráfico TradingView de cada instrumento pasando el mouse (hover) sobre la última vela (leyenda OHLC, usar el Close).
   No hacer click ni scroll sobre el gráfico si se va a usar el buscador (el gráfico lo interpreta).
3. Si desde la última corrida pasó un **fin de mes** (último día hábil), hace falta además el cierre de ese día para ON y ETP
   (hover sobre esa fecha) y se lo pasa en `month_ends`.

## Cómo aplicarlo
1. Armar `update.json` (formato en el docstring de `tools/apply_update.py`) con `asof` = fecha del último dato (normalmente el viernes
   o el último día hábil), los NAV nuevos y los precios.
2. `python3 tools/apply_update.py update.json` (edita `data.js` y `data2.js`; falla si falta algún precio; mueve a `coupons` los flujos ya cobrados).
3. Verificar: abrir `index.html` y `moderada.html` con Playwright (sin errores de consola; el valor total no debe moverse de forma absurda
   respecto de la semana anterior: > ±3% en una semana → revisar los datos antes de publicar).
4. Commit a `main` y push. No subir `update.json`.

## Límites conocidos
- Los flujos futuros de cupones (`flows`) están cargados solo hasta nov-2027 (teóricos, fuente Puentenet); cuando se agoten hay que cargar más a mano.
- Si falla el login de Balanz o Chrome no está conectado: NO actualizar nada y avisar.
- Las ON y fondos son fijos; cambiar la composición requiere tocar los motores (`engine.js`, `engine2.js`).
