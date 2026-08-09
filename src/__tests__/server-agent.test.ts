import { ServerSchema, AgentSchema } from '../shared/api-client/schemas';

describe('ServerSchema', () => {
  it('validates minimal server object', () => {
    const srv = { id: 1, name: 'srv' };
    const res = ServerSchema.safeParse(srv);
    expect(res.success).toBe(true);
  });
});

describe('AgentSchema', () => {
  it('validates minimal agent object', () => {
    const agt = { id: 1, name: 'agent' };
    const res = AgentSchema.safeParse(agt);
    expect(res.success).toBe(true);
  });
});
