import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // 配置代理
  server: {
    proxy: {
      // 匹配所有以 /api 开头的请求路径
      '/api': {
        target: 'http://localhost:8089', // 后端服务地址（本地 8089 端口）
        changeOrigin: true, // 开启跨域（关键：模拟前端请求来自后端域名）
        rewrite: (path) => path.replace(/^\/api/, ''), // 可选：移除请求路径中的 /api 前缀
        // 可选配置：解决 HTTPS 证书问题（若后端用 HTTPS 需开启）
        // secure: false,
        // 可选配置：超时时间（默认 60 秒，大文件上传可延长）
        // timeout: 300000
      },
    },
  },
})
