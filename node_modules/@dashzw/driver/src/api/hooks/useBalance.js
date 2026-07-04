import { useEffect, useState } from 'react';
import { getBalance } from '../domain/finance.js';

export function useBalance(email, ownerType = null) {
  const [balance, setBalance] = useState(0);
  useEffect(() => {
    if (!email) {
      setBalance(0);
      return;
    }
    getBalance(email, ownerType).then(setBalance).catch(() => setBalance(0));
  }, [email, ownerType]);
  return balance;
}
