// src/hooks/usePairing.js
import { useState } from 'react';
import { pairWithCode as pairService } from '../../services';

export const usePairing = () => {
  const [isPairing, setIsPairing] = useState(false);
  const [partnerId, setPartnerId] = useState(null);

  const pair = async (code) => {
    setIsPairing(true);
    try {
      const result = await pairService(code);
      setPartnerId(result);
      return result;
    } finally {
      setIsPairing(false);
    }
  };

  return { pair, isPairing, partnerId };
};