import test, { beforeEach } from 'node:test';
import { Resolver } from 'node:dns/promises';

beforeEach(t => {
  t.mock.method(Resolver.prototype, 'resolveMx', async () => [{priority:10, exchange:'mx.example.test'}]);
});
let requestNumber = 0;
import assert from 'node:assert/strict';
import { POST } from '../src/app/api/contact/route.ts';
const draft = {name:'Alex',email:'alex@example.com',subject:'A question',note:'Can I ask about Flip?',id:'71c1469a-14ee-4f70-bf61-7b67e179b1c3'};
const request = (body=draft, origin='https://fschrhunt.com') => new Request('https://fschrhunt.com/api/contact',{method:'POST',headers:{origin,'content-type':'application/json','x-forwarded-for':`test-${++requestNumber}`},body:JSON.stringify(body)});

test('rejects cross-site requests, malformed origins, and invalid reviewed fields before sending', async () => {
  for (const origin of ['https://elsewhere.com','null','bad']) assert.equal((await POST(request(draft,origin))).status,403);
  for (const patch of [{email:'hello buddy'},{email:'alex@-example.com'},{email:'alex@exam_ple.com'},{email:'a..b@example.com'},{subject:'bad\r\nheader'},{note:''},{name:''}]) assert.equal((await POST(request({...draft,...patch}))).status,400);
});

test('sends only to Fischer with visitor reply-to and stable retry key, retaining provider failures', async () => {
  const original = globalThis.fetch;
  const oldKey = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = 'test-only';
  const calls = [];
  globalThis.fetch = async (url, options) => { calls.push({url,...options}); return Response.json({id:'test-id'}); };
  try {
    assert.equal((await POST(request())).status,200);
    assert.equal((await POST(request())).status,200);
    const payload = JSON.parse(calls[0].body);
    assert.deepEqual(payload.to,['fschrhunt@gmail.com']);
    assert.equal(payload.reply_to,draft.email);
    assert.equal(payload.headers['X-Contact-Source'],'fschrhunt.com');
    assert.equal(calls[0].headers['Idempotency-Key'],calls[1].headers['Idempotency-Key']);
    globalThis.fetch = async () => Response.json({message:'secret upstream detail'},{status:403});
    const failed = await POST(request());
    assert.equal(failed.status,502);
    assert.ok(!(await failed.text()).includes('secret upstream detail'));
  } finally {
    globalThis.fetch = original;
    if (oldKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = oldKey;
  }
});

test('missing credentials cannot report a successful send',async()=>{
  const oldKey=process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  try {assert.equal((await POST(request())).status,503);}
  finally {if(oldKey!==undefined)process.env.RESEND_API_KEY=oldKey;}
});

test('accepts the public Host when Next uses an internal request URL', async () => {
  const oldKey = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  try {
    const req = new Request('http://0.0.0.0:3000/api/contact', {method:'POST',headers:{host:'localhost:3000',origin:'http://localhost:3000','content-type':'application/json'},body:JSON.stringify(draft)});
    assert.equal((await POST(req)).status,503);
  } finally { if(oldKey !== undefined) process.env.RESEND_API_KEY=oldKey; }
});


/** Exercise DNS rejection through the send endpoint, with no real DNS queries or mail. */
async function withSending(t, run) {
  const oldKey = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = 'test-only';
  const send = t.mock.method(globalThis, 'fetch', async () => Response.json({id:'test-id'}));
  try { await run(send); }
  finally { if (oldKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = oldKey; }
}
const dnsError = code => Object.assign(new Error('DNS test'), {code});

test('null MX refuses the note before contacting the mail provider', async t => {
  t.mock.method(Resolver.prototype, 'resolveMx', async () => [{priority:0, exchange:''}]);
  await withSending(t, async send => {
    const result = await POST(request());
    assert.equal(result.status,400);
    assert.match((await result.json()).error, /does not accept mail/);
    assert.equal(send.mock.callCount(),0);
  });
});

test('absent mail and address records reject an unresolvable domain', async t => {
  for (const method of ['resolveMx','resolve4','resolve6'])
    t.mock.method(Resolver.prototype, method, async () => { throw dnsError('ENOTFOUND'); });
  await withSending(t, async send => {
    assert.equal((await POST(request())).status,400);
    assert.equal(send.mock.callCount(),0);
  });
});

test('IPv6 alone is a valid fallback when a domain has no MX', async t => {
  t.mock.method(Resolver.prototype, 'resolveMx', async () => { throw dnsError('ENODATA'); });
  t.mock.method(Resolver.prototype, 'resolve4', async () => { throw dnsError('ENODATA'); });
  t.mock.method(Resolver.prototype, 'resolve6', async () => ['2001:db8::1']);
  await withSending(t, async () => assert.equal((await POST(request())).status,200));
});

test('temporary DNS failures do not block a note', async t => {
  t.mock.method(Resolver.prototype, 'resolveMx', async () => { throw dnsError('ESERVFAIL'); });
  await withSending(t, async () => assert.equal((await POST(request())).status,200));
});

test('an uncertain address fallback does not label a domain invalid', async t => {
  t.mock.method(Resolver.prototype, 'resolveMx', async () => []);
  t.mock.method(Resolver.prototype, 'resolve4', async () => { throw dnsError('ENODATA'); });
  t.mock.method(Resolver.prototype, 'resolve6', async () => { throw dnsError('ETIMEOUT'); });
  await withSending(t, async () => assert.equal((await POST(request())).status,200));
});

test('international domains are converted for DNS without rewriting reply-to', async t => {
  const mx = t.mock.method(Resolver.prototype, 'resolveMx', async () => [{priority:10,exchange:'mx.example.test'}]);
  await withSending(t, async send => {
    assert.equal((await POST(request({...draft,email:'alex@bücher.de'}))).status,200);
    assert.equal(mx.mock.calls[0].arguments[0],'xn--bcher-kva.de');
    assert.equal(JSON.parse(send.mock.calls[0].arguments[1].body).reply_to,'alex@bücher.de');
  });
});


test('a stalled DNS lookup is cancelled and the note can proceed', async t => {
  let cancel;
  t.mock.method(Resolver.prototype, 'resolveMx', () => new Promise((resolve, reject) => {
    cancel = () => reject(dnsError('ECANCELLED'));
  }));
  const cancellation = t.mock.method(Resolver.prototype, 'cancel', () => cancel());
  await withSending(t, async () => {
    assert.equal((await POST(request())).status,200);
    assert.equal(cancellation.mock.callCount(),1);
  });
});

// A fixed IP (no shared store configured in tests) exercises the per-instance fallback limiter.
test('the fallback limit allows five notes per IP and blocks the sixth', async t => {
  await withSending(t, async () => {
    const fromOneIp = () => new Request('https://fschrhunt.com/api/contact', {
      method:'POST',
      headers:{origin:'https://fschrhunt.com','content-type':'application/json','x-forwarded-for':'fallback-limit-single'},
      body:JSON.stringify(draft),
    });
    for (let i = 0; i < 5; i++) assert.equal((await POST(fromOneIp())).status, 200);
    assert.equal((await POST(fromOneIp())).status, 429);
  });
});

// With a store configured, the endpoint rejects on the store's count, not per-instance memory.
test('a configured shared store enforces the limit on its own count', async t => {
  const saved = {key:process.env.RESEND_API_KEY, url:process.env.KV_REST_API_URL, token:process.env.KV_REST_API_TOKEN};
  process.env.RESEND_API_KEY = 'test-only';
  process.env.KV_REST_API_URL = 'https://store.test';
  process.env.KV_REST_API_TOKEN = 'token';
  let count = 0;
  const fetches = t.mock.method(globalThis, 'fetch', async url => {
    if (String(url).includes('store.test')) return Response.json([{result: ++count}, {result: 1}]);
    return Response.json({id:'test-id'});
  });
  try {
    for (let i = 0; i < 5; i++) assert.equal((await POST(request())).status, 200);
    assert.equal((await POST(request())).status, 429);
    assert.ok(fetches.mock.calls.some(call => String(call.arguments[0]).endsWith('/pipeline')));
  } finally {
    for (const [name, value] of [['RESEND_API_KEY',saved.key],['KV_REST_API_URL',saved.url],['KV_REST_API_TOKEN',saved.token]])
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
});
