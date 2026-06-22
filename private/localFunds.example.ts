import type { Fund } from '../src/types';

/**
 * 本地个人基金数据（可选）
 *
 * 用法：
 * 1. 复制本文件为同目录下的 localFunds.ts（该文件已被 .gitignore 忽略）
 * 2. 填入你的 Fund[] 数据，或从应用「设置 → 导出 JSON」后粘贴转换
 * 3. 重启 dev 服务器；清空浏览器 localStorage 后会用这里的种子数据
 */
export const localFunds: Fund[] = [];
