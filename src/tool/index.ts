// 工具声明：朋友圈文案日更（只生成文案和排期表，不做任何自动发布）
import { CalendarHeart as CalendarHeartAsIcon } from 'lucide-react';
import type { GenerateTool, Params, RunContext } from '../kit/types';
import { isFatalLlmError, safeName } from './common';
import { STYLES, buildMessages, fmt, formatPost, parseReply, parseStart, planPost, scheduleSheet, todayYmd, totalPosts, type Plan, type PlanOptions, type Post } from './core';
import { writeXlsx } from './xlsx';

const clamp = (v: unknown, lo: number, hi: number, dflt: number) => Math.min(hi, Math.max(lo, Math.round(Number(v)) || dflt));

export function planOptions(p: Params, today = todayYmd()): PlanOptions {
  const start = parseStart(String(p.start ?? ''), today);
  if (!start) throw new Error(`「从哪天开始」写的「${p.start}」认不出来，请写成 2026-10-24 这样`);
  return { start, days: clamp(p.days, 1, 30, 7), perDay: clamp(p.perDay, 1, 3, 1), style: String(p.style || 'mix'), holidays: Boolean(p.holidays) };
}

async function writeOne(plan: Plan, ctx: RunContext): Promise<Post> {
  const p = ctx.params;
  const o = { info: String(p.info ?? '').trim(), withImage: Boolean(p.withImage), extra: String(p.extra ?? '').trim() };
  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return parseReply(await ctx.llm(buildMessages(plan, o), { json: true, temperature: 0.9 }));
    } catch (e) {
      if (isFatalLlmError(e)) throw e;
      last = e;
    }
  }
  throw last;
}

const tool: GenerateTool = {
  id: 'w11',
  name: '朋友圈文案日更',
  tagline: '填好商品或品牌信息，按天生成朋友圈文案：发布时段、正文、配图建议、评论区首评，自动结合节日和电商节点，导出排期表。只生成文案，发布由你自己手动完成。',
  icon: CalendarHeartAsIcon,
  category: '微信私域',
  type: 'text',
  mode: 'generate',
  resultView: 'text',
  needsLLM: true,
  concurrency: 2,
  generateLabel: '生成文案',
  params: [
    { key: 'info', label: '商品 / 品牌信息', type: 'textarea', rows: 5, default: '', placeholder: '例如：小王家的 316 不锈钢保温杯，500ml，保温 12 小时，一键开盖。本周下单送杯套，两个包邮。目标客户是上班族和学生。' },
    { key: 'style', label: '文案风格', type: 'select', options: STYLES, default: 'mix', help: '「每天轮换」会在种草、日常、促销之间换着写，朋友圈不容易显得刷屏' },
    { key: 'days', label: '生成几天', type: 'number', default: 7, min: 1, max: 30, unit: '天' },
    { key: 'perDay', label: '每天几条', type: 'number', default: 1, min: 1, max: 3, unit: '条', help: '每条调用一次大模型，天数 × 条数越多费用越高' },
    { key: 'start', label: '从哪天开始', type: 'text', default: '', placeholder: '不填就从明天开始，例如 2026-11-01' },
    { key: 'withImage', label: '带配图建议', type: 'toggle', default: true },
    { key: 'holidays', label: '结合节日和电商节点', type: 'toggle', default: true, help: '节日当天和前 3 天会结合节日写。农历节日只内置了 2026 年的日期' },
    { key: 'extra', label: '补充要求', type: 'text', default: '', placeholder: '可选，例如：称呼客户为「宝子们」，不要用表情' },
    { key: 'out', label: '排期表保存到', type: 'folder', default: '' },
  ],
  count: (p) => totalPosts({ days: clamp(p.days, 1, 30, 7), perDay: clamp(p.perDay, 1, 3, 1) }),

  async generate(index, ctx) {
    if (!String(ctx.params.info ?? '').trim()) throw new Error('先在「商品 / 品牌信息」里写上要推广的内容');
    const plan = planPost(index, planOptions(ctx.params));
    ctx.progress(0.2);
    const post = await writeOne(plan, ctx);
    const withImage = Boolean(ctx.params.withImage);
    return { summary: `${plan.date} ${plan.time}`, text: formatPost(plan, post, withImage), data: { plan, post } };
  },

  async afterAll(results, ctx) {
    const items = results.map((r) => r.result.data as { plan: Plan; post: Post } | undefined).filter((x): x is { plan: Plan; post: Post } => !!x);
    if (!items.length) return;
    const withImage = Boolean(ctx.params.withImage);
    const sheet = scheduleSheet(items, withImage);
    const o = planOptions(ctx.params);
    const name = safeName(`朋友圈排期-${fmt(o.start)}起${o.days}天`);
    const path = await ctx.join(ctx.outputDir, `${name}.xlsx`);
    const textCols = [7, ...(withImage ? [9, 10] : [9])];
    await ctx.writeFile(path, await writeXlsx([{ name: '排期', ...sheet, wrap: textCols }], '篝火 · 朋友圈文案日更'));
    return `排期表已保存：${path}`;
  },
};

export default tool;
