# 农场主的鸡窝

个人基金持有追踪工具（Vite + React + TypeScript）。克隆后默认为**空面板**，不含任何个人持仓数据。

## 开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
npm run preview
```

## 数据说明

| 位置 | 是否进 Git | 说明 |
|------|-----------|------|
| 浏览器 `localStorage` | 否 | 日常使用的数据存在本地浏览器 |
| `private/localFunds.ts` | **否** | 可选本地种子数据，仅 dev 模式生效 |
| `private/localFunds.example.ts` | 是 | 空模板，复制为 `localFunds.ts` 后填入个人数据 |
| 导出的 JSON / XLSX | **否** | 通过「设置 → 导出」生成的文件已被 `.gitignore` 排除 |

本地开发如需预填数据：

1. 复制 `private/localFunds.example.ts` → `private/localFunds.ts`
2. 填入 `localFunds` 数组，或从应用内导出 JSON 后转换
3. 重启 `npm run dev`（生产构建不会打包该文件）

## 功能

- 持有 / 行情 / 设置
- 净值同步、盈亏日历、导入导出（JSON / XLSX）
- 侧栏「鸡窝」终端显示同步进度
