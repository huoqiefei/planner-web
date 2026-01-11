import { calculateSchedule } from '../services/scheduler';

self.onmessage = (e: MessageEvent) => {
    // e.data should be ProjectData
    const result = calculateSchedule(e.data);
    self.postMessage(result);
};
