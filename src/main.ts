import './assets/main.css';
import 'element-plus/dist/index.css';
import 'element-plus/theme-chalk/dark/css-vars.css';

import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import router from './router';
import { loadPlugins } from './plugins';

const app = createApp(App);

loadPlugins(app);

app.use(createPinia());
app.use(router);

app.mount('#app');
