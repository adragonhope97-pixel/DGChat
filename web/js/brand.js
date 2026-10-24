// 站点品牌配置 —— 全站文案的唯一出处
// 页面标题、顶栏、页脚、启动日志都从这里读取
window.BRAND = {
  name: 'DGChat',            // 英文/展示名
  nameZh: '',                 // 中文副标题（留白则不显示）
  tagline: '让校园生活更有温度', // 页脚标语
  title: 'DGChat · 校园墙',
  // 原生 App（Capacitor）里页面从本地文件加载，接口需要电脑的局域网地址
  // 浏览器 / PWA 访问时此值不参与（自动用相对路径）
  nativeServerHost: 'http://192.168.3.216:3000',
};
