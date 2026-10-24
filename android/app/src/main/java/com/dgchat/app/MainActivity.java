package com.dgchat.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // 屏幕自适应：钉死 WebView 字体缩放为 100%，
    // 系统字体大小变化不再撑破布局（间距/换行由 CSS 统一负责）
    if (this.bridge != null && this.bridge.getWebView() != null) {
      WebSettings ws = this.bridge.getWebView().getSettings();
      ws.setTextZoom(100);
      ws.setSupportZoom(false);
      ws.setBuiltInZoomControls(false);
      ws.setDisplayZoomControls(false);
    }
  }
}
