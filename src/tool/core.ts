// 纯函数：节日日历、排期（日期 / 时段 / 角度）、提示词构造与回复解析、排期表。
import { extractJson, pick, toStringList, type Cell } from './common';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

// ---------- 日期（一律用「年-月-日」字符串，避免时区问题） ----------

export interface Ymd { y: number; m: number; d: number }
const utc = (x: Ymd) => Date.UTC(x.y, x.m - 1, x.d);
const fromUtc = (t: number): Ymd => { const d = new Date(t); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }; };
export const addDays = (x: Ymd, n: number) => fromUtc(utc(x) + n * 86400000);
export const diffDays = (a: Ymd, b: Ymd) => Math.round((utc(b) - utc(a)) / 86400000);
export const fmt = (x: Ymd) => `${x.y}-${String(x.m).padStart(2, '0')}-${String(x.d).padStart(2, '0')}`;
export const weekday = (x: Ymd) => ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(utc(x)).getUTCDay()];
export const todayYmd = (now = new Date()): Ymd => ({ y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() });

/** 解析开始日期：2026-10-24、2026/10/24、2026年10月24日、10-24、10月24日；不填为明天。识别不了返回 null */
export function parseStart(s: string, today: Ymd): Ymd | null {
  const t = s.trim();
  if (!t) return addDays(today, 1);
  let m = t.match(/^(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*日?$/);
  let x: Ymd | null = m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
  if (!x && (m = t.match(/^(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*日?$/))) x = { y: today.y, m: +m[1], d: +m[2] };
  if (!x || x.m < 1 || x.m > 12 || x.d < 1) return null;
  const check = fromUtc(utc(x));
  return check.m === x.m && check.d === x.d ? x : null;
}

// ---------- 节日日历 ----------

export interface Festival { date: string; name: string; /** 不适合促销、语气要克制 */ solemn?: boolean }

/** 某年某月第 n 个星期几（0 = 周日） */
function nthWeekday(y: number, m: number, wd: number, n: number): Ymd {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  return { y, m, d: 1 + ((wd - first + 7) % 7) + (n - 1) * 7 };
}

const FIXED: [string, string][] = [
  ['01-01', '元旦'], ['02-14', '情人节'], ['03-08', '妇女节（女神节）'], ['05-01', '劳动节'], ['05-04', '青年节'], ['05-20', '520'],
  ['06-01', '儿童节'], ['06-18', '618 年中大促'], ['09-10', '教师节'], ['10-01', '国庆节'], ['11-11', '双十一'], ['12-12', '双十二'],
  ['12-24', '平安夜'], ['12-25', '圣诞节'],
];

/**
 * 农历节日和节气：只放能确定的 2026 年公历日期（正月初一为 2 月 17 日，其余按 2026 年各月朔日推算）。
 * 其他年份不放，腊八、重阳、冬至等拿不准的也不放。
 */
const LUNAR: Record<number, Festival[]> = {
  2026: [
    { date: '2026-02-16', name: '除夕' }, { date: '2026-02-17', name: '春节' }, { date: '2026-03-03', name: '元宵节' },
    { date: '2026-04-05', name: '清明节', solemn: true }, { date: '2026-06-19', name: '端午节' }, { date: '2026-08-19', name: '七夕' },
    { date: '2026-09-25', name: '中秋节' },
  ],
};

export function festivalsOf(y: number): Festival[] {
  const list: Festival[] = FIXED.map(([md, name]) => ({ date: `${y}-${md}`, name }));
  list.push({ date: fmt(nthWeekday(y, 5, 0, 2)), name: '母亲节' }, { date: fmt(nthWeekday(y, 6, 0, 3)), name: '父亲节' }, { date: fmt(nthWeekday(y, 11, 4, 4)), name: '感恩节' });
  list.push(...(LUNAR[y] ?? []));
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

/** 当天或 3 天内的节日（最近的一个），用于结合节日写文案 */
export function festivalNear(x: Ymd, within = 3): (Festival & { daysUntil: number }) | null {
  const all = [...festivalsOf(x.y), ...festivalsOf(x.y + 1)];
  let best: (Festival & { daysUntil: number }) | null = null;
  for (const f of all) {
    const [y, m, d] = f.date.split('-').map(Number);
    const n = diffDays(x, { y, m, d });
    if (n >= 0 && n <= within && (!best || n < best.daysUntil)) best = { ...f, daysUntil: n };
  }
  return best;
}

// ---------- 排期 ----------

export const STYLES: [string, string][] = [['mix', '每天轮换'], ['zhongcao', '种草安利'], ['promo', '促销活动'], ['daily', '日常分享'], ['festival', '节日营销']];
const ANGLES: Record<string, string[]> = {
  zhongcao: ['真实使用场景', '细节特写', '使用前后对比', '顾客反馈晒单', '小知识科普', '搭配推荐', '回答常见疑问'],
  promo: ['活动预告', '优惠提醒', '赠品福利', '老客回馈', '组合套餐推荐', '活动倒计时提醒'],
  daily: ['店主日常', '打包发货现场', '选品进货', '顾客小故事', '生活感悟', '幕后花絮'],
  festival: ['节日或季节话题', '送礼推荐', '节日氛围场景', '节日活动'],
};
const MIX = ['zhongcao', 'daily', 'zhongcao', 'promo', 'daily'];
export const styleLabel = (id: string) => STYLES.find(([k]) => k === id)?.[1] ?? '种草安利';

const SLOTS: Record<number, string[]> = {
  1: ['晚上 20:00–21:00'],
  2: ['早上 7:30–8:30', '晚上 20:00–21:00'],
  3: ['早上 7:30–8:30', '中午 12:00–13:00', '晚上 20:00–21:00'],
};

export interface PlanOptions { start: Ymd; days: number; perDay: number; style: string; holidays: boolean }
export interface Plan {
  index: number;
  total: number;
  date: string;
  weekday: string;
  time: string;
  style: string;
  angle: string;
  festival: (Festival & { daysUntil: number }) | null;
}

export const totalPosts = (o: Pick<PlanOptions, 'days' | 'perDay'>) => o.days * o.perDay;

/** 第 index 条（从 0 开始）的发布日期、时段、风格和角度 */
export function planPost(index: number, o: PlanOptions): Plan {
  const day = Math.floor(index / o.perDay);
  const slot = index % o.perDay;
  const date = addDays(o.start, day);
  const festival = o.holidays ? festivalNear(date) : null;
  let style = o.style === 'mix' ? MIX[(day + slot) % MIX.length] : ANGLES[o.style] ? o.style : 'zhongcao';
  // 每天轮换时，遇到节日当天的第一条改成节日主题
  if (o.style === 'mix' && festival && festival.daysUntil === 0 && slot === 0) style = 'festival';
  const angles = ANGLES[style];
  const angle = angles[(o.style === 'mix' ? Math.floor(index / MIX.length) + slot : index) % angles.length];
  return { index, total: totalPosts(o), date: fmt(date), weekday: weekday(date), time: SLOTS[o.perDay]?.[slot] ?? SLOTS[3][slot % 3], style, angle, festival };
}

// ---------- 提示词 ----------

export const SYSTEM_PROMPT = `你是微信私域运营，帮店主写朋友圈文案。要求：
1. 像真人发朋友圈，不像硬广：开头一句抓人，口语化，80～150 字，可以分 2～4 段，表情符号最多 3 个。
2. 只用给出的商品和活动信息，不编造价格、优惠、销量、功效、认证。没有给活动信息时不要写具体折扣。
3. 不用「最」「第一」「国家级」「顶级」「100%」等广告法极限词，不写医疗功效。
4. 评论区首评用来补充购买方式、规格或活动规则，口吻自然，30 字以内。
5. 只输出 JSON，不要任何解释。`;

export interface WriteOptions { info: string; withImage: boolean; extra: string }

export function buildMessages(p: Plan, o: WriteOptions): ChatMessage[] {
  const fest = p.festival
    ? p.festival.daysUntil === 0
      ? `今天是${p.festival.name}，文案要结合节日。`
      : `${p.festival.daysUntil} 天后是${p.festival.name}，可以自然地做预热。`
    : '';
  const solemn = p.festival?.solemn ? '这个节日不适合促销，语气克制，可以写踏青、思念、家人，不要提优惠。' : '';
  const image = o.withImage ? '\n配图建议：说清拍什么、几张（1、3、4、6 或 9 张）、怎么拍，具体到画面，60 字以内。' : '';
  const format = o.withImage ? '{"copy": "朋友圈正文", "image": "配图建议", "comment": "评论区首评"}' : '{"copy": "朋友圈正文", "comment": "评论区首评"}';
  const user = `商品 / 品牌信息：
${o.info.slice(0, 1500)}

这是排期里的第 ${p.index + 1} 条（共 ${p.total} 条），发布时间：${p.date}（${p.weekday}）${p.time}。
风格：${styleLabel(p.style)}；这条的角度：${p.angle}。不同条之间角度不同，避免和常见模板雷同。
${fest}${solemn}${o.extra ? `\n补充要求：${o.extra.slice(0, 300)}` : ''}${image}

按这个格式输出：${format}`;
  return [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: user.replace(/\n{3,}/g, '\n\n') }];
}

export interface Post { copy: string; image: string; comment: string }

/** 解析回复：兼容代码块、多余文字、中文键名、配图是数组；不是 JSON 时把整段当正文 */
export function parseReply(text: string): Post {
  const raw = String(text ?? '').trim();
  let data: unknown;
  try {
    data = extractJson(raw);
  } catch {
    const plain = raw.replace(/```[a-z]*\n?|```/gi, '').trim();
    if (!plain) throw new Error('大模型没有返回内容');
    return { copy: plain, image: '', comment: '' };
  }
  const root = Array.isArray(data) ? data[0] : data;
  const copy = String(pick(root, ['copy', 'text', 'content', '文案', '正文', 'post']) ?? '').trim();
  const imgRaw = pick(root, ['image', 'images', 'imageTip', '配图', '配图建议', 'picture']);
  const image = Array.isArray(imgRaw) ? toStringList(imgRaw).join('；') : String(imgRaw ?? '').trim();
  const comment = String(pick(root, ['comment', 'firstComment', 'first_comment', '首评', '评论区首评', '评论']) ?? '').trim();
  if (!copy) throw new Error('大模型没有返回文案');
  return { copy, image, comment };
}

/** 结果卡片里显示和复制的文字 */
export function formatPost(p: Plan, post: Post, withImage: boolean): string {
  const fest = p.festival ? ` · ${p.festival.daysUntil === 0 ? p.festival.name : `${p.festival.name}预热`}` : '';
  const head = `${Number(p.date.slice(5, 7))}月${Number(p.date.slice(8))}日 ${p.weekday} · ${p.time} · ${styleLabel(p.style)}${fest}`;
  const extras = [withImage && post.image ? `【配图】${post.image}` : '', post.comment ? `【首评】${post.comment}` : ''].filter(Boolean);
  return [head, '', post.copy, ...(extras.length ? ['', ...extras] : [])].join('\n');
}

/** 排期表：按序号排好，一条一行 */
export function scheduleSheet(items: { plan: Plan; post: Post }[], withImage: boolean): { header: string[]; rows: Cell[][] } {
  const header = ['序号', '日期', '星期', '时段', '风格', '角度', '节日节点', '文案', '字数', ...(withImage ? ['配图建议'] : []), '评论区首评'];
  const rows = [...items].sort((a, b) => a.plan.index - b.plan.index).map(({ plan, post }) => [
    plan.index + 1, plan.date, plan.weekday, plan.time, styleLabel(plan.style), plan.angle,
    plan.festival ? (plan.festival.daysUntil === 0 ? plan.festival.name : `${plan.festival.name}（${plan.festival.daysUntil} 天后）`) : '',
    post.copy, [...post.copy].length, ...(withImage ? [post.image] : []), post.comment,
  ] as Cell[]);
  return { header, rows };
}
