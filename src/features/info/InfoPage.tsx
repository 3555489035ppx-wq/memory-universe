import { Link, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

export function InfoPage(): ReactNode {
  const { pathname } = useLocation();
  const isPrivacy = pathname === '/privacy';
  return (
    <main className="page-overlay">
      <article className="page-panel" aria-labelledby="info-title">
        <p className="eyebrow">{isPrivacy ? 'PRIVACY' : 'ABOUT MEMUNIVERSE'}</p>
        <h1 id="info-title">{isPrivacy ? '隐私边界' : '关于 Memuniverse'}</h1>
        {isPrivacy ? (
          <>
            <p>
              照片默认在当前浏览器内处理和保存，个人数据写入 IndexedDB。不需要账号、不需要 AI
              API，也不会自动上传到服务器。
            </p>
            <p>
              清除浏览器站点数据可能造成记忆丢失；请定期从 Settings 导出
              Backup。导出文件离开浏览器后由你自行保管。
            </p>
          </>
        ) : (
          <>
            <p>Memuniverse 是一个探索数字记忆关系的空间体验。</p>
            <p>
              它坚持 Local First、0 API 和 Spatial
              Memory：照片留在设备中，关系和布局在本地生成，空间是探索记忆的入口。
            </p>
          </>
        )}
        <nav aria-label="信息页面导航">
          <Link className="secondary-action" to="/">
            返回首页
          </Link>
          <Link className="secondary-action" to="/settings">
            打开 Settings
          </Link>
        </nav>
      </article>
    </main>
  );
}
