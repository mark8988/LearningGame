import { describe, it, expect } from 'vitest';
import { localFactoryUrl } from './FactoryLauncher';
describe('本機內容工廠入口', () => {
  it('接受並正規化本機服務位址', () => { expect(localFactoryUrl('http://127.0.0.1:5088/path?key=example#section')).toBe('http://127.0.0.1:5088/'); expect(localFactoryUrl('https://localhost:5443')).toBe('https://localhost:5443/'); });
  it('拒絕遠端主機、非 HTTP 協定及內嵌憑證', () => { for (const url of ['https://external.invalid', 'file:///C:/book.pdf', 'javascript:alert(1)', 'http://secret@localhost:5088', 'not-url']) expect(localFactoryUrl(url)).toBeNull(); });
});
