import { IonicVue } from '@ionic/vue';
import { createPinia } from 'pinia';
import { createApp, markRaw } from 'vue';
import App from './App.vue';
import router from './router';

/* CSS obrigatório do Ionic */
import '@ionic/vue/css/core.css';
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';
import '@ionic/vue/css/padding.css';
import '@ionic/vue/css/flex-utils.css';
import '@ionic/vue/css/display.css';
import '@ionic/vue/css/palettes/dark.system.css';

import './theme/variables.css';

// Disponibiliza o router dentro das stores (this.router), sem import circular.
const pinia = createPinia();
pinia.use(() => ({ router: markRaw(router) }));

const app = createApp(App).use(IonicVue, { mode: 'md' }).use(pinia).use(router);

router.isReady().then(() => app.mount('#app'));
