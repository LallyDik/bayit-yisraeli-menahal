import { describe, it, expect, beforeAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { signInAs } from './helpers/auth';

const PASSWORD = 'test-password-1234';
const run = String(Date.now()); // scope this run's objects so reruns don't collide

let alice: SupabaseClient;
let bob: SupabaseClient;
let aliceUserId: string;
let aliceUnitId: string;
let aliceAttachmentId: string;
const alicePath = () => `${aliceUserId}/${run}-a.pdf`;

beforeAll(async () => {
  alice = await signInAs('rls-alice@example.com', PASSWORD);
  bob = await signInAs('rls-bob@example.com', PASSWORD);

  const { data: aliceUser } = await alice.auth.getUser();
  aliceUserId = aliceUser.user!.id;

  const { data: unit, error: unitErr } = await alice
    .from('units')
    .insert({ name: `alice-attach-unit-${run}` })
    .select()
    .single();
  if (unitErr) throw unitErr;
  aliceUnitId = unit.id;
});

describe('attachments: happy path', () => {
  it('alice uploads a file into her own folder', async () => {
    const file = new Blob(['hello'], { type: 'application/pdf' });
    const { error } = await alice.storage
      .from('attachments')
      .upload(alicePath(), file, { contentType: 'application/pdf' });
    expect(error).toBeNull();
  });

  it('alice inserts the metadata row — owner_id filled from the JWT', async () => {
    const { data, error } = await alice
      .from('attachments')
      .insert({
        unit_id: aliceUnitId,
        file_name: 'contract.pdf',
        storage_path: alicePath(),
        content_type: 'application/pdf',
        size_bytes: 5,
      })
      .select()
      .single();
    expect(error).toBeNull();
    expect(data!.owner_id).toBe(aliceUserId);
    aliceAttachmentId = data!.id;
  });

  it('alice lists attachments for the unit and sees exactly hers', async () => {
    const { data, error } = await alice
      .from('attachments')
      .select('*')
      .eq('unit_id', aliceUnitId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].id).toBe(aliceAttachmentId);
    expect(data![0].storage_path).toBe(alicePath());
  });
});

describe('attachments: row isolation', () => {
  it("bob selects alice's attachment row by id → empty, not error", async () => {
    const { data, error } = await bob
      .from('attachments')
      .select('*')
      .eq('id', aliceAttachmentId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

describe('attachments: exactly one parent', () => {
  it('rejects a row with BOTH unit_id and tenant_id', async () => {
    const { data: tenant, error: tErr } = await alice
      .from('tenants')
      .insert({ name: `alice-attach-tenant-${run}` })
      .select()
      .single();
    expect(tErr).toBeNull();

    const { error } = await alice.from('attachments').insert({
      unit_id: aliceUnitId,
      tenant_id: tenant!.id,
      file_name: 'both.pdf',
      storage_path: `${aliceUserId}/${run}-both.pdf`,
    });
    expect(error).not.toBeNull();
  });

  it('rejects a row with NEITHER unit_id nor tenant_id', async () => {
    const { error } = await alice.from('attachments').insert({
      file_name: 'orphan.pdf',
      storage_path: `${aliceUserId}/${run}-orphan.pdf`,
    });
    expect(error).not.toBeNull();
  });
});

describe('attachments: storage isolation', () => {
  it("bob lists alice's folder → empty array, not her files", async () => {
    const { data, error } = await bob.storage.from('attachments').list(aliceUserId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("bob cannot upload into alice's folder", async () => {
    const file = new Blob(['evil'], { type: 'application/pdf' });
    const { error } = await bob.storage
      .from('attachments')
      .upload(`${aliceUserId}/${run}-evil.pdf`, file, { contentType: 'application/pdf' });
    expect(error).not.toBeNull();
  });

  it("bob cannot mint a signed URL for alice's object", async () => {
    const { data, error } = await bob.storage
      .from('attachments')
      .createSignedUrl(alicePath(), 60);
    // The API must refuse to sign — a signed URL in bob's hands would grant
    // access regardless of policies, so the error branch is the assertion.
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });
});

describe('attachments: mime enforcement', () => {
  it('the bucket rejects a disallowed content type server-side', async () => {
    const file = new Blob(['x'], { type: 'text/plain' });
    const { error } = await alice.storage
      .from('attachments')
      .upload(`${aliceUserId}/${run}-note.txt`, file, { contentType: 'text/plain' });
    expect(error).not.toBeNull();
  });
});
