/**
 * config.local.example.js —— 本机私有配置模板
 *
 * 使用方法：
 *   1. 复制本文件为 js/config.local.js（该文件已被 .gitignore 忽略，不会提交）
 *   2. 在 index.html（以及需要配置的页面）中，取消 config.js 之前那行
 *      <script src="js/config.local.js"></script> 的注释
 *   3. 按需修改下面的字段
 *
 * 适合长期固定使用某台后端（例如后端同学局域网机器）的场景。
 * 只是临时试一下的话，更推荐不改文件：
 *   地址栏加 ?api=http://192.168.1.20:8000&mock=0
 *   或控制台 localStorage.setItem('KG_API_BASE_URL', 'http://192.168.1.20:8000')
 */
window.KG_LOCAL_CONFIG = {
  API_BASE_URL: '',        // 例：'http://192.168.1.20:8000'；'' 表示同源
  USE_MOCK: true           // 接入真实后端时改为 false
};
