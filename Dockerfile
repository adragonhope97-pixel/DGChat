# DGChat 生产镜像（Node 22 轻量版）
# 数据持久化：/app/data（data.json + uploads + backups），务必挂载卷
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# 依赖层（利用缓存）
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 应用层
COPY server ./server
COPY web ./web
COPY package.json ./

# 数据与日志目录
RUN mkdir -p /app/data /app/logs /app/server/plugins

# 健康检查：进程内 curl 不可用，用 node 一行
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

EXPOSE 3000
VOLUME ["/app/data", "/app/logs"]

# 非 root 运行
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

CMD ["node", "server/server.js"]
