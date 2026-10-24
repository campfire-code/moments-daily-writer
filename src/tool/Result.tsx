// 结果展示：像朋友圈里的一条动态——左边是发布日期，右边是正文气泡、配图占位格和评论区首评
import { ImageIcon, MessageCircle } from 'lucide-react';
import type { InputItem, ItemResult } from '../kit/types';
import './tool.css';

interface Parsed { day: string; month: string; weekday: string; time: string; style: string; festival: string; copy: string; image: string; comment: string }

const CN: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

/** 把 formatPost 生成的文字还原成结构：第一行是「月日 星期 · 时段 · 风格 · 节日」，其后是正文、【配图】、【首评】 */
export function parsePost(text: string): Parsed {
  const [head = '', ...rest] = text.split('\n');
  const body = rest.join('\n').trim();
  const iImg = body.indexOf('【配图】');
  const iCom = body.indexOf('【首评】');
  const cut = [iImg, iCom].filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? body.length;
  const field = (tag: string) => {
    const i = body.indexOf(tag);
    if (i < 0) return '';
    const end = [iImg, iCom].filter((j) => j > i).sort((a, b) => a - b)[0] ?? body.length;
    return body.slice(i + tag.length, end).trim();
  };
  const parts = head.split(' · ');
  const m = /^(\d+)月(\d+)日\s*(\S+)/.exec(parts[0] ?? '');
  return {
    month: m ? `${m[1]} 月` : '', day: m ? m[2] : '', weekday: m ? m[3] : '',
    time: parts[1] ?? '', style: parts[2] ?? '', festival: parts[3] ?? '',
    copy: body.slice(0, cut).trim(), image: field('【配图】'), comment: field('【首评】'),
  };
}

/** 配图建议里「3 张」「三张」的张数，认不出来按 0 张（不画占位格） */
export function imageCount(s: string): number {
  const m = /(\d+|[一二两三四五六七八九])\s*张/.exec(s);
  if (!m) return 0;
  const n = /\d/.test(m[1]) ? Number(m[1]) : CN[m[1]];
  return Math.min(9, Math.max(0, n));
}

export function ResultBody({ result }: { item: InputItem; result: ItemResult }) {
  if (!result.text) return <p className="mm-sub">{result.summary}</p>;
  const p = parsePost(result.text);
  const n = imageCount(p.image);
  return (
    <div className="mm-post">
      <div className="mm-date" aria-label={`${p.month}${p.day}日 ${p.weekday}`}>
        <b className="k-num">{p.day}</b><span>{p.month}</span><em>{p.weekday}</em>
      </div>
      <div className="mm-main">
        <div className="mm-tags">
          <span className="mm-tag time">{p.time}</span>
          <span className="mm-tag">{p.style}</span>
          {p.festival && <span className="mm-tag fest">{p.festival}</span>}
        </div>
        <p className="mm-copy">{p.copy}</p>
        {p.image && (
          <div className="mm-img">
            {n > 0 && <div className="mm-grid" data-n={n}>{Array.from({ length: n }, (_, i) => <span key={i} className="mm-tile"><ImageIcon size={16} /><i className="k-num">{i + 1}</i></span>)}</div>}
            <span className="mm-img-t"><b>配图建议</b>{p.image}</span>
          </div>
        )}
        {p.comment && <div className="mm-comment"><MessageCircle size={14} /><span><b>首评</b>{p.comment}</span></div>}
      </div>
    </div>
  );
}
