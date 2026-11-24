import './ui/styles.css';
import { App } from './app/App';

const root = document.getElementById('app');
if (!root) throw new Error('#app is missing from index.html');

const app = new App(root);
app.start().catch((error: unknown) => {
  console.error(error);
  const status = document.getElementById('status');
  if (status) {
    status.textContent = 'Could not start: your browser needs WebGL 2. Try an up-to-date Chrome, Safari or Firefox.';
    status.classList.add('error');
  }
});
