import React, { useEffect, useMemo, useState } from 'react';
import './index.css';

const DEFAULT_PAGE_SIZE = 10;

/**
 * 格式化时长显示
 * @param {number} seconds - 秒数
 * @returns {string} 格式化后的时长
 */
function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '--:--';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * 格式化音乐品质信息
 * @param {Object} track - 音乐信息
 * @returns {string} 格式化后的品质信息
 */
function formatQuality(track) {
  const ext = (track?.filename?.split('.').pop() || '').toUpperCase();
  const kbps = track?.bitrate ? Math.round(track.bitrate / 1000) : null;
  const khz = track?.sampleRate ? Math.round(track.sampleRate / 1000) : null;
  const parts = [];
  if (ext) parts.push(ext);
  if (kbps) parts.push(`${kbps}kbps`);
  if (khz) parts.push(`${khz}kHz`);
  return parts.join(' ') || '—';
}

/**
 * 音乐列表组件
 * 提供音乐列表展示、分页、排序等功能
 */
const MusicList = ({
  default_pageSize = DEFAULT_PAGE_SIZE,
  showCover = true,
  searchKeyword,
  filters = {},
  mode = 'tracks', // 'tracks' | 'recent' | 'random'
  isFavoriteList = false
}) => {
  // 数据状态
  const [tracks, setTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // 排序状态
  const [sortKey, setSortKey] = useState('title');
  const [sortOrder, setSortOrder] = useState('asc');
  
  // 分页状态
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(default_pageSize);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  
  // 更多操作菜单状态
  const [showMoreMenu, setShowMoreMenu] = useState(null);

  /**
   * 播放音乐
   */
  const handlePlay = (track) => {
    // 触发自定义事件，让主组件处理播放
    window.dispatchEvent(new CustomEvent('playMusic', { 
      detail: { track, playlistTracks: null } 
    }));
  };

  /**
   * 添加到播放列表
   */
  const handleAddToPlaylist = (track) => {
    // 触发自定义事件，让主组件处理添加到播放列表
    window.dispatchEvent(new CustomEvent('addToPlaylist', { 
      detail: { track } 
    }));
  };

  /**
   * 收藏/取消收藏
   */
  const handleFavorite = async (track) => {
    try {
      const response = await fetch(`/api/music/tracks/${track.id}/favorite`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorite: !track.favorite })
      });
      
      if (response.ok) {
        // 更新本地状态
        setTracks(prev => prev.map(t => 
          t.id === track.id ? { ...t, favorite: !t.favorite } : t
        ));
      }
    } catch (error) {
      console.error('收藏操作失败:', error);
    }
  };

  /**
   * 查看详情
   */
  const handleDetails = (track) => {
    // 触发自定义事件，让主组件处理详情页面
    window.dispatchEvent(new CustomEvent('openTrackDetail', { 
      detail: { track } 
    }));
  };

  /**
   * 记录播放
   */
  const handleRecordPlay = async (trackId) => {
    try {
      await fetch(`/api/music/recently-played/${trackId}`, { method: 'POST' });
    } catch (error) {
      console.error('记录播放失败:', error);
    }
  };

  /**
   * 加载音乐列表
   */
  const loadTracks = async (targetPage = page) => {
    setIsLoading(true);
    setError('');
    try {
      let url = '/api/music/tracks';
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(pageSize),
        sort: sortKey,
        order: sortOrder,
        search: searchKeyword || '' // 使用 search 参数
      });
      
      // 添加过滤条件
      if (filters.genre) params.set('genre', filters.genre);
      if (filters.artist) params.set('artist', filters.artist);
      if (filters.album) params.set('album', filters.album);
      if (filters.yearFrom) params.set('yearFrom', String(filters.yearFrom));
      if (filters.yearTo) params.set('yearTo', String(filters.yearTo));
      if (filters.decade) params.set('decade', String(filters.decade));
      if (filters.minBitrate) params.set('minBitrate', String(filters.minBitrate));
      if (filters.maxBitrate) params.set('maxBitrate', String(filters.maxBitrate));
      if (typeof filters.favorite !== 'undefined') params.set('favorite', String(filters.favorite));

      if (mode === 'recent') {
        url = '/api/music/recently-played';
        // 最近播放使用 limit 和 offset 参数
        params.delete('page');
        params.set('limit', String(pageSize));
        params.set('offset', String((targetPage - 1) * pageSize));
        // 最近播放不使用排序参数和搜索参数
        params.delete('sort');
        params.delete('order');
        params.delete('search');
      }

      const res = await fetch(`${url}?${params.toString()}`);
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || '加载失败');

      // 处理数据
      let docs = [];
      if (mode === 'recent') {
        // 最近播放模式返回格式不同
        docs = Array.isArray(json.data) ? json.data : [];
      } else {
        // 其他模式返回标准化分页格式
        docs = Array.isArray(json.data) ? json.data : [];
      }

      let mapped = docs.map((t) => ({
        id: t.id,
        _id: t.id, // 保持兼容性
        title: t.title,
        artist: t.artist,
        album: t.album,
        duration: t.duration,
        year: t.year,
        genre: t.genre,
        bitrate: t.bitrate,
        sampleRate: t.sampleRate,
        filename: t.filename,
        coverImage: t.coverImage || null,
        favorite: t.favorite,
        playCount: t.playCount,
        lastPlayed: t.lastPlayed
      }));

      // 随机模式：打乱顺序
      if (mode === 'random') {
        const arr = [...mapped];
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        mapped = arr;
      }

      setTracks(mapped);
      
      // 处理分页信息
      if (mode === 'recent') {
        // 最近播放模式使用 total 字段
        const total = json.total || 0;
        setTotal(total);
        setPages(Math.ceil(total / pageSize));
        setPage(targetPage);
      } else {
        // 其他模式使用标准化分页格式
        if (json.pagination) {
          setTotal(json.pagination.total || 0);
          setPages(json.pagination.pages || 1);
          setPage(json.pagination.page || targetPage);
        } else {
          setTotal(0);
          setPages(1);
          setPage(targetPage);
        }
      }
    } catch (err) {
      setError(err.message || '加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 处理排序
   */
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  /**
   * 生成页码数组
   */
  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxVisible = 5;
    
    if (pages <= maxVisible) {
      for (let i = 1; i <= pages; i++) {
        pageNumbers.push(i);
      }
    } else {
      const start = Math.max(1, page - Math.floor(maxVisible / 2));
      const end = Math.min(pages, start + maxVisible - 1);
      
      for (let i = start; i <= end; i++) {
        pageNumbers.push(i);
      }
    }
    
    return pageNumbers;
  };

  /**
   * 处理页码变化
   */
  const handlePageChange = (targetPage) => {
    if (targetPage >= 1 && targetPage <= pages && targetPage !== page) {
      loadTracks(targetPage);
    }
  };

  /**
   * 处理每页数量变化
   */
  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    setPage(1);
    loadTracks(1);
  };

  // 监听搜索关键词变化
  useEffect(() => {
    setPage(1);
    loadTracks(1);
  }, [searchKeyword, sortKey, sortOrder, pageSize, ...Object.values(filters)]);

  // 初始加载
  useEffect(() => {
    loadTracks(1);
  }, []);

  // 处理双击播放
  const handleDoubleClick = (track) => {
    handlePlay(track);
    handleRecordPlay(track.id);
  };

  return (
    <div className="music-list-container">
      {/* 工具栏 */}
      <div className="music-list-toolbar">
        <div className="toolbar-left">
          <h3>
            {mode === 'recent' && '最近播放'}
            {mode === 'random' && '随机播放'}
            {isFavoriteList && '我的收藏'}
            {mode === 'tracks' && !isFavoriteList && '音乐列表'}
          </h3>
          <span className="track-count">共 {total} 首</span>
        </div>
        
        <div className="toolbar-right">
          <select 
            value={pageSize} 
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="page-size-select"
          >
            <option value={10}>10 首/页</option>
            <option value={20}>20 首/页</option>
            <option value={50}>50 首/页</option>
            <option value={100}>100 首/页</option>
          </select>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="error-message">
          <p>❌ {error}</p>
          <button onClick={() => loadTracks(1)}>重试</button>
        </div>
      )}

      {/* 音乐列表 */}
      <div className="music-list">
        <table className="music-table">
          <thead>
            <tr>
              <th className="col-cover" style={{ width: showCover ? '60px' : '0' }}>
                {showCover && '封面'}
              </th>
              <th 
                className="col-title sortable"
                onClick={() => handleSort('title')}
              >
                标题
                {sortKey === 'title' && (
                  <span className="sort-indicator">
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th 
                className="col-artist sortable"
                onClick={() => handleSort('artist')}
              >
                艺术家
                {sortKey === 'artist' && (
                  <span className="sort-indicator">
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th 
                className="col-album sortable"
                onClick={() => handleSort('album')}
              >
                专辑
                {sortKey === 'album' && (
                  <span className="sort-indicator">
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th 
                className="col-duration sortable"
                onClick={() => handleSort('duration')}
              >
                时长
                {sortKey === 'duration' && (
                  <span className="sort-indicator">
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th 
                className="col-year sortable"
                onClick={() => handleSort('year')}
              >
                年份
                {sortKey === 'year' && (
                  <span className="sort-indicator">
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th className="col-quality">品质</th>
              <th className="col-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            {tracks.map((track) => (
              <tr 
                key={track.id} 
                className="music-row"
                onDoubleClick={() => handleDoubleClick(track)}
              >
                <td className="col-cover">
                  {showCover && (
                    <div className="cover-container">
                      {track.coverImage ? (
                        <img 
                          src={track.coverImage.startsWith('data:') 
                            ? track.coverImage 
                            : `/api/music/tracks/${track.id}/cover`
                          }
                          alt="封面"
                          className="cover-image"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className="cover-placeholder">
                        <span>🎵</span>
                      </div>
                    </div>
                  )}
                </td>
                <td className="col-title">
                  <div className="title-cell">
                    <span className="title-text">{track.title || '未知标题'}</span>
                    {track.favorite && <span className="favorite-indicator">⭐</span>}
                  </div>
                </td>
                <td className="col-artist">
                  {track.artist || '未知艺术家'}
                </td>
                <td className="col-album">
                  {track.album || '未知专辑'}
                </td>
                <td className="col-duration">
                  {formatDuration(track.duration)}
                </td>
                <td className="col-year">
                  {track.year || '—'}
                </td>
                <td className="col-quality">
                  {formatQuality(track)}
                </td>
                <td className="col-actions">
                  <div className="action-buttons">
                    <button 
                      className="action-btn play-btn"
                      onClick={() => {
                        handlePlay(track);
                        handleRecordPlay(track.id);
                      }}
                      title="播放"
                    >
                      ▶️
                    </button>
                    <button 
                      className="action-btn add-btn"
                      onClick={() => handleAddToPlaylist(track)}
                      title="添加到播放列表"
                    >
                      ➕
                    </button>
                    <button 
                      className={`action-btn favorite-btn ${track.favorite ? 'favorited' : ''}`}
                      onClick={() => handleFavorite(track)}
                      title={track.favorite ? '取消收藏' : '收藏'}
                    >
                      {track.favorite ? '⭐' : '☆'}
                    </button>
                    <button 
                      className="action-btn details-btn"
                      onClick={() => handleDetails(track)}
                      title="详情"
                    >
                      ℹ️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* 加载状态 */}
        {isLoading && (
          <div className="loading-overlay">
            <div className="loading-spinner">🔄</div>
            <p>加载中...</p>
          </div>
        )}
        
        {/* 空状态 */}
        {!isLoading && tracks.length === 0 && (
          <div className="empty-state">
            <h3>暂无音乐</h3>
            <p>没有找到符合条件的音乐</p>
          </div>
        )}
      </div>

      {/* 分页控件 */}
      {pages > 1 && (
        <div className="pagination">
          <button 
            className="page-btn"
            disabled={page === 1}
            onClick={() => handlePageChange(page - 1)}
          >
            上一页
          </button>
          
          {getPageNumbers().map((pageNum) => (
            <button
              key={pageNum}
              className={`page-btn ${pageNum === page ? 'active' : ''}`}
              onClick={() => handlePageChange(pageNum)}
            >
              {pageNum}
            </button>
          ))}
          
          <button 
            className="page-btn"
            disabled={page === pages}
            onClick={() => handlePageChange(page + 1)}
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
};

export default MusicList;


