import { decrypt } from './crypto.js';

export function sshCmd(s, remoteCmd) {
  const pass = s.ssh_password ? decrypt(s.ssh_password) : null;
  const base = pass
    ? `sshpass -p ${JSON.stringify(pass)} ssh -o StrictHostKeyChecking=accept-new -o PasswordAuthentication=yes -o BatchMode=no -p ${s.port} ${s.username}@${s.host}`
    : `ssh -i ~/.ssh/id_ed25519_antigravity -i ~/.ssh/id_rsa -o StrictHostKeyChecking=accept-new -o BatchMode=yes -p ${s.port} ${s.username}@${s.host}`;
  return remoteCmd ? `${base} ${remoteCmd}` : base;
}
