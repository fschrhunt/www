import test from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../src/app/api/contact/route.ts';
const draft = {name:'Alex',email:'alex@example.com',subject:'A question',note:'Can I ask about Flip?',id:'71c1469a-14ee-4f70-bf61-7b67e179b1c3'};
const request = (body=draft, origin='https://fschrhunt.com') => new Request('https://fschrhunt.com/api/contact',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});

test('rejects cross-site requests, malformed origins, and invalid reviewed fields before sending', async () => {
  for (const origin of ['https://elsewhere.com','null','bad']) assert.equal((await POST(request(draft,origin))).status,403);
  for (const patch of [{email:'hello buddy'},{subject:'bad\r\nheader'},{note:''},{name:''}]) assert.equal((await POST(request({...draft,...patch}))).status,400);
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
