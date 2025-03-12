import { useContext } from 'react';
import { TimerContext } from '../contexts/TimerContext';

export const useTimer = () => {
  return useContext(TimerContext);
}; 