# Tierras · Cuaderno de arcillas

Web instalable para consultar MAGNA, las materias primas de BDMIN y el suelo estimado de SoilGrids, explorar materiales de interés cerámico, registrar tierras recogidas y seguir sus pruebas de cocción. Esta versión funciona en GitHub Pages y no necesita una cuenta de ChatGPT.

## 1. Subirla a GitHub Pages

La web ya está compilada. Para publicarla **no necesitas instalar Node ni ejecutar comandos**.

1. Descomprime el ZIP.
2. Crea un repositorio **público** en GitHub, por ejemplo `tierras`.
3. Entra en la carpeta descomprimida `tierras-github-pages`. Sube **su contenido** al repositorio: `index.html`, `assets`, `config.js`, iconos y demás archivos. Conserva las carpetas.
4. Comprueba que `index.html` aparece directamente en la raíz del repositorio. No subas solo el ZIP ni dejes la web dentro de otra carpeta.
5. En GitHub abre **Settings → Pages**.
6. En **Build and deployment**, elige **Deploy from a branch**.
7. Selecciona la rama **main** y la carpeta **/(root)**. Pulsa **Save**.
8. Espera a que GitHub publique la página y abre la dirección que aparece en Pages.

Ejemplo: con el usuario `isi1000` y el repositorio `tierras`, la dirección sería `https://isi1000.github.io/tierras/`. Usa siempre la dirección que GitHub te indique, incluida la barra final. Las rutas de la app son relativas y también admiten otro nombre de repositorio o un dominio propio.

Al subir estos archivos, la app empieza en **modo local**.

Si ya publicaste la versión anterior, sustituye los archivos de la web y sus carpetas con los de este ZIP. **Conserva tu `config.js` si ya configuraste Supabase**, y mantén la misma dirección de la app. Esta actualización no cambia el formato del cuaderno. Exporta una copia antes de actualizar y cierra y vuelve a abrir la app para cargar la versión nueva.

## 2. Elegir cómo se guardan los cuadernos

| Característica | Modo local, predeterminado | Modo con cuentas, Supabase |
| --- | --- | --- |
| ¿Se puede usar nada más subirla? | Sí | Requiere la configuración de la sección 3 |
| Cuaderno por persona | Un cuaderno por navegador o app instalada | Un cuaderno por cuenta |
| Inicio de sesión | No | Correo y contraseña |
| Notas, muestras y fotos | Guardadas en IndexedDB, en el dispositivo | Guardadas en la base de datos y el almacenamiento privado |
| Otro móvil u ordenador | Exportar e importar una copia | Entrar con la misma cuenta y actualizar el cuaderno |
| Sin conexión | Fichas, notas, cocciones y fotos, tras abrir la app con conexión una vez | La carga y el guardado necesitan conexión |
| Mapas y consultas MAGNA, BDMIN y SoilGrids | Necesitan conexión | Necesitan conexión |

**El modo local no equivale a una cuenta privada.** Quien use el mismo navegador del mismo dispositivo podrá abrir ese cuaderno. En dispositivos distintos, los cuadernos están separados. Si borras los datos del navegador o de la app, puedes perder el cuaderno local: exporta copias regularmente.

El modo con cuentas aplica restricciones por usuario en la base de datos y mantiene las fotos en un bucket privado. Otros usuarios de la app no pueden leer tus fichas. El administrador del proyecto Supabase puede gestionar los datos; no es cifrado de extremo a extremo.

## 3. Activar cuentas y sincronización

Esta configuración la hace una sola vez el propietario de la web. Después cada persona crea su cuenta desde la app.

### A. Preparar Supabase

1. Entra en [supabase.com](https://supabase.com/) y crea un proyecto para Tierras. Puedes elegir una región europea.
2. En **SQL Editor**, abre una consulta nueva, pega **todo el contenido de `supabase.sql`** y ejecútalo.
3. El script crea `tierras_samples`, sus políticas por usuario y el bucket privado `tierras-photos`. No hagas público el bucket ni desactives las políticas.
4. Desde **Connect** o los ajustes de API, copia la **Project URL** y la **Publishable key**, que comienza por `sb_publishable_`. También se admite la antigua clave `anon`.

Usa un proyecto nuevo dedicado a esta app. El script puede repetirse y conserva las fichas. Una política más amplia añadida manualmente podría alterar la separación de cuadernos.

### B. Configurar las cuentas y los correos

1. En **Authentication → URL Configuration**, pon como **Site URL** la dirección completa de GitHub Pages. Ejemplo: `https://isi1000.github.io/tierras/`.
2. Añade esa misma dirección a **Redirect URLs**. Si vas a usar un dominio propio, añade también su dirección.
3. Mantén habilitado el proveedor **Email**, las nuevas cuentas y la confirmación de correo.
4. Configura **Custom SMTP** en los ajustes de Authentication con tu proveedor de correo. Estos datos se introducen en Supabase, nunca en el repositorio.

El correo predeterminado de Supabase está destinado a pruebas con direcciones autorizadas del equipo. Para que otras personas reciban confirmaciones y recuperen su contraseña, hay que configurar el envío de correos. [Guía oficial de SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

Para una prueba inicial sin enviar correos puedes desactivar temporalmente **Confirm email**. Las cuentas entrarán con contraseña, pero el correo no se verificará y la recuperación seguirá necesitando SMTP. Activa la confirmación y el envío de correos antes de abrir los registros al público.

### C. Conectar la web

Edita **`config.js` de la raíz del repositorio**:

```javascript
window.TIERRAS_CONFIG = {
  supabaseUrl: "https://TU-PROYECTO.supabase.co",
  supabasePublishableKey: "sb_publishable_TU-CLAVE"
};
```

Guarda el cambio en GitHub y espera a que Pages lo publique. No hace falta recompilar. Al recargar, aparecerá el inicio de sesión y cada persona tendrá su propio cuaderno.

La clave publicable está diseñada para aparecer en la web; la protección depende de las políticas del SQL. **Nunca pongas `service_role`, `sb_secret_…`, contraseñas de la base de datos ni credenciales SMTP en `config.js`.**

Si ya tienes un cuaderno local, **exporta una copia antes de cambiar la configuración**. Después entra en tu cuenta e importa esa copia. Cambiar de modo no migra los datos automáticamente.

## 4. Instalarla en iPhone

1. Abre la dirección de GitHub Pages en **Safari**.
2. Pulsa **Compartir → Añadir a pantalla de inicio**.
3. Activa **Abrir como app web** si aparece y pulsa **Añadir**.
4. Abre Tierras desde su icono. En modo con cuentas, inicia sesión ahí.

En modo local, instala la app **antes de comenzar a recoger muestras**: Safari y la app instalada pueden tener almacenamiento separado. Si ya guardaste muestras en Safari, exporta allí una copia e impórtala desde el icono de Tierras.

No se necesita App Store. En Android se puede instalar desde el menú de Chrome.

## 5. Usar el cuaderno

- Toca el mapa para consultar la unidad geológica. En **Capas** puedes activar MAGNA, ajustar su opacidad y cambiar el mapa base entre OpenStreetMap y **ortofotos PNOA del IGN / CNIG**.
- Abre **Explorar** para ver **Dónde buscar**: seis familias de materiales, filtros de pastas, engobes, esmaltes y texturas, un buscador y una primera prueba orientativa para cada material.
- Si has seleccionado un punto, **Qué probar con esta tierra** abre ideas relacionadas con palabras de su litología. Las fichas de muestra también incluyen **Ideas para probar**. Una coincidencia es una pista de la unidad, no la identificación de los minerales de tu muestra.
- Usa el botón de ubicación o selecciona el punto de recogida y pulsa **Recogí tierra aquí**.
- Guarda la muestra con nombre, fecha, descripción en crudo y notas.
- En su ficha añade fotos en crudo y distintas pruebas de cocción, cada una con temperatura, atmósfera, resultado, fotos y notas.
- El mapa ofrece una composición orientativa de la unidad geológica. No calcula un análisis químico de la tierra ni porcentajes de minerales.
- En **Cuaderno → Actualizar cuaderno** puedes cargar los cambios de otro dispositivo y renovar el acceso a las fotografías.

Las fotografías se reducen a un máximo de 1600 píxeles y se guardan en JPEG. Se admiten hasta 60 fotografías y 500 cocciones por muestra. Si un navegador no puede abrir un archivo HEIC, conviértelo a JPEG antes de añadirlo.

### BDMIN y SoilGrids dentro del mapa

En **Capas** puedes activar ambas fuentes. **Explorar** tiene botones **Ver BDMIN en Tierras** y **Ver SoilGrids en Tierras** para abrirlas directamente.

**BDMIN · IGME-CSIC** muestra círculos verdes con las ubicaciones de indicios y explotaciones de materias primas. Están activados al comenzar y se distinguen de los pines de tus muestras. El mapa consulta automáticamente la zona visible cuando te desplazas, a partir del nivel de zoom 8. El filtro permite elegir arcillas y caolines, feldespatos, materiales volcánicos, ocres, carbonatos o sílice, además de todas las materias primas.

Toca un círculo o abre **Ver ubicaciones** para consultar material, municipio, provincia, uso registrado, estado en el inventario y código de referencia, cuando constan en la fuente. Las fichas coincidentes con el mismo material, lugar, uso y estado se agrupan en un punto y se indica su número. **Consultar tierra aquí** selecciona esa ubicación, consulta MAGNA y permite crear una muestra cuando hayas recogido tierra. El inventario puede contener localizaciones aproximadas y datos históricos: confirma la ficha, el acceso y el permiso de recogida. El estado registrado no equivale al estado actual de una explotación.

Cada consulta recupera hasta 1500 fichas. Si hay más o el servicio repite una página, aparece un aviso para acercar el mapa. La lista muestra las primeras 30 ubicaciones filtradas; los círculos del mapa representan todas las recuperadas. Un fallo muestra un error y un botón para reintentar; no se interpreta como una zona sin materias primas.

**SoilGrids · ISRIC** ofrece capas de **arcilla, limo y arena**, a seis profundidades: 0–5, 5–15, 15–30, 30–60, 60–100 y 100–200 cm. Comienza en arcilla a 15–30 cm; puedes cambiar la fracción, la profundidad y la opacidad. MAGNA y SoilGrids se muestran por separado para distinguir sus colores. BDMIN puede aparecer sobre ambas capas y puedes conservar OpenStreetMap o PNOA como base.

Con SoilGrids activo, toca cualquier punto para ver los porcentajes medios estimados de las tres fracciones a la profundidad elegida. La fracción seleccionada incluye además los cuantiles del 5 % y del 95 %, que delimitan el intervalo de predicción del 90 %. Las consultas de cada estadístico se hacen por separado para evitar mezclar los valores que devuelve el servicio. Los datos originales están en g/kg y se dividen entre 10 para mostrarlos en porcentaje: 297 g/kg = 29,7 %. La leyenda de colores conserva sus unidades originales.

Son **estimaciones de tamaños de grano**, con píxeles de 250 m. La fracción arcilla no es un porcentaje de minerales arcillosos ni un ensayo de plasticidad, y no permite deducir una receta de esmalte o una temperatura de maduración. «Sin datos» conserva la ausencia de un valor; un fallo de consulta se indica aparte y permite reintentar. Los valores se consultan en el mapa y no se guardan automáticamente en la ficha de muestra: puedes anotarlos en tus notas con su profundidad y fuente.

Esta integración utiliza el **servicio WMS de ISRIC**, comprobado el 30 de septiembre de 2026. No depende de la API REST beta, que ISRIC indica como pausada en esa fecha. La atribución SoilGrids y su licencia CC BY 4.0 aparecen en el mapa.

### Otros mapas y guía de materiales

En **Explorar → Mapas que complementan MAGNA** también hay enlaces al **Atlas Geoquímico del IGME** y a **Iberpix del IGN / CNIG**. El Atlas permite comparar elementos en suelos y sedimentos; un valor regional no equivale al análisis químico de tu muestra. Las ortofotos PNOA de Iberpix también se pueden activar directamente como base del mapa de Tierras.

Los mapas, las capas y las consultas necesitan internet. La guía de materiales está incluida en la app y se puede leer sin conexión después de la primera carga. No se calculan rankings de lugares, recetas de esmalte ni aptitud alimentaria a partir de estas fuentes.

Las ideas cubren arcillas, ocres, rocas volcánicas, feldespatos, caolín y carbonatos. Cada tarjeta incluye dónde mirar, posibles usos, una prueba, una limitación y una fuente. Registra las mezclas en las notas y los resultados en las cocciones. Usa pequeñas probetas y una bandeja recolectora con materiales que puedan fundir; la temperatura, la atmósfera, el soporte y la preparación influyen en el resultado.

## 6. Copias de seguridad

Abre **Cuaderno → Exportar cuaderno con fotos**. Se descargará un archivo JSON con todas tus fichas y las imágenes incluidas. En iPhone, guárdalo en Archivos.

Para restaurarlo, abre **Cuaderno → Importar una copia**. Se aceptan copias de esta versión de Tierras de menos de 100 MB. La importación añade muestras y conserva las fichas que ya existen. Reimportar la misma copia omite los mismos identificadores; no se utiliza para sobrescribir una ficha modificada.

El modo local valida la copia completa y la importa en una transacción. En la nube, importa por muestra; si se corta la conexión, puede haber una importación parcial. Conserva el archivo original y reintenta para añadir lo que falta.

Una copia incluye ubicaciones, fotos y notas. Quien reciba ese archivo puede leerlas. Las muestras del sitio anterior no están incluidas en este ZIP; no se ha exportado ninguna base de datos personal.

## 7. Editar el código

La carpeta **`codigo-fuente`** contiene el proyecto React + Vite editable. La web de la raíz ya está construida.

Con Node.js 22 o posterior:

```bash
cd codigo-fuente
npm ci
npm run dev
```

Para generar una nueva versión:

```bash
npm run build
```

El resultado aparece en **`codigo-fuente/dist`**. Copia su contenido a la raíz del repositorio de GitHub Pages, sustituyendo la web anterior. Conserva tu `config.js` con la configuración real, o actualiza antes `codigo-fuente/public/config.js` para que la compilación lo incluya. El script genera automáticamente el service worker con los nombres reales de los archivos.

Para ejecutar las comprobaciones de almacenamiento, políticas y respuestas cartográficas:

```bash
npm test
```

Las pruebas de las políticas usan PostgreSQL mediante PGlite, con cuentas y esquemas de prueba. No se conectan a un proyecto Supabase real ni envían correos.

Se han comprobado la compilación, el guardado local con fotos, la restauración de copias, las reglas por usuario en PostgreSQL y la interfaz en Chromium con tamaños de móvil y escritorio. Las pruebas incluyen BDMIN (filtros, fichas, agrupación y errores) y SoilGrids (capas, profundidad, porcentajes, intervalos y reintentos). Se han verificado respuestas reales de BDMIN y SoilGrids con CORS para uso desde GitHub Pages, además de la conversión de unidades de SoilGrids con valores reales de su WMS. La sección Explorar, sus filtros y búsqueda, las ideas por punto y la selección de ortofotos se han comprobado en navegador. También se ha verificado una consulta real a MAGNA con el origen de GitHub Pages y el servicio de imágenes PNOA. La conexión del cliente Supabase se ha probado con respuestas simuladas; el registro, la confirmación de correo y la recuperación requieren verificar tu proyecto configurado. No se ha probado físicamente en un iPhone.

Para repetir las comprobaciones del navegador, instala Chromium con `npx playwright install chromium` y ejecuta `npm run test:browser`. Los mapas y el servicio Supabase de esa prueba se simulan con datos de prueba.

## 8. Si algo no funciona

- **Página 404:** comprueba que `index.html` esté en la raíz, que Pages use `main` y `/(root)`, y que la publicación haya terminado.
- **Se ven los archivos pero no la app:** abre la dirección de Pages, no la dirección del repositorio en github.com ni el HTML con doble clic.
- **No llega la confirmación de cuenta:** revisa Custom SMTP, sus límites y Authentication Logs. El servicio de prueba de Supabase restringe los destinatarios.
- **No se guardan datos en la nube:** confirma que ejecutaste `supabase.sql`, que la clave es publicable y que el proyecto está activo. La app muestra el error; no cambia silenciosamente al cuaderno local.
- **No carga MAGNA:** la cartografía depende del servicio IGME-CSIC. Puedes conservar el punto y consultar su litología más tarde. No se cachean mapas para uso sin conexión.
- **No aparecen puntos BDMIN:** activa la capa, revisa el filtro y acerca el mapa. Si aparece un error del servicio, usa **Reintentar BDMIN**. Una ubicación del inventario puede no corresponder a un lugar accesible hoy.
- **No carga SoilGrids:** la capa y los valores dependen del servicio ISRIC. Reintenta la consulta o vuelve a MAGNA desde Capas; tu cuaderno sigue disponible. Las áreas sin predicción aparecen como «Sin datos».
- **No cargan las ortofotos:** abre Capas y cambia el mapa base a OpenStreetMap. Las imágenes dependen del servicio del IGN.
- **No aparecen fotos tras mucho tiempo con la página abierta:** usa **Cuaderno → Actualizar cuaderno**.
- **Se agotó el espacio local:** exporta una copia y libera almacenamiento en el dispositivo. Borrar los datos de la app sin copia puede eliminar tus muestras.

## Referencias

- [GitHub Pages y sitios estáticos](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Publicar GitHub Pages desde una rama](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Supabase: políticas por usuario](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: almacenamiento privado](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase: claves publicables](https://supabase.com/docs/guides/getting-started/api-keys)
- [Apple: instalar una app web desde Safari](https://support.apple.com/es-es/guide/iphone/iphea86e5236/ios)
- [IGME-CSIC: cartografía MAGNA](https://info.igme.es/cartografiadigital/geologica/Magna50.aspx)
- [IGME-CSIC: recursos minerales BDMIN](https://info.igme.es/BDmin/)
- [IGME-CSIC: visor geocientífico](https://info.igme.es/visor/)
- [ISRIC: SoilGrids y estado de su API](https://isric.org/explore/soilgrids)
- [ISRIC: servicios WMS de SoilGrids](https://docs.isric.org/globaldata/soilgrids/wms_from_qgis_arcmap.html)
- [ISRIC: unidades, profundidades e incertidumbre](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html)
- [IGN / CNIG: visores y servicios PNOA](https://pnoa.ign.es/pnoa-imagen/visualizadores-y-servicios-web)
- [Matt Fishman: uso y ensayo de tierras y esmaltes locales](https://ceramicartsnetwork.org/ceramics-monthly/ceramics-monthly-article/wild-clay-and-glaze)
- [Linda Bloomfield: geología para ceramistas](https://ceramicartsnetwork.org/ceramics-monthly/ceramics-monthly-article/Technofile-Geology-for-Potters)
- [Antoinette Badenhorst: ensayos de porcelana y caolines](https://ceramicartsnetwork.org/ceramics-monthly/ceramics-monthly-article/Translucent-Porcelain-131594)
- [Ceramic Arts Network: funciones de materias primas](https://ceramicartsnetwork.org/daily/article/understanding-clay-and-glaze-materials-you-dont-have-to-be-a-super-genius/)
- [Estudio: basalto como colorante de esmaltes](https://www.rsd.tfbor.bg.ac.rs/index.php/home/article/view/95)
