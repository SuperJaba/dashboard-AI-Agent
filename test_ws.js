import { io } from 'socket.io-client';
const socket = io('http://localhost:3001');
socket.on('connect', () => {
  console.log('Connected');
  socket.emit('spawn_terminal', {
    command: 'bash',
    args: ['-c', 'echo hello'],
    cwd: '/tmp',
    env: {}
  });
});
socket.on('terminal_data', (data) => console.log('DATA:', data));
socket.on('terminal_exit', (code) => { console.log('EXIT:', code); process.exit(0); });
socket.on('terminal_error', (err) => console.log('ERROR:', err));
