// Comprobación de la web compilada en un subdirectorio equivalente a GitHub Pages.
// MAGNA y Supabase se simulan aquí; no se crean cuentas ni se envían correos reales.
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const root = path.resolve('dist'), output = path.resolve(process.env.TIERRAS_TEST_OUTPUT || path.join(os.tmpdir(), 'tierras-browser-qa'));
await mkdir(output, { recursive: true });
const icon = await readFile(path.join(root, 'icon-192.png'));
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://local');
    const match = /^\/(tierras|otra|cloud|mal-configurada)\/(.*)$/.exec(url.pathname);
    if (!match) { res.writeHead(404); res.end('No existe'); return; }
    if (match[2] === 'config.js' && ['cloud', 'mal-configurada'].includes(match[1])) {
      res.writeHead(200, { 'Content-Type': MIME['.js'] });
      res.end(`window.TIERRAS_CONFIG={supabaseUrl:'https://demo.supabase.co',supabasePublishableKey:'${match[1] === 'cloud' ? 'sb_publishable_testing' : 'sb_secret_forbidden'}'};`); return;
    }
    const file = path.resolve(root, match[2] || 'index.html');
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end('No existe'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const pageErrors = [], calls = [], boundaryErrors = [];
async function fixtures(context, cloud = false) {
  context.on('page', page => {
    page.on('pageerror', error => pageErrors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error' && message.text().startsWith('Tierras:')) { boundaryErrors.push(message.text()); console.error(message.text()); } });
  });
  await context.route('**/tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/png', body: icon }));
  await context.route('**/www.ign.es/wms-inspire/pnoa-ma**', route => {
    calls.push({ path: new URL(route.request().url()).pathname, method: 'GET' });
    return route.fulfill({ contentType: 'image/png', body: icon });
  });
  await context.route('**/mapas.igme.es/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/query')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ features: [{ attributes: url.pathname.includes('/11/') ? { HOJA: 784, ID: 1, DLO: 'ARCILLAS Y MARGAS' } : { NUM: 784, NOMBRE: 'CIUDAD REAL' } }] }) });
    return route.fulfill({ contentType: 'image/png', body: icon });
  });
  if (cloud) {
    const records = new Map();
    const owner = '11111111-1111-4111-8111-111111111111';
    const token = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url') + '.' + Buffer.from(JSON.stringify({ sub: owner, exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url') + '.test';
    await context.route('https://demo.supabase.co/**', async route => {
      const request = route.request(), url = new URL(request.url()), method = request.method(); calls.push({ path: url.pathname, method });
      if (url.pathname === '/auth/v1/token') {
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ access_token: token, token_type: 'bearer', refresh_token: 'test-refresh', expires_in: 3600,
          user: { id: owner, email: 'cuaderno@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } }) });
      }
      if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 });
      if (url.pathname === '/rest/v1/tierras_samples') {
        const object = request.headers()['accept']?.includes('application/vnd.pgrst.object+json');
        const id = url.searchParams.get('id')?.replace('eq.', '');
        const revision = url.searchParams.get('revision')?.replace('eq.', '');
        if (method === 'POST') { const body = request.postDataJSON(); records.set(body.id, { ...body, revision: 0 }); return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }); }
        if (method === 'PATCH') {
          const row = records.get(id);
          if (row && Number(revision) === row.revision) { row.data = request.postDataJSON().data; row.revision++; return route.fulfill({ contentType: 'application/json', body: JSON.stringify(object ? { id } : [{ id }]) }); }
          return route.fulfill({ contentType: 'application/json', body: JSON.stringify(object ? null : []) });
        }
        if (method === 'DELETE') { records.delete(id); return route.fulfill({ contentType: 'application/json', body: JSON.stringify(object ? { id } : [{ id }]) }); }
        const rows = [...records.values()].filter(row => !id || row.id === id);
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify(object ? rows[0] || null : rows) });
      }
      return route.fulfill({ status: 404, contentType: 'application/json', body: '{"message":"Petición no simulada"}' });
    });
  }
}
async function createSample(page, name) {
  await page.waitForSelector('.leaflet-container');
  await page.screenshot({ path: path.join(output, 'iphone-mapa.png') });
  await page.locator('.map-canvas').click({ position: { x: 190, y: 240 } });
  await page.getByRole('button', { name: 'Recogí tierra aquí' }).click();
  const dialog = page.locator('dialog[open]');
  await dialog.locator('[name=name]').fill(name);
  await dialog.locator('[name=description]').fill('Tierra fina y rojiza');
  await dialog.getByRole('button', { name: 'Guardar muestra', exact: true }).click();
  await page.locator('.detail-title h1').filter({ hasText: name }).waitFor();
}
async function openTools(page) {
  await page.getByRole('button', { name: 'Abrir opciones del cuaderno' }).click();
  await page.locator('.notebook-dialog[open]').waitFor();
  return page.locator('.notebook-dialog');
}
async function openCollected(page, name) {
  const mobile = page.locator('.mobile-nav');
  if (await mobile.isVisible()) await mobile.locator('button').nth(1).click();
  else await page.locator('.desktop-nav button').nth(1).click();
  await page.locator('.collection-page .sample-item').filter({ hasText: name }).click();
}
try {
  const mobile = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, acceptDownloads: true });
  await fixtures(mobile);
  const page = await mobile.newPage();
  await page.goto(base + '/tierras/');
  await page.waitForSelector('.leaflet-container');
  assert.match(await page.locator('.notebook-mode').innerText(), /este dispositivo/);
  const manifest = await page.evaluate(async () => (await fetch(new URL('manifest.webmanifest', document.baseURI))).json());
  assert.equal(manifest.start_url, './'); assert.equal(manifest.scope, './');
  await page.locator('.mobile-nav').getByRole('button', { name: 'Explorar', exact: true }).click();
  await page.getByRole('heading', { name: 'Dónde buscar', exact: true }).waitFor();
  assert.equal(await page.locator('.material-card').count(),6);
  await page.locator('.goal-filters').getByRole('button', { name: 'Pastas', exact: true }).click();
  assert.equal(await page.locator('.material-card').count(),2);
  await page.getByRole('searchbox', { name: 'Buscar un material' }).fill('basalto');
  await page.getByText('No hay materiales con esa búsqueda y ese uso.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Ver todos los materiales', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Buscar un material' }).fill('CAOLÍN');
  assert.equal(await page.locator('.material-card').count(),1);
  assert.match(await page.locator('.material-title').innerText(), /Caolín/);
  await page.getByRole('searchbox', { name: 'Buscar un material' }).fill('');
  assert.equal(await page.locator('.map-resource a').count(),4);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: path.join(output, 'iphone-explorar.png') });
  await page.getByRole('button', { name: 'Ir al mapa', exact: true }).click();
  await createSample(page, 'Tierra QA');
  assert.equal(await page.locator('.ceramic-ideas details').count(),2);
  await page.locator('.ceramic-ideas summary').first().click();
  await page.locator('.ceramic-ideas').getByText(/Primera prueba:/).first().waitFor();
  await page.getByRole('button', { name: 'Registrar cocción', exact: true }).click();
  let dialog = page.locator('dialog[open]');
  await dialog.locator('[name=temperature]').fill('980'); await dialog.locator('[name=color]').fill('Rojo teja');
  await dialog.getByRole('button', { name: 'Guardar cocción' }).click();
  await page.locator('.temperature b').filter({ hasText: '980' }).waitFor();
  await page.locator('.raw-section input[type=file]').first().setInputFiles(path.join(root, 'icon-192.png'));
  await page.locator('.raw-section .photo-gallery img').waitFor();
  await page.locator('.firing-card input[type=file]').first().setInputFiles(path.join(root, 'icon-192.png'));
  await page.locator('.firing-card .photo-gallery img').waitFor();
  await page.locator('#sample-notes').fill('Notas que deben sobrevivir a la recarga');
  await page.getByRole('button', { name: 'Guardar notas', exact: true }).click();
  await page.getByText('Notas guardadas', { exact: true }).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.evaluate(() => { document.querySelector('.detail-page').scrollTop = 0; document.querySelector('.app-shell').scrollTop = 0; window.scrollTo(0,0); });
  await page.screenshot({ path: path.join(output, 'iphone-ficha.png') });
  dialog = await openTools(page);
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Exportar cuaderno con fotos' }).click();
  const downloaded = await downloadPromise, backupFile = path.join(output, 'backup-test.json'); await downloaded.saveAs(backupFile);
  const backup = JSON.parse(await readFile(backupFile, 'utf8'));
  assert.equal(backup.samples.length,1); assert.equal(backup.photos.length,2);
  await dialog.getByRole('button', { name: 'Cerrar opciones del cuaderno' }).click();
  await page.reload();
  await openCollected(page,'Tierra QA');
  assert.equal(await page.locator('#sample-notes').inputValue(),'Notas que deben sobrevivir a la recarga');
  const other = await mobile.newPage(); await other.goto(base + '/otra/');
  await other.locator('.mobile-nav button').nth(1).click();
  await other.getByText('Un cuaderno por empezar', { exact: true }).waitFor();
  assert.equal(await other.locator('.sample-item').count(),0);
  await other.close();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await mobile.setOffline(true); await page.reload();
  await openCollected(page,'Tierra QA');
  await page.locator('#sample-notes').fill('Guardada sin conexión'); await page.getByRole('button', { name: 'Guardar notas', exact: true }).click();
  await page.getByText('Notas guardadas', { exact: true }).waitFor();
  await mobile.setOffline(false); await page.reload();
  await openCollected(page,'Tierra QA');
  assert.equal(await page.locator('#sample-notes').inputValue(),'Guardada sin conexión');
  await page.getByRole('button', { name: 'Ver en mapa' }).click();
  await page.waitForFunction(() => document.querySelector('.map-screen:not(.hidden-screen)') || document.querySelector('.account-page'));
  assert.equal(await page.locator('.app-shell').count(),1,JSON.stringify(boundaryErrors));
  await page.getByRole('button', { name: 'Qué probar con esta tierra', exact: true }).click();
  await page.locator('.explore-point h2').filter({ hasText: 'arcillas y margas' }).waitFor();
  assert.equal(await page.locator('.point-materials a').count(),2);
  await page.locator('.goal-filters').getByRole('button', { name: 'Texturas', exact: true }).click();
  assert.equal(await page.locator('.material-card').count(),3);
  await page.locator('.point-materials a').first().click();
  assert.equal(await page.locator('.material-card').count(),6);
  await page.getByRole('button', { name: 'Ver ortofotos en Tierras', exact: true }).click();
  await page.getByRole('button', { name: 'Capas del mapa', exact: true }).click();
  const orthoButton = page.getByRole('button', { name: /Ortofotos · PNOA/ });
  assert.equal(await orthoButton.getAttribute('aria-pressed'),'true');
  await page.getByRole('button', { name: /Litología MAGNA/ }).click();
  assert.match(await page.locator('.map-source').innerText(), /Ortofotos PNOA/);
  await page.getByRole('button', { name: 'Caminos · OpenStreetMap', exact: true }).click();
  assert.match(await page.locator('.map-source').innerText(), /OpenStreetMap/);
  await page.getByRole('button', { name: /Litología MAGNA/ }).click();
  await page.getByRole('button', { name: 'Cerrar capas', exact: true }).click();
  assert.ok(calls.some(call => call.path === '/wms-inspire/pnoa-ma'));
  await mobile.setOffline(true);
  await page.locator('.mobile-nav').getByRole('button', { name: 'Explorar', exact: true }).click();
  assert.equal(await page.locator('.material-card').count(),6);
  await mobile.setOffline(false);
  const second = await browser.newContext({ viewport: { width: 1280, height: 800 } }); await fixtures(second);
  const restored = await second.newPage(); await restored.goto(base + '/tierras/');
  dialog = await openTools(restored); await dialog.locator('input[type=file]').setInputFiles(backupFile);
  await dialog.getByText(/1 muestras añadidas/).waitFor();
  await dialog.getByRole('button', { name: 'Cerrar opciones del cuaderno' }).click();
  await openCollected(restored,'Tierra QA');
  assert.equal(await restored.locator('.photo-gallery img').count(),2);
  await restored.getByRole('button', { name: 'Ver en mapa' }).click();
  await restored.waitForFunction(() => document.querySelector('.map-screen:not(.hidden-screen)') || document.querySelector('.account-page'));
  assert.equal(await restored.locator('.app-shell').count(),1,JSON.stringify(boundaryErrors));
  await restored.screenshot({ path: path.join(output, 'desktop-mapa.png') });
  await restored.locator('.desktop-nav').getByRole('button', { name: 'Explorar', exact: true }).click();
  assert.equal(await restored.locator('.material-card').count(),6);
  await restored.screenshot({ path: path.join(output, 'desktop-explorar.png') });
  await restored.setViewportSize({ width: 820, height: 900 });
  assert.ok(await restored.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await restored.setViewportSize({ width: 320, height: 700 });
  assert.ok(await restored.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await restored.screenshot({ path: path.join(output, 'movil-pequeno-explorar.png') });
  const bad = await browser.newContext(); await fixtures(bad); const badPage = await bad.newPage();
  await badPage.goto(base + '/mal-configurada/'); await badPage.getByText('Configuración pendiente', { exact: true }).waitFor();
  assert.equal(await badPage.locator('.app-shell').count(),0);
  const cloud = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true }); await fixtures(cloud,true);
  const cloudPage = await cloud.newPage(); await cloudPage.goto(base + '/cloud/');
  await cloudPage.locator('[name=email]').fill('cuaderno@example.test'); await cloudPage.locator('[name=password]').fill('ContraseñaDePrueba123');
  await cloudPage.getByRole('button', { name: 'Entrar', exact: true }).last().click();
  await cloudPage.waitForSelector('.app-shell'); assert.match(await cloudPage.locator('.notebook-mode').innerText(), /cuaderno@example.test/);
  await createSample(cloudPage,'Tierra de cuenta');
  await cloudPage.locator('#sample-notes').fill('Nota en la nube'); await cloudPage.getByRole('button',{name:'Guardar notas',exact:true}).click();
  await cloudPage.getByText('Notas guardadas',{exact:true}).waitFor();
  await cloudPage.reload(); await openCollected(cloudPage,'Tierra de cuenta');
  assert.equal(await cloudPage.locator('#sample-notes').inputValue(),'Nota en la nube');
  assert.ok(calls.some(call => call.path === '/rest/v1/tierras_samples' && call.method === 'PATCH'));
  assert.equal(pageErrors.length,0,JSON.stringify(pageErrors));
  assert.equal(boundaryErrors.length,0,JSON.stringify(boundaryErrors));
  console.log('Navegador: explorar materiales, filtros, búsqueda, ideas por litología, ortofotos, móvil y tableta, rutas de subcarpeta, muestras, cocciones, fotos, notas, copias, aislamiento local, modo sin conexión, configuración inválida y conexión Supabase comprobados.');
  await writeFile(path.join(output,'result.json'),JSON.stringify({status:'passed',pageErrors,cloudRequests:calls.length},null,2));
} finally {
  await browser.close(); server.close();
}
