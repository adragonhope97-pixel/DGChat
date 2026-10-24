// DGChat iPhone Duo —— 平台专属配置
// 断点只描述“窗口尺寸”，不绑定任何设备名称；真机适配时只需在此调整数值。
window.DUO_CONFIG = {
  DUAL_MIN_WIDTH: 760, // 双栏最小窗口宽度
  PANE_MIN_WIDTH: 320, // 单栏最小可用宽度
  KEYBOARD_SHRINK_RATIO: 0.82,

  // API 地址：默认同源（配合 config/serve.mjs 的代理）。
  // 若直接从其他源打开本页，可在这里或 URL ?api= 指向 DGChat 后端，
  // 同时后端需以 CORS_ORIGINS 环境变量放行该来源。
  API_BASE: '',

  STORAGE_PREFIX: 'duo_', // 独立存储键前缀，与主站（zdcw_）完全隔离
};
