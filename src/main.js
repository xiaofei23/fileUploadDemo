import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import ElementPlus from 'element-plus' // 引入 Element Plus 核心
import 'element-plus/dist/index.css' // 引入 Element Plus 全局样式（必须）
import * as ElementPlusIconsVue from '@element-plus/icons-vue' // 引入所有图标（上传组件依赖）
import SparkMD5 from 'spark-md5' // 引入 SparkMD5（上传组件依赖）
import axios from 'axios'
const app = createApp(App)
app.config.globalProperties.$SparkMD5 = SparkMD5 // 将 SparkMD5 挂载到全局属性，供上传组件使用
// 1. 注册 Element Plus
app.use(ElementPlus)
app.config.globalProperties.$SparkMD5 = SparkMD5
// 2. 注册所有 Element Plus 图标（全局可用，无需单独引入）
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

// 3. 挂载 App
app.mount('#app')
