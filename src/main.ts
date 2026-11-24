import './ui/styles.css';
import { App } from './app/App';
import { showFatalError } from './ui/Hud';

const root = document.getElementById('app');
if (!root) throw new Error('#app is missing from index.html');

let app: App | null = null;
try {
  app = new App(root);
} catch (error) {
  console.error(error);
  showFatalError("Your browser or device doesn't support WebGL 2. Try an up-to-date Chrome, Safari or Firefox.");
}

app?.start().catch((error: unknown) => {
  console.error(error);
  showFatalError("Couldn't load the aquarium. Check your connection and reload the page.");
});
