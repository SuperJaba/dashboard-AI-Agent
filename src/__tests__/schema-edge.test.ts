import { ProjectSchema, ServerSchema } from '../shared/api-client/schemas';

describe('ProjectSchema defaults', () => {
  it('sets complete default to 0 when omitted', () => {
    const proj = { id: 1, name: 'p' };
    const res = ProjectSchema.safeParse(proj);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.complete).toBe(0);
    }
  });
});

describe('ServerSchema defaults', () => {
  it('provides default host and username when omitted', () => {
    const srv = { id: 1, name: 's' };
    const res = ServerSchema.safeParse(srv);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.host).toBe('');
      expect(res.data.username).toBe('');
    }
  });
});