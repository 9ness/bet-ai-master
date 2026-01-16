
/**
 * Triggers a light haptic feedback vibration (15ms) on supported devices.
 * Uses the Vibration API.
 */
export const triggerTouchFeedback = () => {
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(15);
    }
};
