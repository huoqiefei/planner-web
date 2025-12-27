import { useState, useEffect, useRef, useCallback } from 'react';

interface UseVirtualScrollProps {
    totalCount: number;
    itemHeight: number;
    containerRef: React.RefObject<HTMLElement>;
    overscan?: number;
}

interface VirtualItem {
    index: number;
    offsetTop: number;
}

export const useVirtualScroll = ({
    totalCount,
    itemHeight,
    containerRef,
    overscan = 5
}: UseVirtualScrollProps) => {
    const [scrollTop, setScrollTop] = useState(0);
    const [containerHeight, setContainerHeight] = useState(0);

    // Update container height on resize
    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerHeight(entry.contentRect.height);
            }
        });

        resizeObserver.observe(element);
        
        // Initial height
        setContainerHeight(element.clientHeight);

        return () => resizeObserver.disconnect();
    }, [containerRef]);

    // Handle scroll
    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        const handleScroll = () => {
            requestAnimationFrame(() => {
                setScrollTop(element.scrollTop);
            });
        };

        element.addEventListener('scroll', handleScroll, { passive: true });
        return () => element.removeEventListener('scroll', handleScroll);
    }, [containerRef]);

    // Calculate visible range
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
        totalCount - 1,
        Math.floor((scrollTop + containerHeight) / itemHeight) + overscan
    );

    const virtualItems: VirtualItem[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
        virtualItems.push({
            index: i,
            offsetTop: i * itemHeight
        });
    }

    const totalHeight = totalCount * itemHeight;

    return {
        virtualItems,
        totalHeight,
        startIndex,
        endIndex,
        isVirtual: totalCount > 0
    };
};
