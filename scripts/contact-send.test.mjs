import test, { beforeEach } from 'node:test';
import { Resolver } from 'node:dns/promises';

beforeEach(t => {
  const names = ['NODE_ENV'];
  const saved = names.map(name => [name, process.env[name]]);
  for (const name of names) delete process.env[name];
  process.env.NODE_ENV = 'test';
  t.after(() => {
    for (const [name, value] of saved)
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
  });
  t.mock.method(Resolver.prototype, 'resolveMx', async () => [{priority:10, exchange:'mx.example.test'}]);
});
let requestNumber = 0;
import assert from 'node:assert/strict';
import { handleContact } from '../src/lib/contact-send.ts';
// The route passes Worker settings; here the environment stands in, and memory counting is allowed only outside production.
const POST = (req, limiter) => handleContact(req, process.env, process.env.NODE_ENV !== 'production', limiter);
/** A RateLimiter stand-in: one shared count per key, like the Durable Object. */
function limiterStub() {
  const counts = new Map();
  return { getByName: key => ({ hit: async max => {
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts.get(key) > max ? 600 : null;
  } }) };
}
const draft = {name:'Alex',email:'alex@example.com',subject:'A question',note:'Can I ask about Diffuse?',id:'71c1469a-14ee-4f70-bf61-7b67e179b1c3'};
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

// A fixed IP with no limiter binding exercises the per-instance fallback limiter.
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

// With the binding present, the endpoint rejects on the Durable Object's count, not per-instance memory.
test('the RateLimiter binding enforces the production limit on its own count', async t => {
  await withSending(t, async () => {
    process.env.NODE_ENV = 'production';
    const limiter = limiterStub();
    const fromOneIp = () => new Request('https://fschrhunt.com/api/contact', {
      method:'POST',
      headers:{origin:'https://fschrhunt.com','content-type':'application/json','cf-connecting-ip':'203.0.113.7'},
      body:JSON.stringify(draft),
    });
    for (let i = 0; i < 5; i++) assert.equal((await POST(fromOneIp(), limiter)).status, 200);
    assert.equal((await POST(fromOneIp(), limiter)).status, 429);
    assert.equal((await POST(request(), limiter)).status, 200);
  });
});


test('oversized streams are cancelled before their remaining chunks are read', async t => {
  let reads = 0;
  let cancelled = false;
  const body = new ReadableStream({
    pull(controller) { reads++; controller.enqueue(new Uint8Array(9000)); },
    cancel() { cancelled = true; },
  }, {highWaterMark: 0});
  const req = new Request('https://fschrhunt.com/api/contact', {
    method: 'POST', duplex: 'half', body,
    headers: {origin: 'https://fschrhunt.com', 'content-type': 'application/json'},
  });
  await withSending(t, async send => {
    assert.equal((await POST(req)).status, 413);
    assert.equal(reads, 2);
    assert.equal(cancelled, true);
    assert.equal(send.mock.callCount(), 0);
  });
});

test('the body limit counts UTF-8 bytes, including otherwise ignored fields', async t => {
  await withSending(t, async send => {
    assert.equal((await POST(request({...draft, extra: '😀'.repeat(4000)}))).status, 413);
    assert.equal(send.mock.callCount(), 0);
  });
});

test('valid JSON remains readable across chunk boundaries', async t => {
  const bytes = new TextEncoder().encode(JSON.stringify({...draft, name: 'Zoë'}));
  let index = 0;
  const body = new ReadableStream({pull(controller) {
    if (index < bytes.length) controller.enqueue(bytes.slice(index, ++index));
    else controller.close();
  }});
  await withSending(t, async () => {
    const req = new Request('https://fschrhunt.com/api/contact', {
      method: 'POST', duplex: 'half', body,
      headers: {origin: 'https://fschrhunt.com', 'content-type': 'application/json'},
    });
    assert.equal((await POST(req)).status, 200);
  });
});

test('production refuses sends without the RateLimiter binding', async t => {
  await withSending(t, async send => {
    process.env.NODE_ENV = 'production';
    assert.equal((await POST(request())).status, 503);
    assert.equal(send.mock.callCount(), 0);
  });
});

test('a failing RateLimiter cannot bypass the limit', async t => {
  process.env.NODE_ENV = 'production';
  const broken = { getByName: () => ({ hit: async () => { throw new Error('private storage detail'); } }) };
  await withSending(t, async send => {
    const response = await POST(request(), broken);
    assert.equal(response.status, 503);
    assert.ok(!(await response.text()).includes('private storage detail'));
    assert.equal(send.mock.callCount(), 0);
  });
});
