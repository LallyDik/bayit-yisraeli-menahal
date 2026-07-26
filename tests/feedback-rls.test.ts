import { describe, expect, it } from 'vitest';
import { anonClient, signInAs } from './helpers/auth';

const PASSWORD = 'test-password-1234';

// The whole point of routing feedback through an Edge Function is that no
// browser-held key can touch this table. If a policy is ever added by mistake,
// these tests are what catches it.
describe('RLS: feedback is closed to browser keys', () => {
  it('rejects an insert from an anonymous client', async () => {
    const { error } = await anonClient()
      .from('feedback')
      .insert({ message: 'anon should not get in' });
    expect(error).not.toBeNull();
  });

  it('rejects an insert from a signed-in user', async () => {
    const user = await signInAs('feedback-probe@example.com', PASSWORD);
    const { error } = await user
      .from('feedback')
      .insert({ message: 'authenticated should not get in either' });
    expect(error).not.toBeNull();
  });

  it('returns no rows to a signed-in user', async () => {
    const user = await signInAs('feedback-probe@example.com', PASSWORD);
    const { data } = await user.from('feedback').select('*');
    expect(data).toEqual([]);
  });
});
