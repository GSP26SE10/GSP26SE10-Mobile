import { useRef } from 'react';
import { PanResponder } from 'react-native';

export const useSwipeBack = (onBack) => {
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt, gestureState) => {
        // Only respond if touch starts from the left edge (within 50px)
        return evt.nativeEvent.pageX < 50;
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Respond if moving right and started from left
        return evt.nativeEvent.pageX < 50 && gestureState.dx > 0;
      },
      onPanResponderGrant: () => {
        // Gesture started
      },
      onPanResponderMove: () => {
        // Gesture moving
      },
      onPanResponderRelease: (evt, gestureState) => {
        // Check if swipe is valid (swiped right more than 100px or 30% of screen width)
        const { dx, vx } = gestureState;
        const screenWidth = evt.nativeEvent.pageX + Math.abs(dx);
        const threshold = Math.min(100, screenWidth * 0.3);
        
        if (dx > threshold || (dx > 50 && vx > 0.5)) {
          onBack();
        }
      },
    })
  ).current;

  return panResponder;
};
