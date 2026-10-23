import { describe, expect, it } from 'vitest';
import { addDays, buildMessages, festivalNear, festivalsOf, formatPost, parseReply, parseStart, planPost, scheduleSheet, weekday, type PlanOptions } from './core';

const T = { y: 2026, m: 10, d: 23 };
const ymd = (s: string) => { const [y, m, d] = s.split('-').map(Number); return { y, m, d }; };

describe('日期', () => {
  it('解析开始日期', () => {
    expect(parseStart('', T)).toEqual({ y: 2026, m: 10, d: 24 });
    expect(parseStart('2026-11-01', T)).toEqual({ y: 2026, m: 11, d: 1 });
    expect(parseStart('2026/11/1', T)).toEqual({ y: 2026, m: 11, d: 1 });
    expect(parseStart('2026年11月1日', T)).toEqual({ y: 2026, m: 11, d: 1 });
    expect(parseStart('11月5日', T)).toEqual({ y: 2026, m: 11, d: 5 });
    expect(parseStart('2026-02-30', T)).toBeNull();
    expect(parseStart('下周一', T)).toBeNull();
  });
  it('加天数跨月跨年、星期', () => {
    expect(addDays({ y: 2026, m: 12, d: 30 }, 3)).toEqual({ y: 2027, m: 1, d: 2 });
    expect(weekday(T)).toBe('周五');
  });
});

describe('节日日历', () => {
  const y26 = Object.fromEntries(festivalsOf(2026).map((f) => [f.name, f.date]));
  it('按规则计算的节日', () => {
    expect(y26['母亲节']).toBe('2026-05-10');
    expect(y26['父亲节']).toBe('2026-06-21');
    expect(y26['感恩节']).toBe('2026-11-26');
  });
  it('2026 年农历节日', () => {
    expect(y26['春节']).toBe('2026-02-17');
    expect(y26['中秋节']).toBe('2026-09-25');
    expect(y26['端午节']).toBe('2026-06-19');
  });
  it('其他年份不放农历节日', () => {
    const names = festivalsOf(2027).map((f) => f.name);
    expect(names).not.toContain('春节');
    expect(names).toContain('双十一');
  });
  it('3 天内最近的节日，可跨年', () => {
    expect(festivalNear(ymd('2026-11-09'))).toMatchObject({ name: '双十一', daysUntil: 2 });
    expect(festivalNear(ymd('2026-11-11'))).toMatchObject({ name: '双十一', daysUntil: 0 });
    expect(festivalNear(ymd('2026-11-02'))).toBeNull();
    expect(festivalNear(ymd('2026-12-30'))).toMatchObject({ name: '元旦', date: '2027-01-01', daysUntil: 2 });
  });
});

const opts = (over: Partial<PlanOptions> = {}): PlanOptions => ({ start: ymd('2026-11-09'), days: 7, perDay: 2, style: 'promo', holidays: true, ...over });

describe('排期', () => {
  it('日期、时段、角度', () => {
    const p = planPost(3, opts());
    expect(p).toMatchObject({ index: 3, total: 14, date: '2026-11-10', weekday: '周二', time: '晚上 20:00–21:00', style: 'promo', angle: '老客回馈' });
    expect(p.festival).toMatchObject({ name: '双十一', daysUntil: 1 });
  });
  it('关闭节日时不结合', () => expect(planPost(0, opts({ holidays: false })).festival).toBeNull());
  it('每天轮换：节日当天第一条改成节日主题，相邻两天风格不同', () => {
    const o = opts({ style: 'mix', perDay: 1 });
    expect(planPost(2, o)).toMatchObject({ date: '2026-11-11', style: 'festival' });
    expect(planPost(0, o).style).not.toBe(planPost(1, o).style);
  });
  it('每天 3 条有早中晚', () => {
    const o = opts({ perDay: 3 });
    expect([0, 1, 2].map((i) => planPost(i, o).time)).toEqual(['早上 7:30–8:30', '中午 12:00–13:00', '晚上 20:00–21:00']);
  });
});

describe('提示词', () => {
  const info = { info: '316 保温杯，送杯套', withImage: true, extra: '称呼宝子们' };
  it('包含商品信息、日期、角度、节日预热、配图要求和格式', () => {
    const m = buildMessages(planPost(0, opts()), info);
    expect(m[0].content).toContain('不编造价格');
    expect(m[1].content).toContain('316 保温杯，送杯套');
    expect(m[1].content).toContain('2026-11-09（周一）早上 7:30–8:30');
    expect(m[1].content).toContain('角度：活动预告');
    expect(m[1].content).toContain('2 天后是双十一');
    expect(m[1].content).toContain('称呼宝子们');
    expect(m[1].content).toContain('"image"');
  });
  it('不要配图时不提配图；清明语气克制', () => {
    const m = buildMessages(planPost(0, opts({ start: ymd('2026-04-05') })), { ...info, withImage: false });
    expect(m[1].content).not.toContain('配图');
    expect(m[1].content).toContain('今天是清明节');
    expect(m[1].content).toContain('不适合促销');
  });
});

describe('解析回复（容错）', () => {
  it('标准 JSON', () => expect(parseReply('{"copy":"正文","image":"拍杯子","comment":"首评"}')).toEqual({ copy: '正文', image: '拍杯子', comment: '首评' }));
  it('代码块 + 中文键名 + 配图数组', () => expect(parseReply('```json\n{"文案":"正文","配图建议":["图1","图2"],"首评":"评"}\n```')).toEqual({ copy: '正文', image: '图1；图2', comment: '评' }));
  it('缺配图和首评时为空', () => expect(parseReply('好的 {"copy":"正文"}')).toEqual({ copy: '正文', image: '', comment: '' }));
  it('不是 JSON 时整段当正文', () => expect(parseReply('今天天气真好\n来杯热水')).toEqual({ copy: '今天天气真好\n来杯热水', image: '', comment: '' }));
  it('没有正文或空回复时报错', () => {
    expect(() => parseReply('{"comment":"x"}')).toThrow('没有返回文案');
    expect(() => parseReply('  ')).toThrow('没有返回内容');
  });
});

describe('输出', () => {
  const plan = planPost(0, opts());
  it('卡片文字', () => {
    expect(formatPost(plan, { copy: '正文', image: '拍杯子', comment: '首评' }, true)).toBe('11月9日 周一 · 早上 7:30–8:30 · 促销活动 · 双十一预热\n\n正文\n\n【配图】拍杯子\n【首评】首评');
    expect(formatPost(plan, { copy: '正文', image: '拍杯子', comment: '' }, false)).toBe('11月9日 周一 · 早上 7:30–8:30 · 促销活动 · 双十一预热\n\n正文');
  });
  it('排期表按序号排序', () => {
    const s = scheduleSheet([{ plan: planPost(1, opts()), post: { copy: '二', image: 'b', comment: 'y' } }, { plan, post: { copy: '一一', image: 'a', comment: 'x' } }], true);
    expect(s.header).toEqual(['序号', '日期', '星期', '时段', '风格', '角度', '节日节点', '文案', '字数', '配图建议', '评论区首评']);
    expect(s.rows[0]).toEqual([1, '2026-11-09', '周一', '早上 7:30–8:30', '促销活动', '活动预告', '双十一（2 天后）', '一一', 2, 'a', 'x']);
    expect(s.rows[1][0]).toBe(2);
    expect(scheduleSheet([], false).header).not.toContain('配图建议');
  });
});
