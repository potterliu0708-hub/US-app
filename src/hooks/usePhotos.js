// src/hooks/usePhotos.js
import { useState, useEffect } from 'react';
import { subscribePhotos, toggleLike as toggleLikeService } from '../../services';

export const usePhotos = () => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribePhotos((fetchedPhotos) => {
      setPhotos(fetchedPhotos);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const toggleLike = async (photoKey) => {
    try {
      await toggleLikeService(photoKey);
      // 樂觀更新
      setPhotos(prev =>
        prev.map(p =>
          p.key === photoKey
            ? { ...p, likes: (p.likes || 0) + 1 }
            : p
        )
      );
    } catch (error) {
      console.error('Like 失敗:', error);
    }
  };

  return { photos, loading, toggleLike };
};