import React, { useState, useEffect, useCallback } from 'react';
import { InfiniteScroll } from '../../components/common';
import '../Pages.css';
import './Artists.css';

/**
 * 艺术家页面组件
 */
const ArtistsPage = ({ router, player }) => {
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const pageSize = 10;

  // 加载艺术家数据
  const loadArtists = useCallback(async (targetPage = 1) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/music/artists?page=${targetPage}&pageSize=${pageSize}`);
      const result = await response.json();

      if (result.success) {
        const newArtists = result.data || [];
        const pagination = result.pagination || {};

        if (targetPage === 1) {
          setArtists(newArtists);
        } else {
          setArtists(prev => [...prev, ...newArtists]);
        }

        setTotal(pagination.total || 0);
        setHasMore(pagination.page < pagination.pages);
        setPage(targetPage);
      }
    } catch (error) {
      console.error('加载艺术家列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 加载下一页
  const loadNext = useCallback(() => {
    if (!loading && hasMore) {
      loadArtists(page + 1);
    }
  }, [loading, hasMore, page, loadArtists]);

  // 处理艺术家点击
  const handleArtistClick = (artist) => {
    router.navigate('artist-detail', { artist });
  };

  // 初始加载
  useEffect(() => {
    loadArtists(1);
  }, []);

  return (
    <div className="page-container artists-container">
      <div className="fav-toolbar">
        <h2>👤 艺术家库</h2>
        <div className="fav-actions">
          <input
            className="fav-search"
            placeholder="搜索艺术家..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <InfiniteScroll
        loadNext={loadNext}
        hasMore={hasMore}
        loading={loading}
        threshold={100}
        loadingText="正在加载更多艺术家..."
        endText="已加载全部艺术家"
      >
        <div className="artists-view">
          <div className="artists-grid">
            {artists.map((artist, index) => {
              return (
                <div 
                  key={artist.id || artist._id} 
                  className="artist-card"
                  onClick={() => handleArtistClick(artist)}
                >
                  <div
                    className="artist-banner"
                    style={{
                      backgroundImage: artist.photo || artist.coverImage
                        ? `url(${artist.photo || artist.coverImage})`
                        : undefined
                    }}
                  >
                    {!artist.photo && !artist.coverImage && (
                      <div className="artist-banner-placeholder">👤</div>
                    )}
                  </div>
                  <div className="artist-info">
                    <h3 className="artist-name">{artist.name || '未知艺术家'}</h3>
                    <div className="artist-meta">
                      <span>{artist.albumCount || 0} 张专辑</span>
                      <span className="dot">•</span>
                      <span>{artist.trackCount || 0} 首歌曲</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {artists.length === 0 && (
            <div className="empty-state">
              <h3>暂无艺术家</h3>
              <p>音乐库中还没有艺术家信息</p>
            </div>
          )}
        </div>
      </InfiniteScroll>
    </div>
  );
};

export default ArtistsPage;
