# RideLog

RideLog 是一个现代化的骑行日志应用。将从 Keep 导出的骑行数据同步到 Strava，并以精致的 Web UI 展示骑行记录、路线地图与年度统计。

## 功能

- **数据同步**：从 Keep 导入骑行记录，自动同步到 Strava
- **路线地图**：基于 MapLibre GL 的交互式地图，支持单条路线回放与全部路线总览
- **年度统计**：按年汇总骑行距离、时长与爬升数据
- **隐私保护**：支持路线首尾裁剪与完全隐藏
- **静态部署**：构建为纯静态站点，可部署在 Vercel、Cloudflare Pages 等平台

## 技术栈

- React 19 + TypeScript
- Vite
- Tailwind CSS 4 + shadcn/ui
- MapLibre GL + react-map-gl
- Bun

## 快速开始

```bash
# 安装依赖
bun install

# 开发
bun run dev

# 构建
bun run build
```

## 数据同步

本地同步：

```bash
# 从 Keep 导入
bun run sync:keep

# 同步到 Strava
bun run sync:strava

# 生成前端数据
bun run data:generate

# 一键执行全部
bun run sync
```

GitHub Actions 已配置定时同步（北京时间 08:00、12:00、18:00、00:00），同步完成后自动提交生成的数据到仓库。

需要配置的环境变量：

- `KEEP_MOBILE`、`KEEP_PASSWORD` — Keep 账号
- `STRAVA_CLIENT_ID`、`STRAVA_CLIENT_SECRET`、`STRAVA_REFRESH_TOKEN` — Strava API 凭证

## 部署

```bash
bun run build
```

将 `dist` 目录部署到任意静态托管平台即可。

## Special Thanks

感谢以下开源项目提供的灵感与参考：

- [running_page](https://github.com/yihong0618/running_page/tree/master) by [yihong0618](https://github.com/yihong0618) — 一个优秀的跑步/骑行可视化项目
- [workouts_page](https://github.com/ben-29/workouts_page) by [ben-29](https://github.com/ben-29) — 运动记录同步与展示方案的重要参考
