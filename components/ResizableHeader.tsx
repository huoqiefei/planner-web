import React from 'react';

interface ResizableHeaderProps {
    width: number;
    onResize: (w: number) => void;
    children: React.ReactNode;
    align?: 'left' | 'center' | 'right';
    dataCol?: string;
}

export const ResizableHeader: React.FC<ResizableHeaderProps> = ({ width, onResize, children, align = 'left', dataCol }) => {
    const handleMouseDown = (e: React.MouseEvent) => {
        const startX = e.pageX;
        const startW = width;
        const onMove = (mv: MouseEvent) => onResize(Math.max(40, startW + (mv.pageX - startX)));
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        e.stopPropagation();
    };
    return (
        <div 
            className="border-r border-slate-300 dark:border-slate-600 px-2 h-full flex items-center relative overflow-visible select-none flex-shrink-0" 
            style={{ width, justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start' }}
            data-col={dataCol}
        >
            {children}
            <div 
                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 z-10 hover:w-1.5 transition-all" 
                onMouseDown={handleMouseDown}
            ></div>
        </div>
    );
};
