import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import endpoint from '../api/visitas.mjs';

const stats = { total:0, today:0, day:'2026-10-21', since:'2026-10-22T02:00:00Z', countries:[] };
const nativeFetch = globalThis.fetch;
const secret = 'a'.repeat(64); // Clave ficticia de prueba, sin acceso a producción.
process.env.MYHOME_VISITS_SECRET = secret;
const request = (method='POST', headers={}) => new Request('https://pablovillagran.cl/api/visitas', {
  method, headers:{ origin:'https://pablovillagran.cl', 'sec-fetch-site':'same-origin', 'user-agent':'Mozilla/5.0 Safari/605.1', 'x-vercel-forwarded-for':'203.0.113.42', 'x-vercel-ip-country':'CL', ...headers }
});

test('GET consulta totales sin registrar una visita y permite caché breve', async () => {
  globalThis.fetch = async (url, init) => { assert.match(url,/myhome_visits_summary$/); assert.deepEqual(JSON.parse(init.body),{}); return Response.json(stats); };
  const res=await endpoint.fetch(request('GET'));
  assert.equal(res.status,200); assert.match(res.headers.get('cache-control'),/s-maxage=30/);
  assert.deepEqual(await res.json(),stats);
});
test('POST firma país y huella diaria sin enviar la IP ni el navegador a la base', async () => {
  globalThis.fetch = async (url, init) => {
    assert.match(url,/myhome_visits_record$/);
    const body=JSON.parse(init.body);
    assert.equal(body.p_country,'CL'); assert.match(body.p_fingerprint,/^[a-f0-9]{64}$/);
    assert.equal(body.p_signature,createHmac('sha256',secret).update([body.p_day,body.p_country,body.p_fingerprint,body.p_clock].join('|')).digest('hex'));
    assert.ok(!init.body.includes('203.0.113.42')); assert.ok(!init.body.includes('Mozilla'));
    return Response.json({...stats,total:1,today:1,counted:true});
  };
  const res=await endpoint.fetch(request()); assert.equal(res.status,200); assert.equal(res.headers.get('cache-control'),'no-store'); assert.equal((await res.json()).counted,true);
});
test('rechaza solicitudes de otros sitios y métodos no admitidos', async () => {
  globalThis.fetch=()=>{throw Error('No se debe consultar la base');};
  assert.equal((await endpoint.fetch(request('POST',{origin:'https://otro.example'}))).status,403);
  assert.equal((await endpoint.fetch(request('POST',{'sec-fetch-site':'cross-site'}))).status,403);
  assert.equal((await endpoint.fetch(request('DELETE'))).status,405);
});
test('no suma robots y usa ubicación desconocida cuando falta país', async () => {
  globalThis.fetch=async(url)=>{assert.match(url,/myhome_visits_summary$/);return Response.json(stats);};
  assert.equal((await (await endpoint.fetch(request('POST',{'user-agent':'Googlebot'}))).json()).counted,false);
  globalThis.fetch=async(url,init)=>{assert.equal(JSON.parse(init.body).p_country,'ZZ');return Response.json(stats);};
  assert.equal((await endpoint.fetch(request('POST',{'x-vercel-ip-country':''}))).status,200);
});
test('la caída del almacenamiento devuelve 503, sin totales inventados ni detalles privados', async () => {
  globalThis.fetch=async()=>new Response('detalle privado',{status:500});
  const res=await endpoint.fetch(request('GET'));
  assert.equal(res.status,503); const body=await res.json(); assert.ok(body.error); assert.ok(!('total' in body)); assert.ok(!JSON.stringify(body).includes('detalle privado'));
});
test.after(()=>{globalThis.fetch=nativeFetch; delete process.env.MYHOME_VISITS_SECRET;});
